

let trendActiveUsers = new Set(USERS.map((u) => u.name));
const TREND_USR_KEY = 'authtree-trend';

function refreshTrendChart() {
  if (typeof buildWeekChart === 'function') buildWeekChart();
}

function buildTrendUserBtns() {
  const container = document.getElementById('usrTrendBtns');
  if (!container) return;

  const wsPicker = workspacePickers['trend'];

  container.innerHTML = renderAuthorWorkspaceTree({
    key: TREND_USR_KEY,
    users: USERS,
    isAuthorActive: (u) => trendActiveUsers.has(u.name),
    workspacesForAuthor: (name) => workspacesOwnedBy(name),
    isWorkspaceActive: (ws) => !wsPicker || wsPicker.active.has(ws),
    activeAuthorCount: trendActiveUsers.size,
    activeWorkspaceCount: wsPicker ? wsPicker.active.size : WORKSPACE_LIST.length,
    totalWorkspaceCount: WORKSPACE_LIST.length,
    onSearchExpr: `onTrendUserSearch(this.value)`,
    onSelectAllExpr: `toggleTrendUserAll()`,
    onAuthorToggleExpr: (u) => `toggleTrendUser('${u.name.replace(/'/g, "\\'")}')`,
    onWorkspaceToggleExpr: (ws) => `workspaceToggleOne('trend','${ws}')`,
    rerenderExpr: `buildTrendUserBtns()`,
  });

  const state = ensurePopState(TREND_USR_KEY);
  if (state.open) {
    document.getElementById('pop-' + TREND_USR_KEY)?.classList.add('on');
    document.getElementById('btn-' + TREND_USR_KEY)?.classList.add('open');
  }
}

function onTrendUserSearch(value) {
  handleDropdownFilterSearch(TREND_USR_KEY, value, buildTrendUserBtns);
}

function toggleTrendUserAll() {
  trendActiveUsers = new Set(USERS.map((u) => u.name));
  if (workspacePickers['trend']) workspacePickers['trend'].active = new Set(WORKSPACE_LIST);
  buildTrendUserBtns();
  refreshTrendChart();
  if (typeof buildPrintSummaryTrend === 'function') buildPrintSummaryTrend();
}

function toggleTrendUser(name) {
  if (trendActiveUsers.has(name)) {
    trendActiveUsers.delete(name);
  } else {
    trendActiveUsers.add(name);
  }
  buildTrendUserBtns();
  refreshTrendChart();
  if (typeof buildPrintSummaryTrend === 'function') buildPrintSummaryTrend();
}

buildTrendUserBtns();

window.trendGroupBy = 'authors';

function setTrendGroupBy(mode) {
  window.trendGroupBy = mode;
  renderTrendGroupByPill();
  if (typeof buildWeekChart === 'function') buildWeekChart();
}

function renderTrendGroupByPill() {
  const container = document.getElementById('trendGroupByPill');
  if (!container) return;
  container.innerHTML = renderRadioPill({
    key: 'trendgroupby',
    label: 'Группировать по',
    options: CHART_GROUP_BY_OPTIONS,
    selectedId: window.trendGroupBy,
    onSelectExpr: (id) => `setTrendGroupBy('${id}')`,
  });
  const state = ensurePopState('trendgroupby');
  if (state.open) {
    document.getElementById('pop-trendgroupby')?.classList.add('on');
    document.getElementById('btn-trendgroupby')?.classList.add('open');
  }
}

renderTrendGroupByPill();
