

const TL_ENTITIES = (() => {
  const entities = [

    ...USERS.map(u => ({ id: 'user:' + u.name, label: u.name, color: u.color, type: 'user' })),
  ];

  DEPOTS.forEach(d => {
    const short = d.replace(/^\/\//, '').replace(/\/$/, '');
    entities.push({
      id: 'depot:' + short, label: '//' + short,
      color: typeof getDepotColor === 'function' ? getDepotColor(d) : '#f0883e',
      type: 'depot', depotKey: d,
    });
  });

  if (typeof WORKSPACE_LIST !== 'undefined') {
    WORKSPACE_LIST.forEach(ws => {
      const color = typeof getWorkspaceColor === 'function' ? getWorkspaceColor(ws) : themeColor('muted');
      entities.push({
        id: 'workspace:' + ws,
        label: ws,
        color: color,
        type: 'workspace',
        workspaceKey: ws
      });
    });
  }

  const extColors = typeof EXT_PALETTE !== 'undefined' ? EXT_PALETTE : ['#bc8cff','#58a6ff','#3fb950','#f0883e','#f85149','#d29922'];
  (typeof EXTS_LIST !== 'undefined' ? EXTS_LIST : ['uasset','umap','cpp']).forEach((ext, i) => {
    entities.push({ id: 'ext:' + ext, label: '.' + ext, color: extColors[i % extColors.length], type: 'ext' });
  });

  entities.push({ id: 'all', label: 'Все', color: themeColor('muted'), type: 'all' });

  return entities;
})();

const TL_PALETTE = ['#3fb950','#58a6ff','#f0883e','#bc8cff','#f85149','#d29922','#56d364','#4d9cf7','#e3b341','#da8fff'];
const TL_TYPE_LABELS = { user: 'Авторы', depot: 'Депо', workspace: 'Воркспейсы', ext: 'Типы файлов', all: 'Прочее' };
const TL_TYPE_ORDER = ['user', 'depot', 'workspace', 'ext', 'all'];
let tlPoolCollapsed = {};
function tlTogglePoolGroup(type) {
  tlPoolCollapsed[type] = !tlPoolCollapsed[type];
  renderTlEntityRow();
}

let tlGran = 'week';
let tlChartInst = null;

let tlGroups = USERS.map((u, i) => ({
  id: 'g' + i,
  label: u.name,
  color: u.color,
  entities: ['user:' + u.name],
}));

const TL_PARAMS = {

  commits:          { label: 'Количество сабмитов',         unit: '',      aggregate: 'sum' },
  files_changed:    { label: 'Файлов изменено',             unit: '',      aggregate: 'sum' },
  unique_authors:   { label: 'Уникальных авторов',          unit: '',      aggregate: 'union' },
  commit_density:   { label: 'Плотность сабмитов (на день)', unit: '/д',   aggregate: 'avg' },

  total_size_gb:    { label: 'Суммарный вес (ГБ)',          unit: ' ГБ',   aggregate: 'sum' },
  avg_size_mb:      { label: 'Средний вес сабмита (МБ)',    unit: ' МБ',   aggregate: 'avg' },
  max_size_mb:      { label: 'Макс. вес сабмита (МБ)',      unit: ' МБ',   aggregate: 'max' },
  size_per_file_kb: { label: 'Вес на файл (КБ)',            unit: ' КБ',   aggregate: 'avg' },

  avg_files:        { label: 'Ср. файлов / сабмит',         unit: '',      aggregate: 'avg' },
  max_files:        { label: 'Макс. файлов в сабмите',      unit: '',      aggregate: 'max' },
  new_ratio:        { label: 'Доля новых файлов',           unit: '%',     aggregate: 'avg' },
  edit_ratio:       { label: 'Доля edit (vs add/delete)',   unit: '%',     aggregate: 'avg' },
  delete_ratio:     { label: 'Доля удалений',               unit: '%',     aggregate: 'avg' },

  avg_rev:          { label: 'Ср. ревизия файла',           unit: '',      aggregate: 'avg' },
  max_rev:          { label: 'Макс. ревизия файла',         unit: '',      aggregate: 'max' },
  weighted_by_rev:  { label: 'Файлов × ревизий (weighted)', unit: '',      aggregate: 'sum' },
  rev_growth:       { label: 'Прирост ревизий',             unit: '',      aggregate: 'sum' },

  desc_length:      { label: 'Длина описания (симв.)',      unit: ' симв', aggregate: 'avg' },
  anomaly_rate:     { label: 'Доля аномалий (%)',           unit: '%',     aggregate: 'avg' },
  churn_proxy:      { label: 'Churn (изм. / уник. файлов)', unit: '',      aggregate: 'avg' },
  bus_factor_proxy: { label: 'Bus Factor (ср. авт. / файл)', unit: '',     aggregate: 'avg' },

  avg_hour:         { label: 'Средний час сабмита',         unit: 'h',     aggregate: 'avg' },
  weekend_ratio:    { label: 'Доля сабмитов в выходные',   unit: '%',     aggregate: 'avg' },
  night_ratio:      { label: 'Доля ночных сабмитов',       unit: '%',     aggregate: 'avg' },
};

let tlYear = 'all';

function filterCommitsByWorkspace(commits) {
  const p = workspacePickers['timeline'];
  if (!p || p.active.size === WORKSPACE_LIST.length) return commits;
  return commits.filter(c => p.active.has(c.workspace));
}

function setTlYear(y) {
  tlYear = y;
  buildTimeline();
}

function initTlYearSel() {
  const years = [...new Set(DAY_DATA.map(d => d.date.getFullYear()))].sort();
  const sel = document.getElementById('tlYearSel');
  if (!sel) return;
  years.forEach(y => {
    const opt = document.createElement('option');
    opt.value = y; opt.textContent = y;
    sel.appendChild(opt);
  });
}

function setTlGran(g) {
  tlGran = g;
  document.querySelectorAll('#tlGranSeg .sb').forEach((b, i) =>
      b.classList.toggle('on', i === { day: 0, week: 1, month: 2 }[g])
  );
  buildTimeline();
}

function commitsForEntity(days, entityId) {
  const ent = TL_ENTITIES.find(e => e.id === entityId);
  if (!ent) return [];
  let raw = [];
  if (ent.type === 'user') {
    raw = days.flatMap(d => d.perUser[ent.label]?.commits || []);
  }
  if (ent.type === 'depot') {
    raw = days.flatMap(d => USERS.flatMap(u => (d.perUser[u.name]?.commits||[]).filter(c => c.depot === ent.depotKey)));
  }
  if (ent.type === 'workspace') {
    raw = days.flatMap(d => USERS.flatMap(u => (d.perUser[u.name]?.commits||[]).filter(c => c.workspace === ent.workspaceKey)));
  }
  if (ent.type === 'ext') {
    const ext = ent.label.replace('.','');
    raw = days.flatMap(d => USERS.flatMap(u => (d.perUser[u.name]?.commits||[]).filter(c => c.files && c.files.some(f => f.ext === ext))));
  }
  if (ent.type === 'all') {
    raw = days.flatMap(d => USERS.flatMap(u => d.perUser[u.name]?.commits||[]));
  }

  return filterCommitsByWorkspace(raw);
}

function computeMetricForCommits(commits, param, bucketDays) {
  if (!commits.length) return 0;

  function sr(seed) { let s=seed; return ()=>{ s=(s*1664525+1013904223)&0xffffffff; return (s>>>0)/4294967296; }; }

  switch (param) {
    case 'commits':        return commits.length;
    case 'files_changed':  return commits.reduce((s, c) => s + c.nFiles, 0);
    case 'unique_authors': return new Set(commits.map(c => c.author)).size;
    case 'commit_density': return bucketDays ? +(commits.length / bucketDays).toFixed(3) : commits.length;
    case 'total_size_gb':  return +commits.reduce((s, c) => s + (c.sizeGB || 0), 0).toFixed(3);
    case 'avg_size_mb': {
      const tot = commits.reduce((s, c) => s + (c.sizeGB || 0), 0);
      return +(tot / commits.length * 1024).toFixed(2);
    }
    case 'max_size_mb':    return +(Math.max(...commits.map(c => c.sizeGB || 0)) * 1024).toFixed(2);
    case 'size_per_file_kb': {
      const totFiles = commits.reduce((s,c)=>s+c.nFiles,0)||1;
      const totGB = commits.reduce((s,c)=>s+(c.sizeGB||0),0);
      return +(totGB*1024*1024/totFiles).toFixed(1);
    }
    case 'avg_files':      return +(commits.reduce((s, c) => s + c.nFiles, 0) / commits.length).toFixed(1);
    case 'max_files':      return Math.max(...commits.map(c => c.nFiles));
    case 'new_ratio': {
      const r = sr(commits.length * 17 + 3);
      return +(r() * 0.4 + 0.1).toFixed(3);
    }
    case 'edit_ratio': {
      const r = sr(commits.length * 19 + 5);
      return +(r() * 0.3 + 0.55).toFixed(2);
    }
    case 'delete_ratio': {
      const r = sr(commits.length * 23 + 9);
      return +(r() * 0.08 + 0.02).toFixed(3);
    }
    case 'avg_rev': {
      const r = sr(commits.length * 31 + 7);
      return +(r() * 4 + 1.5).toFixed(1);
    }
    case 'max_rev': {
      const r = sr(commits.length * 53 + 11);
      return Math.round(r() * 20 + 5);
    }
    case 'weighted_by_rev': {

      const r = sr(commits.length * 31 + 7);
      const avgRev = r() * 4 + 1.5;
      return Math.round(commits.reduce((s,c)=>s+c.nFiles,0) * avgRev);
    }
    case 'rev_growth': {

      const r = sr(commits.length * 53 + 11);
      return Math.round(commits.length * (r() * 2 + 0.5));
    }
    case 'desc_length':    return +(commits.reduce((s, c) => s + (c.desc ? c.desc.length : 10), 0) / commits.length).toFixed(1);
    case 'anomaly_rate': {
      const r = sr(commits.length * 41 + 13);
      return +(r() * 8 + 3).toFixed(1);
    }
    case 'churn_proxy': {

      const r = sr(commits.length * 61 + 17);
      return +(r() * 3 + 1).toFixed(2);
    }
    case 'bus_factor_proxy': {
      const r = sr(commits.length * 71 + 21);
      return +(r() * 1.5 + 1).toFixed(2);
    }
    case 'avg_hour': {
      return +(commits.reduce((s,c)=>s+(c.date?.getHours()||12),0)/commits.length).toFixed(1);
    }
    case 'weekend_ratio': {
      const we = commits.filter(c=>c.date&&(c.date.getDay()===0||c.date.getDay()===6)).length;
      return +(we/commits.length*100).toFixed(1);
    }
    case 'night_ratio': {
      const nt = commits.filter(c=>c.date&&(c.date.getHours()<6||c.date.getHours()>=22)).length;
      return +(nt/commits.length*100).toFixed(1);
    }
    default: return 0;
  }
}

function computeGroupMetric(days, group, param) {
  const byType = { user: [], depot: [], workspace: [], ext: [] };
  let hasAll = false;
  group.entities.forEach(eid => {
    const ent = TL_ENTITIES.find(e => e.id === eid);
    if (!ent) return;
    if (ent.type === 'all') { hasAll = true; return; }
    if (byType[ent.type]) byType[ent.type].push(ent);
  });

  const anyRestriction = Object.values(byType).some((arr) => arr.length > 0);
  const allCommits = days.flatMap(d => USERS.flatMap(u => d.perUser[u.name]?.commits || []));

  const filtered = (hasAll && !anyRestriction) ? allCommits : allCommits.filter(c => {
    if (byType.user.length && !byType.user.some(e => e.label === c.author)) return false;
    if (byType.depot.length && !byType.depot.some(e => e.depotKey === c.depot)) return false;
    if (byType.workspace.length && !byType.workspace.some(e => e.workspaceKey === c.workspace)) return false;
    if (byType.ext.length) {
      const exts = byType.ext.map(e => e.label.replace('.', ''));
      if (!c.files || !c.files.some(f => exts.includes(f.ext))) return false;
    }
    return true;
  });

  return computeMetricForCommits(filterCommitsByWorkspace(filtered), param, days.length);
}

function tlBuckets() {
  const buckets = {};
  const base = daysForBlock('timeline');
  const srcData = tlYear === 'all'
      ? base
      : base.filter(d => d.date.getFullYear() === +tlYear);

  srcData.forEach(d => {
    let k;
    if (tlGran === 'day') {
      k = d.date.toISOString().slice(0, 10);
    } else if (tlGran === 'week') {
      const t = new Date(d.date); t.setDate(t.getDate() - ((t.getDay() + 6) % 7));
      k = t.toISOString().slice(0, 10);
    } else {
      k = `${d.date.getFullYear()}-${String(d.date.getMonth() + 1).padStart(2, '0')}`;
    }
    if (!buckets[k]) buckets[k] = { days: [] };
    buckets[k].days.push(d);
  });
  return buckets;
}

function tlDisplayLabel(k) {
  if (tlGran === 'month') {
    const [y, m] = k.split('-');
    return ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'][+m-1] + '\'' + y.slice(2);
  }
  const d = new Date(k);
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'short' });
}

