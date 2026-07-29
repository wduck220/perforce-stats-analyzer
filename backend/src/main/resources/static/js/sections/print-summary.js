

function pfsRow(label, items) {
  const onCount = items.filter((i) => i.on).length;

  const chipsHtml = items.length
    ? items.map((i) => {
        const dot = i.color ? `<span class="dot" style="background:${i.color}"></span>` : '';
        const suffix = i.on ? '' : ' — искл.';
        return `<span class="pfs-chip${i.on ? '' : ' excl'}">${dot}${escapeHtml(i.name)}${suffix}</span>`;
      }).join('')
    : `<span class="none">ничего не выбрано</span>`;

  return `<tr><td>${label} <span style="opacity:.6">(${onCount}/${items.length})</span></td><td class="items">${chipsHtml}</td></tr>`;
}

function pfsDepotItems(scope) {
  const dp = depotPickers[scope];
  return DEPOT_LIST.map((d) => ({ name: '//' + d.label, color: getDepotColor(d.key), on: dp ? dp.active.has(d.key) : true }));
}

function pfsWorkspaceItems(scope) {
  const wp = workspacePickers[scope];
  return (WORKSPACE_LIST || []).map((ws) => ({ name: ws, color: getWorkspaceColor(ws), on: wp ? wp.active.has(ws) : true }));
}

function pfsDepotTableRow(scope) {
  return pfsRow('Депо', pfsDepotItems(scope));
}

function pfsAuthorWorkspaceRows(scope, authorActiveSet) {
  const wp = workspacePickers[scope];
  return USERS.map((u) => {
    const authorOn = authorActiveSet ? authorActiveSet.has(u.name) : true;
    const ownedWs = workspacesOwnedBy(u.name);
    const wsItems = ownedWs.map((ws) => ({
      name: ws,
      color: getWorkspaceColor(ws),
      on: authorOn && (!wp || wp.active.has(ws)),
    }));
    const dot = `<span class="dot" style="background:${u.color}"></span>`;
    const label = `${dot}${escapeHtml(u.name)}${authorOn ? '' : ' — искл.'}`;
    return pfsRow(label, wsItems);
  }).join('');
}

function buildPrintSummaryHeatmap() {
  const container = document.getElementById('pfs_heatmap');
  if (!container) return;
  const activeSet = typeof activeUsers !== 'undefined' ? activeUsers : null;
  let extraRow = '';

  const metric = typeof window.hmMetric !== 'undefined' ? window.hmMetric : 'intensity';
  if ((metric === 'action' || metric === 'weight') && typeof HM_METRIC_OPTIONS !== 'undefined') {
    const modeLabel = (HM_METRIC_OPTIONS.find((o) => o.id === metric) || {}).label || metric;
    if (metric === 'action') {
      const items = ACTION_LIST.map((a) => ({ name: ACTION_LABELS[a], color: ACTION_COLORS[a], on: hmActionActive.has(a) }));
      extraRow = pfsRow('Показатель: ' + modeLabel, items);
    } else {
      const items = WEIGHT_BUCKETS.map((b) => ({ name: WEIGHT_BUCKET_LABELS[b](), color: WEIGHT_BUCKET_COLORS[b], on: hmWeightActive.has(b) }));
      extraRow = pfsRow('Показатель: ' + modeLabel, items);
    }
  }

  container.innerHTML = `<table class="pfs-table">${pfsAuthorWorkspaceRows('heatmap', activeSet)}${pfsDepotTableRow('heatmap')}${extraRow}</table>`;
}

function buildPrintSummaryDist() {
  const container = document.getElementById('pfs_dist');
  if (!container) return;
  const activeSet = typeof avgActiveUsers !== 'undefined' ? avgActiveUsers : null;
  container.innerHTML = `<table class="pfs-table">${pfsAuthorWorkspaceRows('dist', activeSet)}${pfsDepotTableRow('dist')}</table>`;
}

function buildPrintSummaryTrend() {
  const container = document.getElementById('pfs_trend');
  if (!container) return;
  const activeSet = typeof trendActiveUsers !== 'undefined' ? trendActiveUsers : null;
  container.innerHTML = `<table class="pfs-table">${pfsAuthorWorkspaceRows('trend', activeSet)}${pfsDepotTableRow('trend')}</table>`;
}

function buildAuthorsBlockSummary(scope, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = `<table class="pfs-table">${pfsRow('Депо', pfsDepotItems(scope))}${pfsRow('Воркспейс', pfsWorkspaceItems(scope))}</table>`;
}

function buildPrintSummaryCards() { buildAuthorsBlockSummary('cards', 'pfs_cards'); }

function buildPrintSummaryBar() {
  const container = document.getElementById('pfs_bar');
  if (!container) return;
  const activeSet = typeof barActiveUsers !== 'undefined' ? barActiveUsers : null;
  container.innerHTML = `<table class="pfs-table">${pfsAuthorWorkspaceRows('bar', activeSet)}${pfsDepotTableRow('bar')}</table>`;
}

function buildPrintSummaryScatter() {
  const container = document.getElementById('pfs_scatter');
  if (!container) return;
  const activeSet = (typeof authorTreeStates !== 'undefined' && authorTreeStates['scatter']) || null;
  container.innerHTML = `<table class="pfs-table">${pfsAuthorWorkspaceRows('scatter', activeSet)}${pfsDepotTableRow('scatter')}</table>`;
}

const PRINT_SUMMARY_BUILDERS = {
  heatmap: [buildPrintSummaryHeatmap],
  dist: [buildPrintSummaryDist],
  trend: [buildPrintSummaryTrend],
  cards: [buildPrintSummaryCards],
  bar: [buildPrintSummaryBar],
  scatter: [buildPrintSummaryScatter],
};

function refreshPrintSummaryFor(pickerId) {
  (PRINT_SUMMARY_BUILDERS[pickerId] || []).forEach((fn) => fn());
}

function rebuildAllPrintSummaries() {
  Object.values(PRINT_SUMMARY_BUILDERS).forEach((fns) => fns.forEach((fn) => fn()));
}

function togglePdfPreview() {
  document.body.classList.toggle('pdf-preview');
  document.getElementById('pdfPreviewToggle')?.classList.toggle('on');
  rebuildAllPrintSummaries();
}

rebuildAllPrintSummaries();
