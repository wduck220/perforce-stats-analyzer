

Chart.defaults.color = themeColor('muted');
Chart.defaults.borderColor = themeColor('border');
Chart.defaults.font.family = 'Inter, sans-serif';
Chart.defaults.font.size = 11;
Chart.defaults.plugins.legend.display = false;

buildToggles();
renderHmGroupByPill();
renderHmMetricPill();
renderHmDimensionFilter();

createDepotPicker('heatmap', () => buildCal());
createDepotPicker('dist', () => buildAvgChart());
createDepotPicker('trend', () => buildWeekChart());
createDepotPicker('authors', () => { buildUserCards(); buildUserBarChart(); buildScatterLive(); });
createDepotPicker('timeline', () => buildTimeline());

createWorkspacePicker('heatmap', () => { buildToggles(); buildCal(); });
createWorkspacePicker('dist', () => { buildAvgUserBtns(); buildAvgChart(); });
createWorkspacePicker('trend', () => { buildTrendUserBtns(); buildWeekChart(); });
createWorkspacePicker('authors', () => { buildUserCards(); buildUserBarChart(); buildScatterLive(); });
createWorkspacePicker('timeline', () => buildTimeline());

['heatmap', 'dist', 'trend', 'authors', 'timeline'].forEach((pickerId) => {
  initDepotPickerDOM(pickerId, 'Все депо');
  if (!['heatmap', 'dist', 'trend'].includes(pickerId)) {
    initWorkspacePickerDOM(pickerId, 'Все воркспейсы');
  }
});

buildCal();
buildAvgChart();
buildAvgUserBtns();
buildWeekChart();
renderCardsGroupByPill();
buildUserCards();
buildAuthorDonut();
if (typeof renderAuthorClusterGroupByPill === 'function') renderAuthorClusterGroupByPill();
if (typeof renderAuthorClusterInfo === 'function') renderAuthorClusterInfo();
buildUserBarChart();
buildScatterLive();
buildFileTable();
renderFileStackGroupByPill();
buildFileStackChart();
if (typeof renderAnomLevelPill === 'function') renderAnomLevelPill();
renderAnomalies();
initTlYearSel();
buildTimeline();
updateGlobalPeriodStatusBar();
(function () {
  const btn = document.getElementById('themeToggleBtn');
  if (btn && document.documentElement.getAttribute('data-theme') === 'light') btn.innerHTML = '🌙 Тёмная тема';
})();

const GENERIC_TREE_SCOPES = ['scatter', 'filetable', 'filestack', 'cooccur', 'filecluster'];

function rebuildAllVisuals() {
  buildToggles();
  renderHmDimensionFilter();
  buildCal();
  buildAvgUserBtns();
  buildAvgChart();
  buildTrendUserBtns();
  buildWeekChart();
  if (typeof buildBarUserBtns === 'function') buildBarUserBtns();
  buildUserBarChart();
  if (typeof renderCardsGroupByPill === 'function') renderCardsGroupByPill();
  buildUserCards();
  buildAuthorDonut();
  if (typeof renderAuthorClusterGroupByPill === 'function') renderAuthorClusterGroupByPill();
  if (typeof renderAuthorClusterInfo === 'function') renderAuthorClusterInfo();
  buildScatterLive();
  if (typeof renderAuthorTree === 'function') {
    GENERIC_TREE_SCOPES.forEach((scope) => renderAuthorTree(scope));
  }
  buildFileTable();
  if (typeof renderFileStackGroupByPill === 'function') renderFileStackGroupByPill();
  buildFileStackChart();
  if (typeof buildCooccurrenceTable === 'function') buildCooccurrenceTable();
  if (typeof buildFileClusterBlock === 'function') buildFileClusterBlock();
  buildTimeline();
  if (typeof renderAnomLevelPill === 'function') renderAnomLevelPill();
  renderAnomalies();
}

function rebuildWholeDashboard() {
  rebuildAllVisuals();
  if (typeof renderApriori === 'function') renderApriori();
  if (typeof buildBusFactor === 'function') buildBusFactor();
  if (typeof buildHotFiles === 'function') buildHotFiles();
  if (typeof rebuildAllFactsTabs === 'function') rebuildAllFactsTabs();
}