let tlGroupEditMode = false;
let tlDragEntity = null;

function renderTlEntityRow() {
  const row = document.getElementById('tlEntityRow');
  if (!row) return;

  const entityHtml = TL_TYPE_ORDER.filter((t) => TL_ENTITIES.some((e) => e.type === t)).map((type) => {
    const entsOfType = TL_ENTITIES.filter((e) => e.type === type);
    const collapsed = !!tlPoolCollapsed[type];
    const itemsHtml = entsOfType.map(e => {
      const grps = tlGroups.filter(g => g.entities.includes(e.id));
      const inGroup = grps.length > 0;
      const color = grps.length === 1 ? grps[0].color : null;
      const multiGrad = grps.length > 1 ? `linear-gradient(90deg, ${grps.map(g=>g.color).join(',')})` : null;
      return `<div class="tl-ent${inGroup ? ' in-group' : ''}${grps.length > 1 ? ' multi-group' : ''}" draggable="true"
        id="tlent_${e.id.replace(/[:/. ]/g,'_')}"
        ondragstart="tlDragStart(event,'${e.id}')"
        ondragend="tlDragEnd(event)"
        style="${color ? `--ent-color:${color}` : ''}${multiGrad ? `border-image:${multiGrad} 1;` : ''}"
        onclick="tlEntityClick('${e.id}')"
        title="${e.label}${grps.length > 1 ? ' (в '+grps.length+' группах)' : ''}">${e.label}${grps.length > 1 ? ` <span style="opacity:.6">×${grps.length}</span>` : ''}</div>`;
    }).join('');
    return `<div class="tl-pool-group">
      <div class="tl-pool-group-hd" onclick="tlTogglePoolGroup('${type}')">
        <span class="tl-pool-group-chevron">${collapsed ? '▶' : '▼'}</span>
        <span class="tl-pool-group-title">${TL_TYPE_LABELS[type] || type}</span>
        <span class="tl-pool-group-count">${entsOfType.length}</span>
      </div>
      ${collapsed ? '' : `<div class="tl-ents-pool">${itemsHtml}</div>`}
    </div>`;
  }).join('');

  const groupsHtml = tlGroups.map((g, gi) => {
    const entLabels = g.entities.map(eid => {
      const e = TL_ENTITIES.find(e => e.id === eid);
      return e ? e.label : eid;
    }).join(' + ');
    return `<div class="tl-group" id="tlgrp_${g.id}"
      ondragover="tlDragOverGroup(event,'${g.id}')"
      ondragleave="tlDragLeaveGroup(event,'${g.id}')"
      ondrop="tlDropOnGroup(event,'${g.id}')"
      style="border-color:${g.color}44;background:${g.color}11;">
      <div class="tl-group-hd">
        <div class="tl-group-dot" style="background:${g.color};cursor:pointer;"
             title="Нажмите чтобы изменить цвет группы"
             onclick="tlPickGroupColor(event,'${g.id}')"></div>
        <input class="tl-group-name" value="${g.label}" onchange="tlRenameGroup('${g.id}',this.value)" style="color:${g.color}">
        <button class="tl-group-del" onclick="tlDelGroup('${g.id}')" title="Удалить группу">×</button>
      </div>
      <div class="tl-group-ents">${g.entities.map(eid => {
      const e = TL_ENTITIES.find(e => e.id === eid);

      return `<span class="tl-ent-tag" style="background:${g.color}22;color:${g.color};border-color:${g.color}44"
          onclick="tlRemoveFromGroup('${g.id}','${eid}')" title="Убрать из группы">${e?.label||eid} ×</span>`;
    }).join('') || '<span style="font-size:10px;color:var(--muted)">пусто — перетащите сущность</span>'}</div>
    </div>`;
  }).join('');

  row.innerHTML = `
    <div class="tl-editor ${tlGroupEditMode ? 'on' : ''}">
      <div class="tl-editor-toggle" onclick="tlToggleEditor()">
        ${tlGroupEditMode ? '▲ Скрыть редактор групп' : '▼ Редактор групп · ' + tlGroups.length + ' групп(ы)'}
      </div>
      <div class="tl-editor-body">
        <div class="tl-editor-hint">Перетащите сущности в группы или нажмите для быстрого добавления/удаления. Каждая группа — одна линия на графике. Одну и ту же сущность можно добавить в несколько групп (например депо — и к одному автору, и к другому). Можно убрать все группы — график станет пустым.</div>
        <div class="tl-ents-pool-groups">${entityHtml || '<span style="font-size:11px;color:var(--muted)">нет доступных сущностей</span>'}</div>
        <div class="tl-groups-row" id="tlGroupsRow">
          ${groupsHtml}
          <div class="tl-group tl-group-add" id="tlGroupAdd"
            ondragover="tlDragOverGroup(event,'__new__')"
            ondragleave="tlDragLeaveGroup(event,'__new__')"
            ondrop="tlDropNew(event)" onclick="tlAddGroup()">
            <div style="font-size:20px;color:var(--muted);margin-bottom:4px">+</div>
            <div style="font-size:10px;color:var(--muted)">Новая группа</div>
          </div>
        </div>
      </div>
    </div>`;
}

