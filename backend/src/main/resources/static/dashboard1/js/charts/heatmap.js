

const YEARS = [...new Set(DAY_DATA.map((d) => d.date.getFullYear()))].sort();
let selectedYear = YEARS[YEARS.length - 1];

function shiftYear(delta) {
  const currentIndex = YEARS.indexOf(selectedYear);
  const nextIndex = currentIndex + delta;
  if (nextIndex < 0 || nextIndex >= YEARS.length) return;

  selectedYear = YEARS[nextIndex];
  selectedDayKey = null;
  document.getElementById('drill').classList.remove('on');
  buildCal();
}

function renderYearSwitch() {
  document.getElementById('yrLabel').textContent = selectedYear;
  const i = YEARS.indexOf(selectedYear);
  document.getElementById('yrPrev').classList.toggle('disabled', i <= 0);
  document.getElementById('yrNext').classList.toggle('disabled', i >= YEARS.length - 1);
}

const ISCALE = ['#161b22', '#0d3522', '#196127', '#239a3b', '#3fb950', '#56d364'];

function uColor(dayObj, active, useFiles) {
  const authorsWithCommits = USERS.filter((u) => active.has(u.name) && depotCountFor('heatmap', dayObj, u.name) > 0);
  if (!authorsWithCommits.length) return themeColor('s1');
  const countFor = (u) => {
    const commits = depotCommitsFor('heatmap', dayObj, u.name);
    return useFiles ? commits.reduce((sum, c) => sum + c.nFiles, 0) : commits.length;
  };
  if (authorsWithCommits.length === 1) {
    const only = authorsWithCommits[0];
    const divisor = useFiles ? 40 : 8;
    const intensity = Math.min(0.9, 0.2 + (countFor(only) / divisor) * 0.7);
    return ha(only.color, intensity);
  }
  return blend(authorsWithCommits.map((u) => u.color));
}

function heatmapDayCommits(dayObj) {
  const out = [];
  USERS.filter((u) => activeUsers.has(u.name)).forEach((u) => {
    depotCommitsFor('heatmap', dayObj, u.name).forEach((c) => out.push(c));
  });
  return out;
}

function heatmapVisibleDays() {
  return daysForBlock('heatmap').filter((d) => d.date.getFullYear() === selectedYear);
}

function dimensionColor(dayObj, dimension, useFiles) {
  const commits = heatmapDayCommits(dayObj);
  const keyOf = (c) => (dimension === 'depot' ? c.depot : c.workspace);
  const colorOf = (key) => (dimension === 'depot' ? getDepotColor(key) : getWorkspaceColor(key));

  const keysPresent = [...new Set(commits.map(keyOf).filter(Boolean))];
  if (!keysPresent.length) return themeColor('s1');
  if (keysPresent.length === 1) {
    const only = keysPresent[0];
    const matching = commits.filter((c) => keyOf(c) === only);
    const count = useFiles ? matching.reduce((sum, c) => sum + c.nFiles, 0) : matching.length;
    const divisor = useFiles ? 40 : 8;
    const intensity = Math.min(0.9, 0.2 + (count / divisor) * 0.7);
    return ha(colorOf(only), intensity);
  }
  return blend(keysPresent.map(colorOf));
}

const ACTION_LIST = ['edit', 'add', 'delete'];
const ACTION_LABELS = { edit: 'Изменение', add: 'Добавление', delete: 'Удаление' };
const ACTION_COLORS = { edit: '#58a6ff', add: '#3fb950', delete: '#f85149' };
let hmActionActive = new Set(ACTION_LIST);

const ACTION_WORD_FORMS = {
  edit: ['изменение', 'изменения', 'изменений'],
  add: ['добавление', 'добавления', 'добавлений'],
  delete: ['удаление', 'удаления', 'удалений'],
};

function pluralizeRu(count, forms) {
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  let idx;
  if (n > 10 && n < 20) idx = 2;
  else if (n1 > 1 && n1 < 5) idx = 1;
  else if (n1 === 1) idx = 0;
  else idx = 2;
  return `${count} ${forms[idx]}`;
}