function setGlobalPeriodPreset(preset) {
  const fromEl = document.getElementById('gpFrom');
  const toEl = document.getElementById('gpTo');
  const dash = document.getElementById('gpDash');
  if (preset === 'custom') {
    fromEl.style.display = ''; toEl.style.display = ''; dash.style.display = '';
    if (!fromEl.value || !toEl.value) {
      const days = filteredDays();
      const last = days[days.length - 1]?.date || new Date();
      toEl.value = last.toISOString().slice(0, 10);
      const from = new Date(last); from.setDate(from.getDate() - 29);
      fromEl.value = from.toISOString().slice(0, 10);
    }
    setGlobalPeriodCustom();
    return;
  }
  fromEl.style.display = 'none'; toEl.style.display = 'none'; dash.style.display = 'none';
  if (preset === 'all') {
    window.globalPeriod = { from: null, to: null };
  } else {
    const n = parseInt(preset, 10);
    const allDays = DAY_DATA;
    const last = allDays[allDays.length - 1]?.date || new Date();
    const from = new Date(last); from.setDate(from.getDate() - (n - 1));
    window.globalPeriod = { from: from.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
  }
  applyGlobalPeriod();
  updateGlobalPeriodStatusBar();
}

function setGlobalPeriodCustom() {
  const from = document.getElementById('gpFrom').value || null;
  const to = document.getElementById('gpTo').value || null;
  window.globalPeriod = { from, to };
  applyGlobalPeriod();
  updateGlobalPeriodStatusBar();
}

function updateGlobalPeriodStatusBar() {
  const days = filteredDays();
  const rangeEl = document.getElementById('gpCurrentRange');
  const authEl = document.getElementById('gpAuthorCount');
  const subEl = document.getElementById('gpSubmitCount');
  if (!days.length) {
    if (rangeEl) rangeEl.textContent = 'нет данных';
    if (authEl) authEl.textContent = '0';
    if (subEl) subEl.textContent = '0';
    return;
  }
  const commits = anomAllCommits ? anomAllCommits() : [];
  const authorSet = new Set(commits.map((c) => c.author));
  if (rangeEl) rangeEl.textContent = days[0].date.toLocaleDateString('ru') + ' → ' + days[days.length - 1].date.toLocaleDateString('ru');
  if (authEl) authEl.textContent = authorSet.size;
  if (subEl) subEl.textContent = commits.length.toLocaleString('ru');
}

function toggleTheme() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  setTheme(isLight ? 'dark' : 'light');
}
function setTheme(theme) {
  if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
  else document.documentElement.removeAttribute('data-theme');
  try { localStorage.setItem('dashboardTheme', theme); } catch (e) {}
  const btn = document.getElementById('themeToggleBtn');
  if (btn) btn.innerHTML = theme === 'light' ? '🌙 Тёмная тема' : '☀ Светлая тема';
  if (typeof rebuildWholeDashboard === 'function') rebuildWholeDashboard();
}

function resetAllFilters() {
  Object.keys(depotPickers).forEach((scope) => { depotPickers[scope].active = new Set(DEPOTS); });
  Object.keys(workspacePickers).forEach((scope) => { workspacePickers[scope].active = new Set(WORKSPACE_LIST); });

  if (typeof activeUsers !== 'undefined') activeUsers = new Set(USERS.map((u) => u.name));
  if (typeof avgActiveUsers !== 'undefined') avgActiveUsers = new Set(USERS.map((u) => u.name));
  if (typeof trendActiveUsers !== 'undefined') trendActiveUsers = new Set(USERS.map((u) => u.name));
  window.barActiveUsers = new Set(USERS.map((u) => u.name));
  if (window._activeAuthors) {
    Object.keys(window._activeAuthors).forEach((scope) => { window._activeAuthors[scope] = new Set(USERS.map((u) => u.name)); });
  }
  if (typeof authorTreeStates !== 'undefined') {
    Object.keys(authorTreeStates).forEach((scope) => { authorTreeStates[scope] = new Set(USERS.map((u) => u.name)); });
  }
  if (typeof hmActionActive !== 'undefined') hmActionActive = new Set(ACTION_LIST);
  if (typeof hmWeightActive !== 'undefined') hmWeightActive = new Set(WEIGHT_BUCKETS);

  ['heatmap', 'dist', 'trend', 'authors', 'cards', 'bar', 'scatter', 'filetable', 'filestack', 'cooccur', 'timeline'].forEach((scope) => {
    if (document.getElementById('df_' + scope)) initDepotPickerDOM(scope);
  });

  if (document.getElementById('ws_cards')) initWorkspacePickerDOM('cards');

  rebuildAllVisuals();
}