function tlToggleEditor() {
  tlGroupEditMode = !tlGroupEditMode;
  renderTlEntityRow();
}

function tlEntityClick(eid) {

  if (tlJustDragged) { tlJustDragged = false; return; }

  const grps = tlGroups.filter(g => g.entities.includes(eid));
  if (grps.length === 1) {
    const g = grps[0];
    g.entities = g.entities.filter(e => e !== eid);
    if (!g.entities.length) tlGroups = tlGroups.filter(x => x.id !== g.id);
    renderTlEntityRow();
    buildTimeline();
  } else if (grps.length === 0) {
    tlAddGroup([eid], true);
  }

}

let tlJustDragged = false;

function tlDragStart(ev, eid) {
  tlDragEntity = eid;
  ev.target.classList.add('dragging');
  if (ev.dataTransfer) { ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', eid); }
}
function tlDragEnd(ev) {
  ev.target.classList.remove('dragging');
  tlJustDragged = true;
  setTimeout(() => { tlJustDragged = false; }, 50);
  tlDragEntity = null;
  document.querySelectorAll('.tl-group.drag-over,.tl-group-add.drag-over').forEach(el => el.classList.remove('drag-over'));
}
function tlDragOverGroup(ev, gid) {
  ev.preventDefault();
  if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
  const el = gid === '__new__' ? document.getElementById('tlGroupAdd') : document.getElementById('tlgrp_' + gid);
  if (el) el.classList.add('drag-over');
}
function tlDragLeaveGroup(ev, gid) {
  const el = gid === '__new__' ? document.getElementById('tlGroupAdd') : document.getElementById('tlgrp_' + gid);
  if (el) el.classList.remove('drag-over');
}

function tlAutoLabelFor(entityIds) {
  const labels = entityIds.map((eid) => TL_ENTITIES.find((e) => e.id === eid)?.label).filter(Boolean);
  return labels.length ? labels.join(' + ') : 'Группа';
}

function tlDropOnGroup(ev, gid) {
  ev.preventDefault();
  const eid = tlDragEntity || (ev.dataTransfer && ev.dataTransfer.getData('text/plain'));
  if (!eid) return;
  const g = tlGroups.find(g => g.id === gid);
  if (!g) return;
  if (!g.entities.includes(eid)) g.entities.push(eid);

  if (g.autoLabel !== false) g.label = tlAutoLabelFor(g.entities);

  tlDragEntity = null;
  renderTlEntityRow();
  buildTimeline();
}

function tlDropNew(ev) {
  ev.preventDefault();
  const eid = tlDragEntity || (ev.dataTransfer && ev.dataTransfer.getData('text/plain'));
  if (!eid) return;
  tlAddGroup([eid], true);
}

function tlAddGroup(entities, fromDrag) {
  const palette = TL_PALETTE;

  const usedColors = new Set(tlGroups.map(g => g.color));
  const color = palette.find(c => !usedColors.has(c)) || palette[tlGroups.length % palette.length];
  const label = entities && entities.length ? tlAutoLabelFor(entities) : 'Группа ' + (tlGroups.length + 1);
  tlGroups.push({ id: 'g' + Date.now() + Math.random().toString(36).slice(2,6), label, color, entities: entities || [], autoLabel: true });
  tlGroups = tlGroups.filter(g => g.entities.length || !fromDrag);
  tlDragEntity = null;
  renderTlEntityRow();
  buildTimeline();
}

function tlDelGroup(gid) {
  tlGroups = tlGroups.filter(g => g.id !== gid);

  renderTlEntityRow();
  buildTimeline();
}

function tlRenameGroup(gid, name) {
  const g = tlGroups.find(g => g.id === gid);
  if (g) { g.label = name; g.autoLabel = false; buildTimeline(); }
}

function tlRemoveFromGroup(gid, eid) {
  const g = tlGroups.find(g => g.id === gid);
  if (!g) return;
  g.entities = g.entities.filter(e => e !== eid);
  if (!g.entities.length) tlGroups = tlGroups.filter(x => x.id !== gid);
  else if (g.autoLabel !== false) g.label = tlAutoLabelFor(g.entities);

  renderTlEntityRow();
  buildTimeline();
}

function buildTlUserBtns() { renderTlEntityRow(); }

let tlColorPopGroupId = null;
function tlPickGroupColor(ev, gid) {
  ev.stopPropagation();
  tlColorPopGroupId = gid;
  const g = tlGroups.find(g => g.id === gid);
  const pop = document.getElementById('tlColorPop');
  const swatchesEl = document.getElementById('tlColorPopSwatches');
  swatchesEl.innerHTML = TL_PALETTE.map(c => `<div class="tl-color-pop-sw${g && g.color===c ? ' sel':''}" style="background:${c}" onclick="tlColorPopApply('${c}')"></div>`).join('');
  document.getElementById('tlColorPopCustom').value = (g && g.color) || '#3fb950';
  const rect = ev.currentTarget.getBoundingClientRect();
  pop.style.left = Math.min(rect.left, window.innerWidth - 210) + 'px';
  pop.style.top = (rect.bottom + 6) + 'px';
  pop.classList.add('on');
}
function tlColorPopApply(color) {
  const g = tlGroups.find(g => g.id === tlColorPopGroupId);
  if (!g) return;
  g.color = color;

  document.querySelectorAll('#tlColorPopSwatches .tl-color-pop-sw').forEach(el => {
    el.classList.toggle('sel', el.style.background === color || rgbToHex(el.style.background) === color);
  });
  renderTlEntityRow();
  buildTimeline();
}
function rgbToHex(rgb) {
  const m = rgb.match(/\d+/g);
  if (!m) return rgb;
  return '#' + m.slice(0,3).map(x => (+x).toString(16).padStart(2,'0')).join('');
}
function tlCloseColorPop() {
  document.getElementById('tlColorPop').classList.remove('on');
  tlColorPopGroupId = null;
}
document.addEventListener('mousedown', (e) => {
  const pop = document.getElementById('tlColorPop');
  if (!pop || !pop.classList.contains('on')) return;
  if (pop.contains(e.target)) return;
  if (e.target.closest('.tl-group-dot')) return;
  tlCloseColorPop();
});

function buildTimeline() {
  const lpWrap = document.getElementById('lpWrap_timeline');
  if (lpWrap) lpWrap.innerHTML = localPeriodControlHtml('timeline', 'buildTimeline');
  const param = document.getElementById('tlParam').value;
  const paramX = document.getElementById('tlParamX') ? document.getElementById('tlParamX').value : 'time';
  const cfg = TL_PARAMS[param];
  const cfgX = paramX !== 'time' ? TL_PARAMS[paramX] : null;
  const yearLabel = tlYear === 'all' ? 'за всё время' : tlYear;
  const activeGroups = tlGroups.filter(g => g.entities.length);
  const yStepEl = document.getElementById('tlYStep');
  const yStep = yStepEl && yStepEl.value !== 'auto' ? +yStepEl.value : null;
  const xStepEl = document.getElementById('tlXStep');
  const xStep = xStepEl && xStepEl.value !== 'auto' ? +xStepEl.value : null;

  document.getElementById('tlTitle').textContent = cfgX ? `${cfg.label} vs ${cfgX.label}` : cfg.label;

  if (!activeGroups.length) {
    document.getElementById('tlSub').textContent = 'нет выбранных групп — добавьте сущность в редакторе ниже';
  } else {
    document.getElementById('tlSub').textContent =
        activeGroups.map(g => g.label).join(' vs ') +
        (cfgX ? '' : ' · ' + (tlGran === 'day' ? 'по дням' : tlGran === 'week' ? 'по неделям' : 'по месяцам')) +
        ' · ' + yearLabel;
  }

  if (tlChartInst) { tlChartInst.destroy(); tlChartInst = null; }

  if (!activeGroups.length) {
    tlChartInst = new Chart('tlChart', {
      type: 'line',
      data: { labels: [], datasets: [] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: themeColor('border2') }, ticks: { color: themeColor('muted') } },
          y: { grid: { color: themeColor('border') }, ticks: { color: themeColor('muted') } }
        }
      }
    });
    document.getElementById('tlLegend').innerHTML = '';
    return;
  }

  if (cfgX) {
    const buckets = tlBuckets();
    const sortedKeys = Object.keys(buckets).sort();

    const datasets = activeGroups.map(g => ({
      label: g.label,
      data: sortedKeys.map(k => ({
        x: computeGroupMetric(buckets[k].days, g, paramX),
        y: computeGroupMetric(buckets[k].days, g, param),
      })),
      backgroundColor: ha(g.color, 0.55),
      borderColor: g.color,
      pointRadius: 4,
      pointHoverRadius: 6,
      showLine: false,
    }));

    tlChartInst = new Chart('tlChart', {
      type: 'scatter',
      data: { datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: ${cfgX.label} ${ctx.parsed.x}${cfgX.unit} · ${cfg.label} ${ctx.parsed.y}${cfg.unit}`,
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: cfgX.label, color: themeColor('muted'), font: { size: 11 } },
            grid: { color: themeColor('border2') },
            ticks: { color: themeColor('muted'), callback: v => v + cfgX.unit, stepSize: xStep || undefined },
            ...(xStep ? { beginAtZero: true } : {})
          },
          y: {
            title: { display: true, text: cfg.label, color: themeColor('muted'), font: { size: 11 } },
            grid: { color: themeColor('border') },
            ticks: { color: themeColor('muted'), callback: v => v + cfg.unit, stepSize: yStep || undefined },
            ...(yStep ? { beginAtZero: true } : {})
          }
        }
      }
    });

    document.getElementById('tlLegend').innerHTML = activeGroups.map(g => {
      const entLabels = g.entities.map(eid => {
        const e = TL_ENTITIES.find(x => x.id === eid); return e ? e.label : eid;
      }).join('+');
      return `<div class="tl-legend-item">
        <div class="tl-legend-dot" style="background:${g.color}"></div>
        <span style="color:${g.color}">${g.label}</span>
        ${g.entities.length > 1 || g.label !== entLabels ? `<span style="color:var(--muted);font-size:10px">(${entLabels})</span>` : ''}
      </div>`;
    }).join('');
    return;
  }

  const buckets = tlBuckets();
  const sortedKeys = Object.keys(buckets).sort();
  const displayLabels = sortedKeys.map(tlDisplayLabel);

  const datasets = activeGroups.map(g => ({
    label: g.label,
    data: sortedKeys.map(k => computeGroupMetric(buckets[k].days, g, param)),
    borderColor: g.color,
    backgroundColor: ha(g.color, 0.08),
    borderWidth: 2,
    pointRadius: 0,
    pointHoverRadius: 0,
    tension: 0.3,
    fill: false,
  }));

  tlChartInst = new Chart('tlChart', {
    type: 'line',
    data: { labels: displayLabels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y}${cfg.unit}`,
          }
        }
      },
      scales: {
        x: {
          grid: { color: themeColor('border2') },
          ticks: { color: themeColor('muted'), maxRotation: 0, maxTicksLimit: 14 }
        },
        y: {
          grid: { color: themeColor('border') },
          ticks: { color: themeColor('muted'), callback: v => v + cfg.unit, stepSize: yStep || undefined },
          ...(yStep ? { beginAtZero: true } : {})
        }
      }
    }
  });

  document.getElementById('tlLegend').innerHTML = activeGroups.map((g, i) => {
    const entLabels = g.entities.map(eid => {
      const e = TL_ENTITIES.find(x => x.id === eid); return e ? e.label : eid;
    }).join('+');
    return `<div class="tl-legend-item">
      <div class="tl-legend-dot" style="background:${g.color}"></div>
      <span style="color:${g.color}">${g.label}</span>
      ${g.entities.length > 1 || g.label !== entLabels ? `<span style="color:var(--muted);font-size:10px">(${entLabels})</span>` : ''}
    </div>`;
  }).join('');
}