function actionColor(dayObj) {
  const commits = heatmapDayCommits(dayObj);
  const fileCountByAction = {};
  commits.forEach((c) => c.files.forEach((f) => {
    if (hmActionActive.has(f.action)) fileCountByAction[f.action] = (fileCountByAction[f.action] || 0) + 1;
  }));
  const present = Object.keys(fileCountByAction);
  if (!present.length) return themeColor('s1');
  if (present.length === 1) {
    const only = present[0];
    const intensity = Math.min(0.9, 0.25 + (fileCountByAction[only] / 30) * 0.65);
    return ha(ACTION_COLORS[only], intensity);
  }
  return blend(present.map((a) => ACTION_COLORS[a]));
}

window.hmWeightThresholds = { low: 0.5, high: 2 };
const WEIGHT_BUCKETS = ['small', 'medium', 'large'];
const WEIGHT_BUCKET_LABELS = {
  small: () => `Малый (< ${window.hmWeightThresholds.low} ГБ)`,
  medium: () => `Средний (${window.hmWeightThresholds.low}–${window.hmWeightThresholds.high} ГБ)`,
  large: () => `Крупный (> ${window.hmWeightThresholds.high} ГБ)`,
};
const WEIGHT_BUCKET_COLORS = { small: '#3fb950', medium: '#d29922', large: '#f85149' };
let hmWeightActive = new Set(WEIGHT_BUCKETS);

function dayWeightGB(dayObj) {
  return heatmapDayCommits(dayObj).reduce((sum, c) => sum + (c.sizeGB || 0), 0);
}

function weightBucketOf(gb) {
  if (gb <= window.hmWeightThresholds.low) return 'small';
  if (gb <= window.hmWeightThresholds.high) return 'medium';
  return 'large';
}

function weightColor(dayObj) {
  const gb = dayWeightGB(dayObj);
  if (gb <= 0) return themeColor('s1');
  const bucket = weightBucketOf(gb);
  if (!hmWeightActive.has(bucket)) return themeColor('s1');
  const intensity = Math.min(0.9, 0.3 + Math.min(gb / (window.hmWeightThresholds.high * 1.5 || 1), 1) * 0.6);
  return ha(WEIGHT_BUCKET_COLORS[bucket], intensity);
}

function hmModeHasData(dayObj, total) {
  const metric = window.hmMetric || 'intensity';
  const groupBy = window.hmGroupBy || 'authors';
  if (metric === 'action') {
    return heatmapDayCommits(dayObj).some((c) => c.files.some((f) => hmActionActive.has(f.action)));
  }
  if (metric === 'weight') {
    const gb = dayWeightGB(dayObj);
    return gb > 0 && hmWeightActive.has(weightBucketOf(gb));
  }
  if (metric === 'files') return heatmapDayCommits(dayObj).reduce((sum, c) => sum + c.nFiles, 0) > 0;
  return total > 0;
}

function cellColor(dayObj) {
  const metric = window.hmMetric || 'intensity';
  if (metric === 'action') return actionColor(dayObj);
  if (metric === 'weight') return weightColor(dayObj);

  const useFiles = metric === 'files';
  const groupBy = window.hmGroupBy || 'authors';
  if (groupBy === 'workspaces') return dimensionColor(dayObj, 'workspace', useFiles);
  if (groupBy === 'depot') return dimensionColor(dayObj, 'depot', useFiles);
  return uColor(dayObj, activeUsers, useFiles);
}

function buildCal() {
  const lpWrap = document.getElementById('lpWrap_heatmap');
  if (lpWrap) lpWrap.innerHTML = localPeriodControlHtml('heatmap', 'buildCal');
  renderYearSwitch();
  document.getElementById('calWrap').innerHTML = '';
  buildGitHubTable(selectedYear);
  buildLegend();
}

