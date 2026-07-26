

(function initAuthorsSectionFilters() {

  const SCOPES = [
    { scope: 'cards', rebuild: ['buildUserCards', 'buildAuthorDonut'] },
    { scope: 'authorcluster', rebuild: ['renderAuthorClusterInfo'] },
    { scope: 'bar', rebuild: ['buildBarUserBtns', 'buildUserBarChart'] },
    { scope: 'scatter', rebuild: ['buildScatterChart'] },
    { scope: 'filetable', rebuild: ['buildFileTable'] },
    { scope: 'filestack', rebuild: ['buildFileStackChart'] },
    { scope: 'cooccur', rebuild: ['buildCooccurrenceTable'] },
    { scope: 'filecluster', rebuild: ['buildFileClusterBlock'] },
    { scope: 'filecorrel', rebuild: ['buildFileCorrelations'] },
    { scope: 'anomagg', rebuild: ['renderAnomalies'] },
    { scope: 'busfactor', rebuild: ['buildBusFactor'] },
    { scope: 'hotfiles', rebuild: ['buildHotFiles'] },
  ];

  const TREE_SCOPES = ['scatter', 'cards', 'anomagg', 'busfactor', 'hotfiles', 'authorcluster'];

  function initPerBlockFilters() {
    SCOPES.forEach(({ scope, rebuild }) => {
      const isTreeScope = TREE_SCOPES.includes(scope);
      const onChange = () => {
        if (isTreeScope) renderAuthorTree(scope);
        rebuild.forEach((fnName) => {
          if (typeof window[fnName] === 'function') window[fnName]();
        });
      };

      if (document.getElementById('df_' + scope)) {
        createDepotPicker(scope, onChange);
        initDepotPickerDOM(scope);
      }
      if (document.getElementById('ws_' + scope) && typeof createWorkspacePicker === 'function') {
        createWorkspacePicker(scope, onChange);

        if (scope !== 'bar' && !isTreeScope) initWorkspacePickerDOM(scope);
      }
      if (isTreeScope) {
        registerAuthorTree(scope, 'ws_' + scope, rebuild);
      }
    });

    initBarGroupBy();
    initScatterColorBy();
    if (typeof buildBarUserBtns === 'function') buildBarUserBtns();
    TREE_SCOPES.forEach((scope) => renderAuthorTree(scope));

    if (typeof buildUserCards === 'function') buildUserCards();
    if (typeof buildUserBarChart === 'function') buildUserBarChart();
    if (typeof buildScatterChart === 'function') buildScatterChart();
    if (typeof buildFileTable === 'function') buildFileTable();
    if (typeof buildFileStackChart === 'function') buildFileStackChart();
    if (typeof buildCooccurrenceTable === 'function') buildCooccurrenceTable();
    if (typeof buildFileClusterBlock === 'function') buildFileClusterBlock();
  }

  const GROUP_BY_OPTIONS = CHART_GROUP_BY_OPTIONS;

  function initBarGroupBy() {
    window._barGroupBy = 'authors';
    renderBarGroupByPill();
    window.setBarGroupBy = function setBarGroupBy(mode) {
      window._barGroupBy = mode;
      renderBarGroupByPill();
      if (typeof buildUserBarChart === 'function') buildUserBarChart();
    };
  }

  function renderBarGroupByPill() {
    const container = document.getElementById('barGroupByPill');
    if (!container) return;
    container.innerHTML = renderRadioPill({
      key: 'bargroupby',
      label: 'Группировать по',
      options: GROUP_BY_OPTIONS,
      selectedId: window._barGroupBy,
      onSelectExpr: (id) => `setBarGroupBy('${id}')`,
    });
    const state = ensurePopState('bargroupby');
    if (state.open) {
      document.getElementById('pop-bargroupby')?.classList.add('on');
      document.getElementById('btn-bargroupby')?.classList.add('open');
    }
  }

  function initScatterColorBy() {
    window._scatterColorBy = 'authors';
    renderScatterColorByPill();
    window.setScatterColorBy = function setScatterColorBy(mode) {
      window._scatterColorBy = mode;
      renderScatterColorByPill();
      if (typeof buildScatterChart === 'function') buildScatterChart();
    };
  }

  function renderScatterColorByPill() {
    const container = document.getElementById('scatterColorByPill');
    if (!container) return;
    container.innerHTML = renderRadioPill({
      key: 'scattercolorby',
      label: 'Цвет точек —',
      options: GROUP_BY_OPTIONS,
      selectedId: window._scatterColorBy,
      onSelectExpr: (id) => `setScatterColorBy('${id}')`,
    });
    const state = ensurePopState('scattercolorby');
    if (state.open) {
      document.getElementById('pop-scattercolorby')?.classList.add('on');
      document.getElementById('btn-scattercolorby')?.classList.add('open');
    }
  }

initPerBlockFilters();
})();
