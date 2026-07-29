

let currentModalUser = null;
let currentModalTab = 'overview';

let currentEntityModal = null;
let currentEntityModalTab = 'overview';
let entityFilesLimit = 10;
let entityFilesSortBy = 'count';
let entityTimeGran = 'hour';

function entityModalCommits() {
  if (!currentEntityModal) return [];
  const { type, key } = currentEntityModal;
  const all = typeof depotAllCommits === 'function' ? depotAllCommits('cards', daysForBlock('cards')) : [];
  return all.filter((c) => (type === 'workspace' ? c.workspace === key : c.depot === key));
}

function openEntityModal(entityType, entityKey, displayName, color) {
  currentEntityModal = { type: entityType, key: entityKey, displayName, color };
  const bg = typeof shadeTowardBlack === 'function' ? shadeTowardBlack(color, 0.76) : color + '22';
  document.getElementById('emAv').style.cssText = `background:${bg};color:${color}`;
  document.getElementById('emAv').textContent = displayName[0].toUpperCase();
  document.getElementById('emName').innerHTML = `<span style="color:${color}">${displayName}</span>`;
  const s = computeLiveEntityStats(entityType, entityKey, 'cards');
  document.getElementById('emSub').textContent = `${entityType === 'depot' ? 'Депо' : 'Воркспейс'} · ${s.commits.toLocaleString('ru')} сабмитов · ${s.share}% всей активности`;
  setEntityModalTab('overview');
  document.getElementById('entityModal').classList.add('on');
  document.body.style.overflow = 'hidden';
}

function closeEntityModal() {
  document.getElementById('entityModal').classList.remove('on');
  document.body.style.overflow = '';
}

function setEntityModalTab(tab) {
  currentEntityModalTab = tab;
  document.querySelectorAll('#entityModal .modal-tab').forEach((b) => {
    b.classList.toggle('on', b.getAttribute('onclick') === `setEntityModalTab('${tab}')`);
  });
  document.querySelectorAll('#entityModal .modal-panel').forEach((p) => p.classList.remove('on'));
  document.getElementById('empanel-' + tab).classList.add('on');
  renderEntityModalTab(tab);
}