function buildGitHubTable(year) {
  const jan1 = new Date(year, 0, 1);
  const dec31 = new Date(year, 11, 31);
  const startMonday = new Date(jan1);
  startMonday.setDate(jan1.getDate() - ((jan1.getDay() + 6) % 7));
  const endSunday = new Date(dec31);
  endSunday.setDate(dec31.getDate() + (6 - ((dec31.getDay() + 6) % 7)));

  const weeks = [];
  const cursor = new Date(startMonday);
  while (cursor <= endSunday) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(cursor);
      day.setDate(cursor.getDate() + i);
      week.push(new Date(day));
    }
    weeks.push(week);
    cursor.setDate(cursor.getDate() + 7);
  }

  const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
  const monthSpans = [];
  let lastMonth = -1;
  let span = 0;
  let spanStart = 0;
  weeks.forEach((week, weekIndex) => {
    const labelDate = week.find((d) => d >= jan1 && d <= dec31) || week[3];
    const month = labelDate.getMonth();
    if (month !== lastMonth) {
      if (lastMonth >= 0) monthSpans.push({ label: monthNames[lastMonth], span, start: spanStart });
      lastMonth = month;
      span = 1;
      spanStart = weekIndex;
    } else {
      span++;
    }
  });
  if (lastMonth >= 0) monthSpans.push({ label: monthNames[lastMonth], span, start: spanStart });

  const table = document.createElement('table');
  table.className = 'cal-table';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  const corner = document.createElement('td');
  corner.style.cssText = 'width:28px;';
  headerRow.appendChild(corner);
  monthSpans.forEach((ms) => {
    const td = document.createElement('td');
    td.className = 'ContributionCalendar-label';
    td.setAttribute('colspan', ms.span);
    td.textContent = ms.label;
    headerRow.appendChild(td);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  const DOW_LABELS = ['Пн', '', 'Ср', '', 'Пт', '', 'Вс'];
  const dayLookup = {};
  daysForBlock('heatmap').forEach((d) => { dayLookup[d.date.toISOString().slice(0, 10)] = d; });

  for (let dow = 0; dow < 7; dow++) {
    const tr = document.createElement('tr');
    const dayLabel = document.createElement('td');
    dayLabel.className = 'ContributionCalendar-label';
    dayLabel.style.cssText = 'font-size:9px;padding-right:6px;text-align:right;width:28px;vertical-align:middle;';
    dayLabel.textContent = DOW_LABELS[dow];
    tr.appendChild(dayLabel);

    weeks.forEach((week) => {
      const date = week[dow];
      const key = date.toISOString().slice(0, 10);

      const withinYear = date >= jan1 && date <= dec31;
      const dayObj = withinYear ? dayLookup[key] : undefined;
      const inRange = !!dayObj;

      const td = document.createElement('td');
      const cell = document.createElement('div');
      cell.className = 'ContributionCalendar-day' + (inRange ? '' : ' empty');

      if (inRange) {
        const total = USERS.filter((u) => activeUsers.has(u.name))
          .reduce((sum, u) => sum + depotCountFor('heatmap', dayObj, u.name), 0);

        if (!hmModeHasData(dayObj, total)) {

          cell.style.background = 'var(--s2)';
          cell.className = 'ContributionCalendar-day empty';
          cell.addEventListener('mouseenter', (e) => showEmptyTooltip(e, date));
          cell.addEventListener('mouseleave', hideTT);
        } else {
          cell.style.background = cellColor(dayObj);
          cell.addEventListener('mouseenter', (e) => showTT(e, date, dayObj, total));
          cell.addEventListener('mouseleave', hideTT);
          cell.addEventListener('click', () => clickDay(dayObj, key));
          if (selectedDayKey === key) cell.classList.add('selected');
        }
      } else {
        cell.style.background = 'var(--s2)';
        cell.addEventListener('mouseenter', (e) => showEmptyTooltip(e, date));
        cell.addEventListener('mouseleave', hideTT);
      }

      td.appendChild(cell);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  document.getElementById('calWrap').appendChild(table);
}

const TT = document.getElementById('tt');

function tooltipEntities(groupBy, dayObj) {
  if (groupBy === 'workspaces') {
    const dayCommits = heatmapDayCommits(dayObj);
    return visibleWorkspacesForScope('heatmap').map((ws) => ({
      label: ws,
      color: getWorkspaceColor(ws),
      commits: dayCommits.filter((c) => c.workspace === ws),
    }));
  }
  if (groupBy === 'depot') {
    const dp = depotPickers['heatmap'];
    const dayCommits = heatmapDayCommits(dayObj);
    const keys = dp ? DEPOTS.filter((k) => dp.active.has(k)) : DEPOTS;
    return keys.map((k) => ({
      label: k.replace(/^\/\//, '').replace(/\/$/, ''),
      color: getDepotColor(k),
      commits: dayCommits.filter((c) => c.depot === k),
    }));
  }
  return USERS.filter((u) => activeUsers.has(u.name)).map((u) => ({
    label: u.name,
    color: u.color,
    commits: depotCommitsFor('heatmap', dayObj, u.name),
  }));
}

function showTT(e, date, dayObj, total) {
  document.getElementById('tt-d').textContent = date.toLocaleDateString('ru', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const metric = window.hmMetric || 'intensity';
  const groupBy = window.hmGroupBy || 'authors';
  let rows = '';
  let totalLine = '';

  if (metric === 'action') {
    const entities = tooltipEntities(groupBy, dayObj);
    const entityRows = [];
    let totalFiles = 0;
    entities.forEach((ent) => {
      const counts = {};
      ent.commits.forEach((c) => c.files.forEach((f) => {
        if (hmActionActive.has(f.action)) { counts[f.action] = (counts[f.action] || 0) + 1; totalFiles++; }
      }));
      const parts = ACTION_LIST.filter((a) => hmActionActive.has(a) && counts[a]).map((a) => pluralizeRu(counts[a], ACTION_WORD_FORMS[a]));
      if (parts.length) {
        entityRows.push(`<div class="tt-row"><div class="tt-dot" style="background:${ent.color}"></div>${ent.label}: ${parts.join(', ')}</div>`);
      }
    });
    rows = entityRows.join('') || `<div class="tt-row" style="color:var(--muted)">Нет данных</div>`;
    totalLine = `Всего файлов: ${totalFiles}`;
  } else if (metric === 'weight') {
    const entities = tooltipEntities(groupBy, dayObj);
    const entityRows = [];
    entities.forEach((ent) => {
      const gb = ent.commits.reduce((sum, c) => sum + (c.sizeGB || 0), 0);
      if (gb > 0) entityRows.push(`<div class="tt-row"><div class="tt-dot" style="background:${ent.color}"></div>${ent.label}: ${gb.toFixed(2)} ГБ</div>`);
    });
    rows = entityRows.join('') || `<div class="tt-row" style="color:var(--muted)">Нет данных</div>`;
    const totalGb = dayWeightGB(dayObj);
    const bucket = weightBucketOf(totalGb);
    totalLine = `Всего: ${totalGb.toFixed(2)} ГБ (${WEIGHT_BUCKET_LABELS[bucket]()})`;
  } else {
    const useFiles = metric === 'files';
    const unitLabel = useFiles ? 'файлов' : 'сабмитов';
    if (groupBy === 'workspaces' || groupBy === 'depot') {
      const isDepot = groupBy === 'depot';
      const commits = heatmapDayCommits(dayObj);
      const keyOf = (c) => (isDepot ? c.depot : c.workspace);
      const dp = depotPickers['heatmap'];
      const keys = isDepot ? DEPOTS.filter((k) => (!dp || dp.active.has(k))) : visibleWorkspacesForScope('heatmap');
      let totalCount = 0;
      rows = keys.map((k) => {
        const matching = commits.filter((c) => keyOf(c) === k);
        const count = useFiles ? matching.reduce((s, c) => s + c.nFiles, 0) : matching.length;
        totalCount += count;
        const color = isDepot ? getDepotColor(k) : getWorkspaceColor(k);
        const label = isDepot ? k.replace(/^\/\//, '').replace(/\/$/, '') : k;
        return `<div class="tt-row"><div class="tt-dot" style="background:${color}"></div>${label}: ${count} ${unitLabel}</div>`;
      }).join('');
      totalLine = `Всего ${unitLabel}: ${totalCount}`;
    } else {
      let totalCount = 0;
      rows = USERS.filter((u) => activeUsers.has(u.name)).map((u) => {
        const commits = depotCommitsFor('heatmap', dayObj, u.name);
        const count = useFiles ? commits.reduce((s, c) => s + c.nFiles, 0) : commits.length;
        totalCount += count;
        return `<div class="tt-row"><div class="tt-dot" style="background:${u.color}"></div>${u.name}: ${count} ${unitLabel}</div>`;
      }).join('');
      totalLine = `Всего ${unitLabel}: ${totalCount}`;
    }
  }

  document.getElementById('tt-r').innerHTML = rows + (totalLine ? `<div class="tt-row" style="color:var(--text);border-top:1px solid var(--border);margin-top:4px;padding-top:4px">${totalLine}</div>` : '');
  posTT(e);
  TT.classList.add('on');
}

function showEmptyTooltip(e, date) {
  document.getElementById('tt-d').textContent = date.toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' });
  document.getElementById('tt-r').innerHTML = '<div class="tt-row" style="color:var(--muted)">Нет сабмитов</div>';
  posTT(e);
  document.getElementById('tt').classList.add('on');
}

function posTT(e) {
  let x = e.clientX + 12;
  const y = e.clientY - 8;
  if (x + 220 > window.innerWidth) x = e.clientX - 230;
  TT.style.left = x + 'px';
  TT.style.top = y + 'px';
}

function hideTT() {
  TT.classList.remove('on');
}

function clickDay(dayObj, key) {
  selectedDayKey = key;
  buildCal();

  const allCommits = [];
  USERS.filter((u) => activeUsers.has(u.name))
    .forEach((u) => depotCommitsFor('heatmap', dayObj, u.name).forEach((c) => allCommits.push(c)));
  allCommits.sort((a, b) => b.date - a.date);

  document.getElementById('drillDate').textContent = dayObj.date.toLocaleDateString('ru', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  renderDrill(allCommits);
}

function renderDrill(commits) {
  const drill = document.getElementById('drill');
  drill.classList.add('on');
  const list = document.getElementById('clList');
  window._drillCommits = commits;

  if (!commits.length) {
    list.innerHTML = '<div style="color:var(--muted);font-size:12px">Нет сабмитов</div>';
    return;
  }

  list.innerHTML = commits.map((c, i) => {
    const author = USERS.find((u) => u.name === c.author);
    const fileRows = c.files.map((f) => `<div class="fl-row"><span class="fl-act ${f.action}">${f.action}</span><span class="fl-path">${f.path}</span><span class="fl-rev">${f.rev}</span><span class="fl-sz">${f.size}</span></div>`).join('');
    return `<div class="cl-item">
      <div class="cl-hd" onclick="toggleCL(${i})">
        <span class="cl-num">${c.cl}</span><span class="cl-dot" style="background:${author.color}"></span>
        <span class="cl-user" style="color:${author.color}">${c.author}</span>
        <span class="cl-desc">${c.desc}</span>
        <span class="cl-time">${c.date.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}</span>
        <span class="cl-arr" id="arr${i}">›</span>
      </div>
      <div class="cl-body" id="clb${i}">
        <div class="cl-meta">
          <div class="cl-mi"><label>Дата и время</label><span>${c.date.toLocaleString('ru')}</span></div>
          <div class="cl-mi"><label>Депо</label><span>${c.depot}</span></div>
          <div class="cl-mi"><label>Воркспейс</label><span style="color:${getWorkspaceColor(c.workspace)}">${c.workspace}</span></div>
          <div class="cl-mi"><label>Файлов</label><span>${c.nFiles}</span></div>
          <div class="cl-mi"><label>Размер</label><span>${c.totalSize}</span></div>
        </div>
        <div class="fl-title">${c.nFiles} файлов</div>${fileRows}
      </div></div>`;
  }).join('');
}

function exportDrillDayToCSV() {
  const commits = window._drillCommits || [];
  if (!commits.length) { alert('Нет сабмитов для экспорта в этот день.'); return; }
  const rows = [['CL', 'Author', 'Description', 'Date', 'Depot', 'Workspace', 'File', 'Action', 'Revision', 'Size']];
  commits.forEach((c) => c.files.forEach((f) => rows.push([c.cl, c.author, c.desc, c.date.toISOString().slice(0, 19).replace('T', ' '), c.depot, c.workspace, f.path, f.action, f.rev, f.size])));
  const dateStr = commits[0].date.toISOString().slice(0, 10);
  downloadCSV('day_' + dateStr + '.csv', rows);
}

function toggleCL(i) {
  const body = document.getElementById('clb' + i);
  const arrow = document.getElementById('arr' + i);
  const isOpen = body.classList.toggle('on');
  arrow.classList.toggle('open', isOpen);
}

function closeDrill() {
  document.getElementById('drill').classList.remove('on');
  selectedDayKey = null;
  buildCal();
}

function buildLegend() {
  const el = document.getElementById('hmLeg');
  const metric = window.hmMetric || 'intensity';
  const groupBy = window.hmGroupBy || 'authors';

  if (metric === 'action') {
    const totals = {};
    ACTION_LIST.forEach((a) => { totals[a] = 0; });
    heatmapVisibleDays().forEach((day) => {
      heatmapDayCommits(day).forEach((c) => c.files.forEach((f) => {
        if (hmActionActive.has(f.action)) totals[f.action] = (totals[f.action] || 0) + 1;
      }));
    });
    el.innerHTML = renderStaticLegend(ACTION_LIST.filter((a) => hmActionActive.has(a)).map((a) => ({ color: ACTION_COLORS[a], label: `${ACTION_LABELS[a]} — ${totals[a]}` })));
    return;
  }
  if (metric === 'weight') {
    const totals = {};
    WEIGHT_BUCKETS.forEach((b) => { totals[b] = 0; });
    heatmapVisibleDays().forEach((day) => {
      const gb = dayWeightGB(day);
      if (gb > 0) { const b = weightBucketOf(gb); totals[b] = (totals[b] || 0) + 1; }
    });
    el.innerHTML = renderStaticLegend(WEIGHT_BUCKETS.filter((b) => hmWeightActive.has(b)).map((b) => ({ color: WEIGHT_BUCKET_COLORS[b], label: `${WEIGHT_BUCKET_LABELS[b]()} — ${totals[b]} дн.` })));
    return;
  }

  if (groupBy === 'workspaces' || groupBy === 'depot') {
    const dp = depotPickers['heatmap'];
    const isDepot = groupBy === 'depot';

    const keys = isDepot ? DEPOTS.filter((k) => (!dp || dp.active.has(k))) : visibleWorkspacesForScope('heatmap');
    const colorOf = (k) => (isDepot ? getDepotColor(k) : getWorkspaceColor(k));
    const labelOf = (k) => (isDepot ? k.replace(/^\/\//, '').replace(/\/$/, '') : k);
    el.innerHTML = renderStaticLegend(keys.map((k) => ({ color: colorOf(k), label: labelOf(k) })));
    return;
  }

  const active = USERS.filter((u) => activeUsers.has(u.name));
  const items = active.map((u) => ({ color: u.color, label: u.name }));
  el.innerHTML = renderStaticLegend(items);
}

const HEATMAP_AUTHORS_KEY = 'authtree-heatmap';

function buildToggles() {
  renderAuthorFilter();
}

function renderAuthorFilter() {
  const container = document.getElementById('userToggles');
  if (!container) return;

  const wsPicker = workspacePickers['heatmap'];

  container.innerHTML = renderAuthorWorkspaceTree({
    key: HEATMAP_AUTHORS_KEY,
    users: USERS,
    isAuthorActive: (u) => activeUsers.has(u.name),
    workspacesForAuthor: (name) => workspacesOwnedBy(name),
    isWorkspaceActive: (ws) => !wsPicker || wsPicker.active.has(ws),
    activeAuthorCount: activeUsers.size,
    activeWorkspaceCount: wsPicker ? wsPicker.active.size : WORKSPACE_LIST.length,
    totalWorkspaceCount: WORKSPACE_LIST.length,
    onSearchExpr: `onHeatmapAuthorSearch(this.value)`,
    onSelectAllExpr: `authorSelectAll()`,
    onAuthorToggleExpr: (u) => `toggleUser('${u.name.replace(/'/g, "\\'")}')`,
    onWorkspaceToggleExpr: (ws) => `workspaceToggleOne('heatmap','${ws}')`,
    rerenderExpr: `renderAuthorFilter()`,
  });

  container.querySelectorAll('.tree-wrap > .row:not(.lvl1)').forEach((row) => {
    const name = row.querySelector('.name')?.textContent;
    const user = USERS.find((u) => u.name === name);
    if (!user) return;
    const link = document.createElement('span');
    link.className = 'dpi-link';
    link.title = 'Подробнее об авторе';
    link.textContent = `${user.commits} →`;
    link.onclick = (e) => { e.stopPropagation(); openAuthorModal(user.name); };
    row.appendChild(link);
  });

  const state = ensurePopState(HEATMAP_AUTHORS_KEY);
  if (state.open) {
    document.getElementById('pop-' + HEATMAP_AUTHORS_KEY)?.classList.add('on');
    document.getElementById('btn-' + HEATMAP_AUTHORS_KEY)?.classList.add('open');
  }
}

function onHeatmapAuthorSearch(value) {
  handleDropdownFilterSearch(HEATMAP_AUTHORS_KEY, value, renderAuthorFilter);
}

function authorSelectAll() {
  activeUsers = new Set(USERS.map((u) => u.name));
  if (workspacePickers['heatmap']) workspacePickers['heatmap'].active = new Set(WORKSPACE_LIST);
  buildToggles();
  buildCal();
}

function toggleUser(name) {
  if (activeUsers.has(name)) {
    activeUsers.delete(name);
  } else {
    activeUsers.add(name);
  }
  buildToggles();
  buildCal();
}

const HM_METRIC_OPTIONS = [
  { id: 'intensity', label: 'Сабмиты', desc: 'кол-во сабмитов' },
  { id: 'files', label: 'Файлы', desc: 'кол-во файлов' },
  { id: 'action', label: 'Действия', desc: 'edit/add/delete' },
  { id: 'weight', label: 'Вес', desc: 'объём засабмиченного' },
];

function setHmGroupBy(id) {
  window.hmGroupBy = id;
  renderHmGroupByPill();
  buildCal();
}

function setHmMetric(id) {
  window.hmMetric = id;
  renderHmMetricPill();
  renderHmDimensionFilter();
  buildCal();
}

function renderHmGroupByPill() {
  const container = document.getElementById('hmGroupByPill');
  if (!container) return;
  container.innerHTML = renderRadioPill({
    key: 'hmgroupby',
    label: 'Группировка',
    options: CHART_GROUP_BY_OPTIONS,
    selectedId: window.hmGroupBy || 'authors',
    onSelectExpr: (id) => `setHmGroupBy('${id}')`,
  });
  const state = ensurePopState('hmgroupby');
  if (state.open) {
    document.getElementById('pop-hmgroupby')?.classList.add('on');
    document.getElementById('btn-hmgroupby')?.classList.add('open');
  }
}

function renderHmMetricPill() {
  const container = document.getElementById('hmMetricPill');
  if (!container) return;
  container.innerHTML = renderRadioPill({
    key: 'hmmetric',
    label: 'Показатель',
    options: HM_METRIC_OPTIONS,
    selectedId: window.hmMetric || 'intensity',
    onSelectExpr: (id) => `setHmMetric('${id}')`,
  });
  const state = ensurePopState('hmmetric');
  if (state.open) {
    document.getElementById('pop-hmmetric')?.classList.add('on');
    document.getElementById('btn-hmmetric')?.classList.add('open');
  }
}

function renderHmDimensionFilter() {
  const container = document.getElementById('hmDimensionFilter');
  if (!container) return;
  const metric = window.hmMetric || 'intensity';

  if (metric === 'action') {
    container.innerHTML = renderDropdownFilter({
      key: 'hm-action',
      icon: DROPDOWN_ICONS.depot,
      label: 'Действия',
      searchPlaceholder: '',
      items: ACTION_LIST,
      itemText: (a) => ACTION_LABELS[a],
      isActive: (a) => hmActionActive.has(a),
      activeCount: hmActionActive.size,
      itemExtraHtml: (a) => `<div class="dpi-dot" style="background:${ACTION_COLORS[a]}"></div>`,
      onSearchExpr: '',
      onSelectAllExpr: 'hmActionSelectAll()',
      onItemClickExpr: (a) => `hmActionToggle('${a}')`,
    });

    const st = ensurePopState('hm-action');
    if (st.open) {
      document.getElementById('pop-hm-action')?.classList.add('on');
      document.getElementById('btn-hm-action')?.classList.add('open');
    }
  } else if (metric === 'weight') {
    container.innerHTML = `
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px">
        <label style="font-size:11px;color:var(--muted)">Малый &lt;
          <input type="number" step="0.1" min="0" value="${window.hmWeightThresholds.low}" onchange="setHmWeightThreshold('low', this.value)" style="width:56px;background:var(--s1);border:1px solid var(--border);border-radius:4px;color:var(--text);padding:2px 4px;font-family:var(--mono)"> ГБ
        </label>
        <label style="font-size:11px;color:var(--muted)">Крупный &gt;
          <input type="number" step="0.1" min="0" value="${window.hmWeightThresholds.high}" onchange="setHmWeightThreshold('high', this.value)" style="width:56px;background:var(--s1);border:1px solid var(--border);border-radius:4px;color:var(--text);padding:2px 4px;font-family:var(--mono)"> ГБ
        </label>
      </div>
      ${renderDropdownFilter({
        key: 'hm-weight',
        icon: DROPDOWN_ICONS.depot,
        label: 'Бакеты веса',
        searchPlaceholder: '',
        items: WEIGHT_BUCKETS,
        itemText: (b) => WEIGHT_BUCKET_LABELS[b](),
        isActive: (b) => hmWeightActive.has(b),
        activeCount: hmWeightActive.size,
        itemExtraHtml: (b) => `<div class="dpi-dot" style="background:${WEIGHT_BUCKET_COLORS[b]}"></div>`,
        onSearchExpr: '',
        onSelectAllExpr: 'hmWeightSelectAll()',
        onItemClickExpr: (b) => `hmWeightToggle('${b}')`,
      })}`;
    const st2 = ensurePopState('hm-weight');
    if (st2.open) {
      document.getElementById('pop-hm-weight')?.classList.add('on');
      document.getElementById('btn-hm-weight')?.classList.add('open');
    }
  } else {
    container.innerHTML = '';
  }
}

function hmActionToggle(action) {
  if (hmActionActive.has(action)) {
    hmActionActive.delete(action);
  } else {
    hmActionActive.add(action);
  }
  renderHmDimensionFilter();
  buildCal();
}

function hmActionSelectAll() {
  hmActionActive = new Set(ACTION_LIST);
  renderHmDimensionFilter();
  buildCal();
}

function hmWeightToggle(bucket) {
  if (hmWeightActive.has(bucket)) {
    hmWeightActive.delete(bucket);
  } else {
    hmWeightActive.add(bucket);
  }
  renderHmDimensionFilter();
  buildCal();
}

function hmWeightSelectAll() {
  hmWeightActive = new Set(WEIGHT_BUCKETS);
  renderHmDimensionFilter();
  buildCal();
}

function setHmWeightThreshold(which, value) {
  const num = parseFloat(value);
  if (!isNaN(num) && num >= 0) window.hmWeightThresholds[which] = num;
  renderHmDimensionFilter();
  buildCal();
}
