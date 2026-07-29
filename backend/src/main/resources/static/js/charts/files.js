

function filesCommits(scope) {
  return depotAllCommits(scope, daysForBlock(scope));
}

function filesCommitsFiles(scope) {
  const activeExt = ensureExtensionPicker(scope);
  const out = [];
  filesCommits(scope).forEach((c) => {
    c.files.forEach((f) => {
      if (activeExt.has(f.ext)) out.push({ file: f, commit: c });
    });
  });
  return out;
}

function computeFilesData(scope) {
  const allCommits = filesCommits(scope);
  const activeExt = ensureExtensionPicker(scope);
  const extCount = {}, extSizeKB = {}, actionCount = {}, userCount = {};
  allCommits.forEach((c) => {
    let matchingFiles = 0;
    c.files.forEach((f) => {
      if (!activeExt.has(f.ext)) return;
      extCount[f.ext] = (extCount[f.ext] || 0) + 1;
      extSizeKB[f.ext] = (extSizeKB[f.ext] || 0) + (parseInt(f.size) || 0);
      actionCount[f.action] = (actionCount[f.action] || 0) + 1;
      matchingFiles++;
    });
    userCount[c.author] = (userCount[c.author] || 0) + matchingFiles;
  });
  return { extCount, extSizeKB, actionCount, userCount };
}

let cooccurrenceMode = 'ext';
let cooccurrenceLimit = 8;

function setCooccurrenceMode(mode) {
  cooccurrenceMode = mode;
  buildCooccurrenceTable();
}

function setCooccurrenceLimit(limit) {
  let n = parseInt(limit, 10);
  if (isNaN(n) || n < 1) n = 1;
  cooccurrenceLimit = n;
  buildCooccurrenceTable();
}

function computePairCooccurrence(scope, keyFn) {
  const activeExt = ensureExtensionPicker(scope);
  const pairCounts = {};
  filesCommits(scope).forEach((c) => {
    const keys = [...new Set(c.files.filter((f) => activeExt.has(f.ext)).map(keyFn).filter(Boolean))];
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const pairKey = [keys[i], keys[j]].sort().join(' + ');
        pairCounts[pairKey] = (pairCounts[pairKey] || 0) + 1;
      }
    }
  });
  return Object.entries(pairCounts).sort((a, b) => b[1] - a[1]);
}

window.fileClusterMode = 'cooccur_files';
let fileClusterChartInst = null;
let fileClusterLimit = 8;

function setFileClusterMode(m) {
  window.fileClusterMode = m;
  buildFileClusterBlock();
}

function setFileClusterLimit(v) {
  let n = parseInt(v, 10);
  if (isNaN(n) || n < 1) n = 1;
  fileClusterLimit = n;
  buildFileClusterBlock();
}