function renderEntityModalTab(tab) {
  if (!currentEntityModal) return;
  const { type, key, color } = currentEntityModal;
  const commits = entityModalCommits();
  const s = computeLiveEntityStats(type, key, 'cards');

  if (tab === 'overview') {
    const hourCounts = Array(24).fill(0);
    const dowCounts = Array(7).fill(0);
    const extCounts = {};
    commits.forEach((c) => {
      hourCounts[c.date.getHours()]++;
      dowCounts[c.date.getDay()]++;
      c.files.forEach((f) => { extCounts[f.ext] = (extCounts[f.ext] || 0) + 1; });
    });
    const DOW_RU_FULL = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    const favHour = commits.length ? hourCounts.indexOf(Math.max(...hourCounts)) : 0;
    const favDow = commits.length ? DOW_RU_FULL[dowCounts.indexOf(Math.max(...dowCounts))] : '—';
    const favExtEntry = Object.entries(extCounts).sort((a, b) => b[1] - a[1])[0];
    const favExt = favExtEntry ? favExtEntry[0] : '—';

    const sortedByDate = commits.slice().sort((a, b) => a.date - b.date);
    let maxPauseDays = 0;
    for (let i = 1; i < sortedByDate.length; i++) {
      maxPauseDays = Math.max(maxPauseDays, (sortedByDate[i].date - sortedByDate[i - 1].date) / 86400000);
    }

    const stats = [
      { v: s.commits.toLocaleString('ru'), l: 'Сабмитов' },
      { v: s.files.toLocaleString('ru'), l: 'Файлов изменено' },
      { v: s.vol.toFixed(2) + ' ГБ', l: 'Суммарный объём' },
      { v: s.avgFiles, l: 'Ср. файлов / сабмит' },
      { v: s.avgGap + ' ч', l: 'Ср. интервал между сабмитами' },
      { v: s.anomalies, l: 'Аномальных сабмитов' },
      { v: s.streak, l: 'Макс. серия (дней)' },
      { v: s.weekendPct + '%', l: 'Сабмитов в выходные' },
      { v: s.gbPerCommit, l: 'ГБ / сабмит' },
      { v: s.newRatio + '%', l: 'Новых файлов (rev=1)' },
    ];
    const grid = stats.map((st) => `<div class="modal-stat"><div class="modal-stat-v" style="color:${color}">${st.v}</div><div class="modal-stat-l">${st.l}</div></div>`).join('');

    let compositionHtml = '';
    if (type === 'depot') {
      const byAuthor = {};
      commits.forEach((c) => { byAuthor[c.author] = (byAuthor[c.author] || 0) + 1; });
      const totalC = commits.length || 1;
      const authorRows = USERS.filter((u) => byAuthor[u.name])
        .sort((a, b) => (byAuthor[b.name] || 0) - (byAuthor[a.name] || 0))
        .map((u) => {
          const pct = ((byAuthor[u.name] / totalC) * 100).toFixed(0);
          return `<div class="modal-stat"><div class="modal-stat-v" style="color:${u.color}">${pct}%</div><div class="modal-stat-l">${u.name} · ${byAuthor[u.name]} сабмитов</div></div>`;
        }).join('');
      compositionHtml = `
        <div class="modal-section">
          <div class="modal-sec-title">Кто пишет в это депо</div>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">${authorRows || '<div style="color:var(--muted);font-size:12px">Нет данных</div>'}</div>
        </div>`;
    }

    document.getElementById('empanel-overview').innerHTML = `
      <div class="modal-section">
        <div class="modal-sec-title">Ключевые показатели</div>
        <div class="modal-stat-grid" style="grid-template-columns:repeat(3,1fr)">${grid}</div>
      </div>
      <div class="modal-section">
        <div class="modal-sec-title">Паттерны активности</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div class="modal-stat"><div class="modal-stat-v">${String(favHour).padStart(2, '0')}:00</div><div class="modal-stat-l">Пиковый час дня</div></div>
          <div class="modal-stat"><div class="modal-stat-v">${favDow}</div><div class="modal-stat-l">Пиковый день недели</div></div>
          <div class="modal-stat"><div class="modal-stat-v">.${favExt}</div><div class="modal-stat-l">Наиболее частый тип</div></div>
          <div class="modal-stat"><div class="modal-stat-v">${Math.round(maxPauseDays)} дн.</div><div class="modal-stat-l">Макс. пауза без сабмитов</div></div>
        </div>
      </div>${compositionHtml}`;
  }

  if (tab === 'records') {
    let biggest = null, mostFiles = null, mostTypes = null;
    commits.forEach((c) => {
      if (!biggest || c.sizeGB > biggest.sizeGB) biggest = c;
      if (!mostFiles || c.nFiles > mostFiles.nFiles) mostFiles = c;
      const typeCount = new Set(c.files.map((f) => f.ext)).size;
      if (!mostTypes || typeCount > mostTypes.typeCount) mostTypes = { cl: c.cl, typeCount };
    });
    const weekCounts = {};
    commits.forEach((c) => {
      const d = new Date(c.date);
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      const k = d.toISOString().slice(0, 10);
      weekCounts[k] = (weekCounts[k] || 0) + 1;
    });
    const bestWeek = Object.entries(weekCounts).sort((a, b) => b[1] - a[1])[0];

    const actionCounts = {};
    commits.forEach((c) => c.files.forEach((f) => { actionCounts[f.action] = (actionCounts[f.action] || 0) + 1; }));
    const topAction = Object.entries(actionCounts).sort((a, b) => b[1] - a[1])[0];
    const ACTION_RU = { edit: 'изменение (edit)', add: 'добавление (add)', delete: 'удаление (delete)' };

    const activeDays = new Set(commits.map((c) => c.date.toISOString().slice(0, 10))).size;
    const allDaysInScope = daysForBlock('cards').length || 1;
    const coveragePct = ((activeDays / allDaysInScope) * 100).toFixed(0);

    const records = [];
    if (biggest) records.push({ label: 'Самый объёмный сабмит', value: biggest.sizeGB.toFixed(2) + ' ГБ', sub: `${biggest.cl} · ${biggest.nFiles} файлов` });
    if (mostFiles) records.push({ label: 'Рекорд файлов за раз', value: mostFiles.nFiles.toLocaleString('ru'), sub: mostFiles.cl });
    if (mostTypes) records.push({ label: 'Наибольшее число типов в сабмите', value: mostTypes.typeCount + ' типов', sub: mostTypes.cl });
    if (bestWeek) records.push({ label: 'Лучшая неделя', value: bestWeek[0], sub: `~${bestWeek[1]} сабмитов за неделю` });
    if (topAction) records.push({ label: 'Самое частое действие', value: ACTION_RU[topAction[0]] || topAction[0], sub: `${topAction[1].toLocaleString('ru')} файлов` });
    records.push({ label: 'Охват периода', value: coveragePct + '%', sub: `${activeDays} из ${allDaysInScope} дней с активностью` });
    records.push({ label: 'Макс. непрерывная серия', value: s.streak + ' дней', sub: 'активных дней подряд' });
    records.push({ label: 'Ср. пауза между сабмитами', value: s.avgGap + ' ч', sub: 'медиана' });

    const rows = records.map((r, i) => `<tr>
      <td>${i + 1}</td>
      <td style="font-size:12px;font-family:var(--font)">${r.label}</td>
      <td style="color:${color};font-weight:700">${r.value}</td>
      <td>${r.sub}</td>
    </tr>`).join('');
    document.getElementById('empanel-records').innerHTML = `
      <div class="modal-section">
        <div class="modal-sec-title">Рекорды</div>
        <table class="modal-rank-table">
          <thead><tr><td></td><td style="color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.06em">Показатель</td><td style="color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.06em">Значение</td><td style="color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.06em">Детали</td></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  if (tab === 'files') {
    const fileStats = {};
    commits.forEach((c) => c.files.forEach((f) => {
      const name = f.path.split('/').pop();
      if (!fileStats[name]) fileStats[name] = { count: 0, sizeKB: 0, maxRev: 0 };
      fileStats[name].count++;
      fileStats[name].sizeKB += parseInt(f.size) || 0;
      const revNum = parseInt(String(f.rev || '#0').replace('#', '')) || 0;
      fileStats[name].maxRev = Math.max(fileStats[name].maxRev, revNum);
    }));

    const sortFns = {
      count: (s) => s.count,
      size: (s) => s.sizeKB,
      rev: (s) => s.maxRev,
    };
    const sortFn = sortFns[entityFilesSortBy] || sortFns.count;
    const sorted = Object.entries(fileStats).sort((a, b) => sortFn(b[1]) - sortFn(a[1]));

    const maxPossible = Math.max(1, sorted.length);
    entityFilesLimit = Math.max(1, Math.min(entityFilesLimit, maxPossible));

    const top = sorted.slice(0, entityFilesLimit);
    const maxV = top.length ? sortFn(top[0][1]) : 1;
    const valueLabel = { count: 'Изменений', size: 'Объём', rev: 'Макс. ревизия' }[entityFilesSortBy];
    const formatV = (st) => {
      if (entityFilesSortBy === 'size') return st.sizeKB > 1e6 ? (st.sizeKB / 1e6).toFixed(2) + ' ГБ' : (st.sizeKB / 1000).toFixed(1) + ' МБ';
      if (entityFilesSortBy === 'rev') return '#' + st.maxRev;
      return st.count.toLocaleString('ru');
    };

    const rows = top.map(([file, st], i) => `<tr>
      <td>${i + 1}</td>
      <td style="font-family:var(--mono)">${file}</td>
      <td style="width:140px;padding:7px 10px;"><div class="prg2"><div class="prg2-f" style="width:${(sortFn(st) / maxV * 100).toFixed(0)}%;background:${color}"></div></div></td>
      <td>${formatV(st)}</td>
    </tr>`).join('');

    document.getElementById('empanel-files').innerHTML = `
      <div class="modal-section">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px">
          <div class="modal-sec-title" style="margin-bottom:0">Топ файлов</div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <select class="dsel" onchange="setEntityFilesSortBy(this.value)">
              <option value="count" ${entityFilesSortBy === 'count' ? 'selected' : ''}>По числу изменений</option>
              <option value="size" ${entityFilesSortBy === 'size' ? 'selected' : ''}>По суммарному объёму</option>
              <option value="rev" ${entityFilesSortBy === 'rev' ? 'selected' : ''}>По макс. ревизии</option>
            </select>
            <label style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--muted)">
              Топ
              <input type="number" id="entityFilesLimitInput" min="1" max="${maxPossible}" value="${entityFilesLimit}" onchange="setEntityFilesLimit(this.value)" style="width:52px;background:var(--s1);border:1px solid var(--border);border-radius:4px;color:var(--text);padding:3px 5px;font-family:var(--mono)">
            </label>
          </div>
        </div>
        <table class="modal-rank-table">
          <thead><tr><td></td><td>Файл</td><td></td><td>${valueLabel}</td></tr></thead>
          <tbody>${rows || '<tr><td colspan="4" style="color:var(--muted);padding:10px">Нет данных</td></tr>'}</tbody>
        </table>
      </div>`;
  }

  if (tab === 'time') {
    const GRAN_META = {
      hour: { title: 'По часам дня', getLabels: () => Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0')), bucketOf: (c) => c.date.getHours() },
      dow: { title: 'По дням недели', getLabels: () => ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'], bucketOf: (c) => c.date.getDay() },
      month: { title: 'По месяцам', getLabels: () => ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'], bucketOf: (c) => c.date.getMonth() },
      year: { title: 'По годам', getLabels: null, bucketOf: null },
    };

    let labels, values;
    if (entityTimeGran === 'year') {
      const years = [...new Set(commits.map((c) => c.date.getFullYear()))].sort();
      const counts = {};
      commits.forEach((c) => { const y = c.date.getFullYear(); counts[y] = (counts[y] || 0) + 1; });
      labels = years.length ? years.map(String) : ['—'];
      values = years.length ? years.map((y) => counts[y] || 0) : [0];
    } else {
      const meta = GRAN_META[entityTimeGran];
      labels = meta.getLabels();
      values = Array(labels.length).fill(0);
      commits.forEach((c) => { values[meta.bucketOf(c)]++; });
    }

    const maxV = Math.max(...values, 1);
    const bars = values.map((v, i) => {
      const ht = Math.max(4, Math.round(v / maxV * 150));
      return `<div style="display:flex;flex-direction:column;align-items:center;gap:3px;flex:1;min-width:0">
        <div style="width:100%;height:${ht}px;background:${color}88;border:1px solid ${color};border-radius:2px;min-height:4px" title="${v}"></div>
        <div style="font-size:9px;color:var(--muted);font-family:var(--mono);white-space:nowrap">${labels[i]}</div>
      </div>`;
    }).join('');

    document.getElementById('empanel-time').innerHTML = `
      <div class="modal-section">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px">
          <div class="modal-sec-title" style="margin-bottom:0">${GRAN_META[entityTimeGran].title}</div>
          <select class="dsel" onchange="setEntityTimeGran(this.value)">
            <option value="hour" ${entityTimeGran === 'hour' ? 'selected' : ''}>Часы дня</option>
            <option value="dow" ${entityTimeGran === 'dow' ? 'selected' : ''}>Дни недели</option>
            <option value="month" ${entityTimeGran === 'month' ? 'selected' : ''}>Месяцы</option>
            <option value="year" ${entityTimeGran === 'year' ? 'selected' : ''}>Годы</option>
          </select>
        </div>
        <div style="display:flex;gap:4px;align-items:flex-end;height:170px">${bars}</div>
      </div>`;
  }
}

function setEntityFilesLimit(value) {
  let n = parseInt(value, 10);
  if (isNaN(n) || n < 1) n = 1;
  entityFilesLimit = n;
  renderEntityModalTab('files');
}

function setEntityFilesSortBy(value) {
  entityFilesSortBy = value;
  renderEntityModalTab('files');
}

function setEntityTimeGran(value) {
  entityTimeGran = value;
  renderEntityModalTab('time');
}

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeEntityModal(); });

function openAuthorModal(username) {
  const fd = computeFactsData();
  const u = fd ? fd.users.find(x => x.name === username) : null;
  if (!u) return;
  currentModalUser = username;
  document.getElementById('mAv').style.cssText = `background:${u.bg};color:${u.color}`;
  document.getElementById('mAv').textContent = username[0].toUpperCase();
  document.getElementById('mName').innerHTML = `<span style="color:${u.color}">${username}</span>`;
  document.getElementById('mSub').textContent = `${u.commits} сабмитов · ${u.pct.toFixed(1)}% всей активности · ${fmtDateRu(fd.first.date)} → ${fmtDateRu(fd.last.date)}`;
  setModalTab('overview');
  document.getElementById('authorModal').classList.add('on');
  document.body.style.overflow = 'hidden';
}

function closeAuthorModal() {
  document.getElementById('authorModal').classList.remove('on');
  document.body.style.overflow = '';
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAuthorModal(); });

function setModalTab(tab) {
  currentModalTab = tab;
  document.querySelectorAll('.modal-tab').forEach((b, i) => {
    b.classList.toggle('on', b.getAttribute('onclick') === `setModalTab('${tab}')`);
  });
  document.querySelectorAll('.modal-panel').forEach(p => p.classList.remove('on'));
  document.getElementById('mpanel-' + tab).classList.add('on');
  renderModalTab(tab);
}

const AUTHOR_TIME_GRAN_META = {
  hour: { title: 'По часам дня', field: 'Hour', getLabels: () => Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0')), bucketOf: (c) => c.date.getHours() },
  dow: { title: 'По дням недели', field: 'Weekday', getLabels: () => WEEKDAY_RU, bucketOf: (c) => c.date.getDay() },
  month: { title: 'По месяцам', field: 'Month', getLabels: () => ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'], bucketOf: (c) => c.date.getMonth() },
  year: { title: 'По годам', field: 'Year', getLabels: null, bucketOf: null },
};

function computeAuthorTimeBuckets(u, gran) {
  if (gran === 'year') {
    const years = [...new Set(u.list.map((c) => c.date.getFullYear()))].sort();
    const counts = {};
    u.list.forEach((c) => { const y = c.date.getFullYear(); counts[y] = (counts[y] || 0) + 1; });
    return { labels: years.length ? years.map(String) : ['—'], values: years.length ? years.map((y) => counts[y] || 0) : [0] };
  }
  const meta = AUTHOR_TIME_GRAN_META[gran];
  const labels = meta.getLabels();
  const values = Array(labels.length).fill(0);
  u.list.forEach((c) => { values[meta.bucketOf(c)]++; });
  return { labels, values };
}

function renderModalTab(tab) {
  const fd = computeFactsData();
  const u = fd.users.find(x => x.name === currentModalUser);
  const color = u.color;
  const anomsAll = typeof computeAnomalies === 'function' ? computeAnomalies() : [];
  const myAnoms = anomsAll.filter(r => r.commit.author === currentModalUser);

  if (tab === 'overview') {
    const stats = [
      { v: u.commits.toLocaleString('ru'), l: 'Сабмитов' },
      { v: u.files.toLocaleString('ru'), l: 'Файлов изменено' },
      { v: u.vol.toFixed(2) + ' ГБ', l: 'Суммарный объём' },
      { v: u.avgFiles.toFixed(1), l: 'Ср. файлов / сабмит' },
      { v: u.avgGap.toFixed(1) + ' ч', l: 'Ср. интервал между сабмитами' },
      { v: myAnoms.length, l: 'Аномальных сабмитов' },
      { v: u.streak, l: 'Макс. серия (дней)' },
      { v: u.weekendPct.toFixed(0) + '%', l: 'Сабмитов в выходные' },
      { v: u.avgSizeMB.toFixed(1) + ' МБ', l: 'Ср. размер сабмита' },
      { v: u.medSizeMB.toFixed(1) + ' МБ', l: 'Медиана размера' },
      { v: u.avgRev.toFixed(1), l: 'Ср. ревизий' },
      { v: u.newRatioPct.toFixed(1) + '%', l: 'Доля новых файлов' },
      { v: u.workspaces.length ? u.workspaces.join(' · ') : '—', l: 'Воркспейсы' },
    ];
    const grid = stats.map(st => `<div class="modal-stat"><div class="modal-stat-v" style="color:${color}">${st.v}</div><div class="modal-stat-l">${st.l}</div></div>`).join('');
    document.getElementById('mpanel-overview').innerHTML = `
      <div class="modal-section">
        <div class="modal-sec-title">Ключевые показатели</div>
        <div class="modal-stat-grid" style="grid-template-columns:repeat(4,1fr)">${grid}</div>
      </div>
      <div class="modal-section">
        <div class="modal-sec-title">Паттерны активности</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div class="modal-stat"><div class="modal-stat-v">${String(u.favHour).padStart(2,'0')}:00</div><div class="modal-stat-l">Пиковый час дня</div></div>
          <div class="modal-stat"><div class="modal-stat-v">${WEEKDAY_RU[u.favDow]}</div><div class="modal-stat-l">Пиковый день недели</div></div>
          <div class="modal-stat"><div class="modal-stat-v">${u.favExt?'.'+u.favExt:'—'}</div><div class="modal-stat-l">Наиболее частый тип</div></div>
          <div class="modal-stat"><div class="modal-stat-v">${u.maxPauseDays.toFixed(1)} дн.</div><div class="modal-stat-l">Макс. пауза без сабмитов</div></div>
        </div>
      </div>`;
  }

  if (tab === 'records') {
    const list = u.list;
    const bySize = [...list].sort((a,b)=>b.sizeGB-a.sizeGB)[0];
    const byFiles = [...list].sort((a,b)=>b.nFiles-a.nFiles)[0];
    const byDescLen = [...list].sort((a,b)=>b.desc.length-a.desc.length)[0];
    const byDiverse = [...list].sort((a,b)=>new Set(b.files.map(f=>f.ext)).size-new Set(a.files.map(f=>f.ext)).size)[0];
    let maxRev=0, maxRevFile=null;
    list.forEach(c=>c.files.forEach(f=>{ const rv=parseRev(f.rev); if(rv>maxRev){maxRev=rv;maxRevFile=f;} }));
    const records = [
      { label:'Самый объёмный сабмит', value:bySize.totalSize, sub:bySize.cl+' · '+fmtDateRu(bySize.date) },
      { label:'Больше всего файлов за раз', value:fmtNum(byFiles.nFiles)+' файлов', sub:byFiles.cl },
      { label:'Самое длинное описание', value:byDescLen.desc.length+' симв.', sub:byDescLen.cl },
      { label:'Самый разнообразный сабмит', value:new Set(byDiverse.files.map(f=>f.ext)).size+' типов', sub:byDiverse.cl },
      { label:'Максимальная ревизия файла', value: maxRevFile?maxRevFile.rev:'—', sub: maxRevFile?maxRevFile.path.split('/').pop():'' },
      { label:'Аномальных сабмитов', value: myAnoms.length, sub: (myAnoms.length/u.commits*100).toFixed(1)+'% от сабмитов автора' },
    ];
    const rows = records.map((r, i) => `<tr>
      <td>${i + 1}</td>
      <td style="font-size:12px;font-family:var(--font)">${r.label}</td>
      <td style="color:${color};font-weight:700">${r.value}</td>
      <td>${r.sub}</td>
    </tr>`).join('');
    document.getElementById('mpanel-records').innerHTML = `
      <div class="modal-section">
        <div class="modal-sec-title">Персональные рекорды</div>
        <table class="modal-rank-table">
          <thead><tr><td></td><td style="color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.06em">Показатель</td><td style="color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.06em">Значение</td><td style="color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.06em">Детали</td></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  if (tab === 'files') {
    const topN = window.authorFilesTopN || 20;
    const shown = u.topFiles.slice(0, topN);
    const maxC = shown[0]?.count || 1;
    const rows = shown.map((f, i) => `<tr>
      <td>${i + 1}</td>
      <td style="font-family:var(--mono)">${f.file}</td>
      <td style="width:140px;padding:7px 10px;">
        <div class="prg2"><div class="prg2-f" style="width:${(f.count/maxC*100).toFixed(0)}%;background:${color}"></div></div>
      </td>
      <td>${f.count}</td>
    </tr>`).join('');
    document.getElementById('mpanel-files').innerHTML = `
      <div class="modal-section">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
          <div class="modal-sec-title" style="margin-bottom:0">Топ файлов по числу изменений</div>
          <div style="display:flex;align-items:center;gap:8px;">
            <label style="font-size:11px;color:var(--muted);display:flex;align-items:center;gap:6px;">Показать топ:
              <input type="number" id="authorFilesTopNInput" value="${topN}" min="1"
                     onblur="setAuthorFilesTopN(this.value, ${u.topFiles.length})" onkeydown="if(event.key==='Enter')this.blur()"
                     style="width:55px;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:11px;font-family:var(--mono);outline:none;">
            </label>
            <span style="font-size:11px;color:var(--muted)">из ${u.topFiles.length}</span>
            <button class="csv-export-btn" onclick="exportCurrentAuthorFilesToCSV()">⇩ CSV</button>
          </div>
        </div>
        <div class="scroll-box">
          <table class="modal-rank-table">
            <thead><tr><td></td><td>Файл</td><td></td><td>Изменений</td></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div style="font-size:11px;color:var(--muted);margin-top:10px">Только сабмиты автора ${currentModalUser}</div>
      </div>`;
  }

  if (tab === 'time') {
    const gran = window.authorTimeGran || 'hour';
    const { labels, values } = computeAuthorTimeBuckets(u, gran);
    const maxV = Math.max(...values, 1);
    const bars = values.map((v, i) => {
      const ht = Math.max(4, Math.round(v / maxV * 150));
      return `<div style="display:flex;flex-direction:column;align-items:center;gap:3px;flex:1;min-width:0">
        <div style="width:100%;height:${ht}px;background:${color}88;border:1px solid ${color};border-radius:2px;min-height:4px" title="${v}"></div>
        <div style="font-size:9px;color:var(--muted);font-family:var(--mono);white-space:nowrap">${labels[i]}</div>
      </div>`;
    }).join('');
    document.getElementById('mpanel-time').innerHTML = `
      <div class="modal-section">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px">
          <div class="modal-sec-title" style="margin-bottom:0">${AUTHOR_TIME_GRAN_META[gran].title}</div>
          <div style="display:flex;gap:8px;align-items:center;">
            <select class="dsel" onchange="setAuthorTimeGran(this.value)">
              <option value="hour" ${gran === 'hour' ? 'selected' : ''}>Часы дня</option>
              <option value="dow" ${gran === 'dow' ? 'selected' : ''}>Дни недели</option>
              <option value="month" ${gran === 'month' ? 'selected' : ''}>Месяцы</option>
              <option value="year" ${gran === 'year' ? 'selected' : ''}>Годы</option>
            </select>
            <button class="csv-export-btn" onclick="exportCurrentAuthorActivityToCSV()">⇩ CSV</button>
          </div>
        </div>
        <div style="display:flex;gap:4px;align-items:flex-end;height:170px">${bars}</div>
      </div>`;
  }
}

function setAuthorTimeGran(value) {
  window.authorTimeGran = value;
  renderModalTab('time');
}

function setAuthorFilesTopN(value, total) {
  let n = parseInt(value, 10);
  if (isNaN(n) || n < 1) n = total ? 1 : 0;
  if (n > total) n = total;
  window.authorFilesTopN = n;
  renderModalTab('files');
}