function buildFileClusterBlock() {
  const container = document.getElementById('fileClusterTable');
  if (!container) return;
  const scope = 'filecluster';
  const lpWrap = document.getElementById('lpWrap_filecluster');
  if (lpWrap) lpWrap.innerHTML = localPeriodControlHtml('filecluster', 'buildFileClusterBlock');
  const mode = window.fileClusterMode;

  const limitInputEl = document.getElementById('fileClusterLimitInput');
  if (limitInputEl && limitInputEl.closest('label')) limitInputEl.closest('label').style.display = mode === 'cluster_types' ? 'none' : 'flex';
  const existingNote = document.getElementById('fileClusterNote');
  if (mode !== 'cluster_types' && existingNote) existingNote.remove();
  const chartWrap = document.getElementById('fileClusterChartWrap');
  if (chartWrap) chartWrap.style.display = mode === 'cluster_types' ? '' : 'none';
  if (mode !== 'cluster_types' && fileClusterChartInst) { fileClusterChartInst.destroy(); fileClusterChartInst = null; }

  if (mode === 'cluster_types') {
    renderFileTypeClusters(container, scope);
    return;
  }

  let rows = [], color = '#bc8cff', valueLabel = 'Совпадений', subText = '';

  if (mode === 'cooccur_files') {
    subText = 'какие конкретные файлы чаще всего меняются в одном сабмите';
    const activeExt = ensureExtensionPicker(scope);
    const pairCounts = {};
    filesCommits(scope).forEach((c) => {
      const names = [...new Set(c.files.filter((f) => activeExt.has(f.ext)).map((f) => f.path.split('/').pop()))];
      for (let i = 0; i < names.length; i++) {
        for (let j = i + 1; j < names.length; j++) {
          const key = [names[i], names[j]].sort().join(' + ');
          pairCounts[key] = (pairCounts[key] || 0) + 1;
        }
      }
    });
    const sorted = Object.entries(pairCounts).sort((a, b) => b[1] - a[1]);
    fileClusterLimit = Math.max(1, Math.min(fileClusterLimit, Math.max(1, sorted.length)));
    rows = sorted.slice(0, fileClusterLimit).map(([name, count]) => ({ n: name, c: count }));
    color = '#bc8cff'; valueLabel = 'Совпадений';
  } else if (mode === 'churn_age') {
    subText = 'файлы, которые меняются часто, но существуют уже давно (нестабильный легаси)';
    const fileInfo = {};
    filesCommitsFiles(scope).forEach(({ file, commit }) => {
      const name = file.path.split('/').pop();
      if (!fileInfo[name]) fileInfo[name] = { count: 0, first: commit.date, last: commit.date };
      fileInfo[name].count++;
      if (commit.date < fileInfo[name].first) fileInfo[name].first = commit.date;
      if (commit.date > fileInfo[name].last) fileInfo[name].last = commit.date;
    });
    const entries = Object.entries(fileInfo).map(([name, info]) => {
      const ageDays = Math.max(1, Math.round((info.last - info.first) / 86400000));

      return { name, count: info.count, ageDays, churnScore: info.count * Math.log2(ageDays + 2) };
    });
    entries.sort((a, b) => b.churnScore - a.churnScore);
    fileClusterLimit = Math.max(1, Math.min(fileClusterLimit, Math.max(1, entries.length)));
    rows = entries.slice(0, fileClusterLimit).map((e) => ({ n: e.name, c: e.count, sub: `возраст ~${e.ageDays} дн.` }));
    color = '#f0883e'; valueLabel = 'Изменений';
  } else {
    subText = 'файлы, которые в короткий промежуток времени (один день) правят разные авторы';
    const byFile = {};
    filesCommitsFiles(scope).forEach(({ file, commit }) => {
      const name = file.path.split('/').pop();
      const dayKey = commit.date.toISOString().slice(0, 10);
      if (!byFile[name]) byFile[name] = {};
      if (!byFile[name][dayKey]) byFile[name][dayKey] = new Set();
      byFile[name][dayKey].add(commit.author);
    });
    const conflictCounts = {};
    Object.entries(byFile).forEach(([name, days]) => {
      let incidents = 0;
      Object.values(days).forEach((authorsSet) => { if (authorsSet.size > 1) incidents++; });
      if (incidents > 0) conflictCounts[name] = incidents;
    });
    const sorted = Object.entries(conflictCounts).sort((a, b) => b[1] - a[1]);
    fileClusterLimit = Math.max(1, Math.min(fileClusterLimit, Math.max(1, sorted.length)));
    rows = sorted.slice(0, fileClusterLimit).map(([name, count]) => ({ n: name, c: count }));
    color = '#f85149'; valueLabel = 'Дней с конфликтом';
  }

  document.getElementById('fileClusterSub').textContent = subText;
  const limitInput = document.getElementById('fileClusterLimitInput');
  if (limitInput && String(fileClusterLimit) !== limitInput.value) limitInput.value = String(fileClusterLimit);

  if (!rows.length) {
    container.innerHTML = '<tr><td colspan="3" style="color:var(--muted);padding:10px">Нет данных</td></tr>';
    return;
  }
  const maxV = Math.max(1, ...rows.map((r) => r.c));
  container.innerHTML = `<thead><tr><td></td><td>Файл</td><td></td><td>${valueLabel}</td></tr></thead><tbody>` + rows.map((r) => {
    const pct = Math.min(100, +(r.c / maxV * 100).toFixed(1));
    return `<tr>
      <td class="bar-name" style="width:200px;max-width:200px;font-family:var(--mono)">${r.n}</td>
      <td class="bar-w"><div class="bar-bar" style="width:${pct}%;background:${color}88;border:1px solid ${color};min-width:4px"></div></td>
      <td class="bar-cnt">${r.c.toLocaleString('ru')}${r.sub ? `<div style="font-size:10px;color:var(--muted);font-weight:400">${r.sub}</div>` : ''}</td>
    </tr>`;
  }).join('') + '</tbody>';
}

function renderFileTypeClusters(container, scope) {
  document.getElementById('fileClusterSub').textContent = 'сабмиты, сгруппированные по тому, КАКИЕ типы файлов встречаются вместе';

  const activeExt = ensureExtensionPicker(scope);
  const extsInUse = EXTS_LIST.filter((e) => activeExt.has(e));
  const commits = filesCommits(scope);
  if (commits.length < 3 || extsInUse.length < 2) {
    container.innerHTML = '<tr><td style="color:var(--muted);padding:10px">Недостаточно данных для кластеризации</td></tr>';
    return;
  }

  const points = commits.map((c) => {
    const presentExts = new Set(c.files.map((f) => f.ext));
    return extsInUse.map((e) => (presentExts.has(e) ? 1 : 0));
  });

  const result = alKMeans(points);
  if (!result) {
    container.innerHTML = '<tr><td style="color:var(--muted);padding:10px">Не удалось выделить кластеры (недостаточно разнообразия)</td></tr>';
    return;
  }

  const clusterCounts = {};
  result.labels.forEach((l) => { clusterCounts[l] = (clusterCounts[l] || 0) + 1; });
  const total = result.labels.length;

  const clusterNames = result.centers.map((center) => {
    const topExts = extsInUse.map((e, i) => ({ e, v: center[i] })).sort((a, b) => b.v - a.v).slice(0, 3)
      .filter((x) => x.v > 0.15).map((x) => `.${x.e}`).join(' + ');
    return topExts || 'смешанный';
  });

  const rowsHtml = result.centers.map((center, ci) => {
    const count = clusterCounts[ci] || 0;
    const pct = ((count / total) * 100).toFixed(1);
    return `<tr>
      <td style="font-family:var(--mono)">${clusterNames[ci]}</td>
      <td class="bar-w"><div class="bar-bar" style="width:${pct}%;background:${EXT_PALETTE[ci % EXT_PALETTE.length]}88;border:1px solid ${EXT_PALETTE[ci % EXT_PALETTE.length]};min-width:4px"></div></td>
      <td class="bar-cnt">${count} (${pct}%)</td>
    </tr>`;
  }).join('');

  container.innerHTML = `<thead><tr><td>Характерные типы</td><td></td><td>Сабмитов</td></tr></thead><tbody>${rowsHtml}</tbody>`;
  const existingNote = document.getElementById('fileClusterNote');
  if (existingNote) existingNote.remove();
  container.insertAdjacentHTML('afterend', `<div id="fileClusterNote" style="font-size:11px;color:var(--muted);margin-top:8px">K=${result.k} (автоподбор по силуэту, силуэт=${result.silhouette.toFixed(2)})</div>`);

  const canvas = document.getElementById('fileClusterChart');
  if (canvas && typeof Chart !== 'undefined') {
    if (fileClusterChartInst) fileClusterChartInst.destroy();
    const byCluster = {};
    commits.forEach((c, i) => { const cl = result.labels[i]; (byCluster[cl] || (byCluster[cl] = [])).push(c); });
    const datasets = Object.keys(byCluster).map((cl) => ({
      label: clusterNames[cl] || `Кластер ${Number(cl) + 1}`,
      data: byCluster[cl].map((c) => ({ x: c.nFiles, y: c.sizeGB })),
      backgroundColor: EXT_PALETTE[cl % EXT_PALETTE.length] + '99',
      borderColor: EXT_PALETTE[cl % EXT_PALETTE.length],
      pointRadius: 3,
      pointHoverRadius: 5,
    }));
    fileClusterChartInst = new Chart(canvas, {
      type: 'scatter',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: themeColor('border') }, ticks: { color: themeColor('muted') }, title: { display: true, text: 'Файлов в сабмите', font: { size: 10 }, color: themeColor('muted') } },
          y: { grid: { color: themeColor('border') }, ticks: { color: themeColor('muted') }, title: { display: true, text: 'Объём, ГБ', font: { size: 10 }, color: themeColor('muted') } },
        },
      },
    });
  }
}

let fileCorrelChartInst = null;

function buildFileCorrelations() {
  const container = document.getElementById('fileCorrelTable');
  if (!container) return;
  const scope = 'filecorrel';
  const lpWrap = document.getElementById('lpWrap_filecorrel');
  if (lpWrap) lpWrap.innerHTML = localPeriodControlHtml('filecorrel', 'buildFileCorrelations');
  const commits = filesCommits(scope);
  if (commits.length < 5) { container.innerHTML = '<div style="color:var(--muted);font-size:12px">Недостаточно данных</div>'; return; }

  const fileCount = commits.map((c) => c.nFiles);
  const totalSize = commits.map((c) => c.sizeGB);
  const avgSize = commits.map((c) => c.sizeGB / c.nFiles);

  const statMetrics = [
    { label: 'Число файлов', values: fileCount, fmt: (v) => v.toFixed(1) },
    { label: 'Объём, ГБ', values: totalSize, fmt: (v) => v.toFixed(3) },
    { label: 'Средний размер файла, МБ', values: avgSize, fmt: (v) => (v * 1000).toFixed(1) },
  ];
  const statsCardsHtml = statMetrics.map((m) => {
    const s = alFullStats(m.values);
    return `<div class="corr-stat-card">
      <div class="corr-stat-card-title">${m.label}</div>
      <div class="corr-stat-card-grid">
        <div class="corr-stat-cell"><span class="corr-stat-k">Mean</span><span class="corr-stat-v">${m.fmt(s.mean)}</span></div>
        <div class="corr-stat-cell"><span class="corr-stat-k">Std</span><span class="corr-stat-v">${m.fmt(s.std)}</span></div>
        <div class="corr-stat-cell"><span class="corr-stat-k">Median</span><span class="corr-stat-v">${m.fmt(s.median)}</span></div>
        <div class="corr-stat-cell"><span class="corr-stat-k">Q25–Q75</span><span class="corr-stat-v">${m.fmt(s.q1)}–${m.fmt(s.q3)}</span></div>
      </div>
    </div>`;
  }).join('');

  const pairs = [
    { a: 'Число файлов', b: 'Объём', x: fileCount, y: totalSize },
    { a: 'Число файлов', b: 'Средний размер файла', x: fileCount, y: avgSize },
    { a: 'Объём', b: 'Средний размер файла', x: totalSize, y: avgSize },
  ];

  const strengthMeta = (absR) => (absR >= 0.7 ? { text: 'сильная', color: '#f85149' } : absR >= 0.4 ? { text: 'умеренная', color: '#d29922' } : { text: 'слабая', color: themeColor('muted') });

  const corrRowsHtml = pairs.map((p) => {
    const { r, p: pval } = alPearson(p.x, p.y);
    const meta = strengthMeta(Math.abs(r));
    const sigLabel = pval < 0.05 ? 'значимо' : 'незначимо';
    return `<div class="corr-row">
      <span class="corr-row-label">${p.a} × ${p.b}</span>
      <div class="corr-row-bar"><div class="corr-row-fill" style="width:${Math.min(100, Math.abs(r) * 100)}%;background:${meta.color}"></div></div>
      <span class="corr-row-r" style="color:${meta.color}">r=${r.toFixed(2)}</span>
      <span class="corr-row-badge">${meta.text} · ${sigLabel}</span>
    </div>`;
  }).join('');

  const depotArr = [], extArr = [];
  commits.forEach((c) => c.files.forEach((f) => { depotArr.push(c.depot); extArr.push(f.ext); }));
  const cv = alCramersV(depotArr, extArr);
  const cvRowHtml = !isNaN(cv) ? `<div class="corr-row">
      <span class="corr-row-label">Депо × Расширение <span class="corr-row-method">(Крамера V)</span></span>
      <div class="corr-row-bar"><div class="corr-row-fill" style="width:${Math.min(100, cv * 100)}%;background:#bc8cff"></div></div>
      <span class="corr-row-r" style="color:#bc8cff">V=${cv.toFixed(2)}</span>
    </div>` : '';

  container.innerHTML = `
    <div class="corr-section-title">Std / медиана / квартили</div>
    <div class="corr-stat-cards">${statsCardsHtml}</div>
    <div class="corr-section-title" style="margin-top:16px">Корреляции</div>
    <div class="corr-rows">${corrRowsHtml}${cvRowHtml}</div>
  `;

  const pairIdx = Math.min(pairs.length - 1, Math.max(0, window.fileCorrelPairIdx || 0));
  const chosen = pairs[pairIdx];
  const canvas = document.getElementById('fileCorrelChart');
  if (canvas && typeof Chart !== 'undefined') {
    if (fileCorrelChartInst) fileCorrelChartInst.destroy();
    fileCorrelChartInst = new Chart(canvas, {
      type: 'scatter',
      data: {
        datasets: [{
          label: `${chosen.a} × ${chosen.b}`,
          data: chosen.x.map((v, i) => ({ x: v, y: chosen.y[i] })),
          backgroundColor: '#bc8cff88',
          borderColor: '#bc8cff',
          pointRadius: 3,
          pointHoverRadius: 5,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: themeColor('border') }, ticks: { color: themeColor('muted') }, title: { display: true, text: chosen.a, font: { size: 10 }, color: themeColor('muted') } },
          y: { grid: { color: themeColor('border') }, ticks: { color: themeColor('muted') }, title: { display: true, text: chosen.b, font: { size: 10 }, color: themeColor('muted') } },
        },
      },
    });
  }
}

window.fileCorrelPairIdx = 0;
function setFileCorrelPair(idx) {
  window.fileCorrelPairIdx = parseInt(idx, 10) || 0;
  buildFileCorrelations();
}

function computeExtActionCombos(scope) {
  const activeExt = ensureExtensionPicker(scope);
  const counts = {};
  filesCommits(scope).forEach((c) => c.files.forEach((f) => {
    if (!activeExt.has(f.ext)) return;
    const key = f.ext + ' · ' + (ACTION_LABELS_SHORT[f.action] || f.action);
    counts[key] = (counts[key] || 0) + 1;
  }));
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

function buildCooccurrenceTable() {
  const container = document.getElementById('cooccurTable');
  if (!container) return;
  const lpWrap = document.getElementById('lpWrap_cooccur');
  if (lpWrap) lpWrap.innerHTML = localPeriodControlHtml('cooccur', 'buildCooccurrenceTable');

  let allPairs, color, subText;
  if (cooccurrenceMode === 'ext_action') {
    allPairs = computeExtActionCombos('cooccur');
    color = '#d29922';
    subText = 'какие сочетания расширение+действие встречаются чаще всего';
  } else {
    const isAction = cooccurrenceMode === 'action';
    const keyFn = isAction ? (f) => ACTION_LABELS_SHORT[f.action] || f.action : (f) => f.ext;
    allPairs = computePairCooccurrence('cooccur', keyFn);
    color = isAction ? '#58a6ff' : '#bc8cff';
    subText = isAction ? 'какие действия чаще всего происходят в одном сабмите' : 'какие расширения чаще всего меняются в одном сабмите';
  }

  document.getElementById('cooccurSub').textContent = subText;

  const maxPossible = Math.max(1, allPairs.length);
  if (cooccurrenceLimit < 1) cooccurrenceLimit = 1;
  if (cooccurrenceLimit > maxPossible) cooccurrenceLimit = maxPossible;
  const limitInput = document.getElementById('cooccurLimitInput');
  if (limitInput) {
    limitInput.max = String(maxPossible);
    limitInput.min = '1';
    if (String(cooccurrenceLimit) !== limitInput.value) limitInput.value = String(cooccurrenceLimit);
  }

  const pairs = allPairs.slice(0, cooccurrenceLimit);

  if (!pairs.length) {
    container.innerHTML = '<tr><td colspan="3" style="color:var(--muted);padding:10px">Нет данных</td></tr>';
    return;
  }

  const maxV = Math.max(1, ...pairs.map(([, c]) => c));

  container.innerHTML = pairs.map(([name, count]) => {
    const pct = Math.min(100, +(count / maxV * 100).toFixed(1));
    return `<tr>
      <td class="bar-name" style="width:180px;max-width:180px;">${name}</td>
      <td class="bar-w"><div class="bar-bar" style="width:${pct}%;background:${color}88;border:1px solid ${color};min-width:4px"></div></td>
      <td class="bar-cnt">${count.toLocaleString('ru')}</td>
    </tr>`;
  }).join('');
}

const ACTION_LABELS_SHORT = { edit: 'edit', add: 'add', delete: 'delete' };

const FILE_META = {
  ext: { title: 'Топ расширений', sub: 'по количеству файлов', color: '#bc8cff' },
  size: { title: 'Топ по объёму', sub: 'суммарный объём по типу', color: '#f0883e' },
  user: { title: 'Файлов по авторам', sub: 'количество изменённых', color: null },
  action: { title: 'По типу действия', sub: 'edit / add / delete', color: '#58a6ff' },
  depot: { title: 'По депо', sub: 'по количеству файлов', color: '#d29922' },
};
const FILE_STACK_META = {
  ext: { title: 'Расширения', sub: 'топ 8 расширений' },
  action: { title: 'Действия', sub: 'edit / add / delete' },
  ext_time: { title: 'Расширения по времени', sub: 'топ 3 расширения' },
};

window.fileStackGroupBy = 'authors';

function setFileStackGroupBy(id) {
  window.fileStackGroupBy = id;
  renderFileStackGroupByPill();
  buildFileStackChart();
}

function renderFileStackGroupByPill() {
  const container = document.getElementById('fileStackGroupByPill');
  if (!container) return;
  if (fileStackMode !== 'ext' && fileStackMode !== 'action') {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = renderRadioPill({
    key: 'filestackgroupby',
    label: 'Группировать по',
    options: CHART_GROUP_BY_OPTIONS,
    selectedId: window.fileStackGroupBy,
    onSelectExpr: (id) => `setFileStackGroupBy('${id}')`,
  });
  const state = ensurePopState('filestackgroupby');
  if (state.open) {
    document.getElementById('pop-filestackgroupby')?.classList.add('on');
    document.getElementById('btn-filestackgroupby')?.classList.add('open');
  }
}

const FILE_STACK_TIME_OPTIONS = [
  { id: 'hour', label: 'Часу', desc: '0–23' },
  { id: 'dow', label: 'Дню недели', desc: 'Пн–Вс' },
  { id: 'month', label: 'Месяцу', desc: 'Янв–Дек' },
  { id: 'year', label: 'Году', desc: '' },
];
window.fileStackTimeGranularity = 'month';

function setFileStackTimeGranularity(id) {
  window.fileStackTimeGranularity = id;
  renderFileStackTimeGranularityPill();
  buildFileStackChart();
}

function renderFileStackTimeGranularityPill() {
  const container = document.getElementById('fileStackGroupByPill');
  if (!container) return;
  if (fileStackMode !== 'ext_time') return;
  container.innerHTML = renderRadioPill({
    key: 'filestacktimegran',
    label: 'По',
    options: FILE_STACK_TIME_OPTIONS,
    selectedId: window.fileStackTimeGranularity,
    onSelectExpr: (id) => `setFileStackTimeGranularity('${id}')`,
  });
  const state = ensurePopState('filestacktimegran');
  if (state.open) {
    document.getElementById('pop-filestacktimegran')?.classList.add('on');
    document.getElementById('btn-filestacktimegran')?.classList.add('open');
  }
}

function setFileViz(m) { fileVizMode = m; buildFileTable(); }
function setFileStack(m) {
  fileStackMode = m;
  if (m === 'ext_time') renderFileStackTimeGranularityPill();
  else renderFileStackGroupByPill();
  buildFileStackChart();
}

let fileVizLimit = 10;

function setFileVizLimit(limit) {
  let n = parseInt(limit, 10);
  if (isNaN(n) || n < 1) n = 1;
  fileVizLimit = n;
  buildFileTable();
}

function syncFileVizLimitInput(maxPossible) {
  const input = document.getElementById('fileVizLimitInput');
  if (!input) return;
  input.max = String(Math.max(1, maxPossible));
  input.min = '1';
  if (String(fileVizLimit) !== input.value) input.value = String(fileVizLimit);
}

function buildFileTable() {
  const scope = 'filetable';
  const lpWrap = document.getElementById('lpWrap_filetable');
  if (lpWrap) lpWrap.innerHTML = localPeriodControlHtml('filetable', 'buildFileTable');
  const meta = FILE_META[fileVizMode];
  document.getElementById('fileVizTitle').textContent = meta.title;
  document.getElementById('fileVizSub').textContent = meta.sub;
  const fd = computeFilesData(scope);
  let rows = [];
  const limitWrap = document.getElementById('fileVizLimitWrap');
  if (limitWrap) limitWrap.style.display = 'flex';

  if (fileVizMode === 'ext') {
    rows = Object.entries(fd.extCount).sort((a, b) => b[1] - a[1]).map(([n, c]) => ({ n, c, color: null }));
  } else if (fileVizMode === 'size') {
    rows = Object.entries(fd.extSizeKB).sort((a, b) => b[1] - a[1])
      .map(([n, kb]) => ({ n, c: kb > 1e6 ? (kb / 1e6).toFixed(2) + ' ГБ' : (kb / 1000).toFixed(0) + ' МБ', color: null, raw: kb }));
  } else if (fileVizMode === 'user') {
    rows = USERS.filter((u) => isAuthorActiveInScope(scope, u.name))
      .map((u) => ({ n: u.name, c: fd.userCount[u.name] || 0, color: u.color }))
      .sort((a, b) => b.c - a.c);
  } else if (fileVizMode === 'action') {
    rows = Object.entries(fd.actionCount).sort((a, b) => b[1] - a[1]).map(([n, c]) => ({ n, c, color: null }));
  } else if (fileVizMode === 'depot') {
    const depotFiles = {}, depotCommitSet = {};
    const activeExt = ensureExtensionPicker(scope);
    filesCommits(scope).forEach((c) => {
      const matching = c.files.filter((f) => activeExt.has(f.ext));
      if (!matching.length) return;
      depotFiles[c.depot] = (depotFiles[c.depot] || 0) + matching.length;
      (depotCommitSet[c.depot] || (depotCommitSet[c.depot] = new Set())).add(c.cl);
    });
    rows = Object.entries(depotFiles).sort((a, b) => b[1] - a[1])
      .map(([k, c]) => {
        const nCommits = depotCommitSet[k] ? depotCommitSet[k].size : 0;
        const avgPerCommit = nCommits ? (c / nCommits).toFixed(1) : '0';
        return { n: k.replace(/^\/\//, '').replace(/\/$/, ''), c, color: null, sub: `${avgPerCommit} файлов / сабмит` };
      });
  }

  const totalRows = rows.length;
  fileVizLimit = Math.max(1, Math.min(fileVizLimit, Math.max(1, totalRows)));
  syncFileVizLimitInput(totalRows);
  rows = rows.slice(0, fileVizLimit);

  if (!rows.length) {
    document.getElementById('extTable').innerHTML = '<tr><td colspan="3" style="color:var(--muted);padding:10px">Нет данных</td></tr>';
    return;
  }

  const numericValue = (row) => (typeof row.raw === 'number' ? row.raw : (typeof row.c === 'number' ? row.c : 0));
  const maxV = Math.max(1, ...rows.map(numericValue));

  document.getElementById('extTable').innerHTML = rows.map((e) => {
    const num = numericValue(e);
    const pct = Math.min(100, +(num / maxV * 100).toFixed(1));
    const color = e.color || (meta.color || '#bc8cff');
    return `<tr>
      <td class="bar-name" style="${e.color ? 'color:' + e.color : ''}">${e.n}</td>
      <td class="bar-w"><div class="bar-bar" style="width:${pct}%;background:${color}88;border:1px solid ${color};min-width:4px"></div></td>
      <td class="bar-cnt">${typeof e.c === 'number' ? e.c.toLocaleString('ru') : e.c}${e.sub ? `<div style="font-size:10px;color:var(--muted);font-weight:400">${e.sub}</div>` : ''}</td>
    </tr>`;
  }).join('');
}

function buildFileStackChart() {
  const scope = 'filestack';
  const lpWrap = document.getElementById('lpWrap_filestack');
  if (lpWrap) lpWrap.innerHTML = localPeriodControlHtml('filestack', 'buildFileStackChart');
  const meta = FILE_STACK_META[fileStackMode];
  document.getElementById('fileStackTitle').textContent = meta.title;
  const fd = computeFilesData(scope);
  let labels = [], datasets = [];

  if (fileStackMode === 'ext' || fileStackMode === 'action') {
    const isAction = fileStackMode === 'action';
    const groupBy = window.fileStackGroupBy || 'authors';
    const fieldOf = (f) => (isAction ? f.action : f.ext);
    const topCount = isAction
      ? ACTION_LIST
      : Object.entries(fd.extCount).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([e]) => e);
    labels = topCount;
    const unitLabel = isAction ? 'действий' : 'расширений';

    const tabulate = (commitsSubset) => {
      const counts = {};
      commitsSubset.forEach((c) => c.files.forEach((f) => { counts[fieldOf(f)] = (counts[fieldOf(f)] || 0) + 1; }));
      return counts;
    };

    if (groupBy === 'depot') {
      document.getElementById('fileStackSub').textContent = `топ ${unitLabel} — стек по депо`;
      const dp = depotPickers[scope];
      datasets = DEPOTS.filter((k) => (!dp || dp.active.has(k))).map((depotKey) => {
        const counts = tabulate(filesCommits(scope).filter((c) => c.depot === depotKey));
        const col = typeof getDepotColor === 'function' ? getDepotColor(depotKey) : themeColor('muted');
        const label = depotKey.replace(/^\/\//, '').replace(/\/$/, '');
        return { label, data: topCount.map((k) => counts[k] || 0), backgroundColor: ha(col, .5), borderColor: col, borderWidth: 1, borderRadius: 2 };
      });
    } else if (groupBy === 'workspaces') {
      document.getElementById('fileStackSub').textContent = `топ ${unitLabel} — стек по воркспейсам`;
      datasets = visibleWorkspacesForScope(scope).map((ws) => {
        const counts = tabulate(filesCommits(scope).filter((c) => c.workspace === ws));
        const col = typeof getWorkspaceColor === 'function' ? getWorkspaceColor(ws) : themeColor('muted');
        return { label: ws, data: topCount.map((k) => counts[k] || 0), backgroundColor: ha(col, .5), borderColor: col, borderWidth: 1, borderRadius: 2 };
      });
    } else {
      document.getElementById('fileStackSub').textContent = `топ ${unitLabel} — стек по авторам`;
      datasets = USERS.filter((u) => isAuthorActiveInScope(scope, u.name)).map((u) => {
        const counts = tabulate(filesCommits(scope).filter((c) => c.author === u.name));
        return { label: u.name, data: topCount.map((k) => counts[k] || 0), backgroundColor: ha(u.color, .5), borderColor: u.color, borderWidth: 1, borderRadius: 2 };
      });
    }
    if (isAction) labels = topCount.map((a) => ACTION_LABELS_SHORT[a] || a);
  } else {

    const gran = window.fileStackTimeGranularity || 'month';
    const topExts = Object.entries(fd.extCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([e]) => e);
    const EXT_COLORS = ['#bc8cff', '#f0883e', '#3fb950'];

    let bucketLabels, bucketOf, subText;
    if (gran === 'hour') {
      bucketLabels = Array.from({ length: 24 }, (_, h) => h + 'h');
      bucketOf = (c) => c.date.getHours();
      subText = 'топ 3 расширения — по часам дня';
    } else if (gran === 'dow') {
      bucketLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
      bucketOf = (c) => (c.date.getDay() + 6) % 7;
      subText = 'топ 3 расширения — по дням недели';
    } else if (gran === 'year') {
      const years = [...new Set(filesCommits(scope).map((c) => c.date.getFullYear()))].sort();
      bucketLabels = years.map(String);
      bucketOf = (c) => years.indexOf(c.date.getFullYear());
      subText = 'топ 3 расширения — по годам';
    } else {
      bucketLabels = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
      bucketOf = (c) => c.date.getMonth();
      subText = 'топ 3 расширения — по месяцам';
    }
    document.getElementById('fileStackSub').textContent = subText;

    labels = bucketLabels;
    const byBucket = {};
    topExts.forEach((e) => { byBucket[e] = Array(bucketLabels.length).fill(0); });
    filesCommits(scope).forEach((c) => c.files.forEach((f) => {
      if (topExts.includes(f.ext)) {
        const idx = bucketOf(c);
        if (idx >= 0 && idx < bucketLabels.length) byBucket[f.ext][idx]++;
      }
    }));
    datasets = topExts.map((e, i) => ({ label: e, data: byBucket[e], backgroundColor: ha(EXT_COLORS[i], .5), borderColor: EXT_COLORS[i], borderWidth: 1, borderRadius: 2 }));
  }

  if (fileStackChartInst) fileStackChartInst.destroy();
  fileStackChartInst = new Chart('fileStackChart', {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { color: themeColor('muted') } },
        y: { stacked: true, grid: { color: themeColor('border') }, ticks: { color: themeColor('muted') } },
      },
    },
  });

  const legendEl = document.getElementById('fileStackChartLegend');
  if (legendEl) legendEl.innerHTML = renderStaticLegend(datasets.map((ds) => ({ color: ds.borderColor, label: ds.label })));
}

{
  const scopes = {
    filetable: { containerId: 'ext_filetable', rebuildFnNames: ['buildFileTable'] },
    filestack: { containerId: 'ext_filestack', rebuildFnNames: ['buildFileStackChart'] },
    cooccur: { containerId: 'ext_cooccur', rebuildFnNames: ['buildCooccurrenceTable'] },
    filecluster: { containerId: 'ext_filecluster', rebuildFnNames: ['buildFileClusterBlock'] },
    filecorrel: { containerId: 'ext_filecorrel', rebuildFnNames: ['buildFileCorrelations'] },
    busfactor: { containerId: 'ext_busfactor', rebuildFnNames: ['buildBusFactor'] },
    hotfiles: { containerId: 'ext_hotfiles', rebuildFnNames: ['buildHotFiles'] },
  };
  Object.keys(scopes).forEach((scope) => {
    const { containerId, rebuildFnNames } = scopes[scope];
    if (document.getElementById(containerId) && typeof registerExtensionPicker === 'function') {
      registerExtensionPicker(scope, containerId, rebuildFnNames);
      renderExtensionPicker(scope);
    }
  });
}

setTimeout(() => {
  if (typeof buildFileTable === 'function') buildFileTable();
  if (typeof buildFileStackChart === 'function') buildFileStackChart();
  if (typeof buildCooccurrenceTable === 'function') buildCooccurrenceTable();
  if (typeof buildFileClusterBlock === 'function') buildFileClusterBlock();
  if (typeof buildFileCorrelations === 'function') buildFileCorrelations();
}, 50);
