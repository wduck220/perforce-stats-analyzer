

const AVG_TITLES = {
  hour: 'Среднее по часам дня',
  dow: 'Среднее по дням недели',
  dom: 'Среднее по дням месяца',
  month: 'Среднее по месяцам года',
};

const AVG_LABELS = {
  hour: Array.from({ length: 24 }, (_, h) => h + 'h'),
  dow: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
  dom: Array.from({ length: 31 }, (_, i) => String(i + 1)),
  month: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
};

function avgCountFn(metric, actionOverride) {
  if (actionOverride) return (commits) => commits.reduce((s, c) => s + c.files.filter((f) => f.action === actionOverride).length, 0);
  if (metric === 'files') return (commits) => commits.reduce((s, c) => s + c.nFiles, 0);
  if (metric === 'action') return (commits) => commits.reduce((s, c) => s + c.files.filter((f) => avgActionActive.has(f.action)).length, 0);
  if (metric === 'weight') return (commits) => commits.reduce((s, c) => s + (c.sizeGB || 0), 0);
  return (commits) => commits.length;
}

function avgData(user, period, metric, actionOverride) {
  const days = daysForBlock('dist');
  const countOf = avgCountFn(metric, actionOverride);
  const sums = {};

  if (period === 'hour') {

    days.forEach((day) => {
      const byHour = {};
      depotCommitsFor('dist', day, user.name).forEach((c) => {
        const hour = c.date.getHours();
        (byHour[hour] || (byHour[hour] = [])).push(c);
      });
      Object.keys(byHour).forEach((hour) => {
        sums[hour] = (sums[hour] || 0) + countOf(byHour[hour]);
      });
    });
    const totalDays = days.length || 1;
    return AVG_LABELS.hour.map((_, i) => +((sums[i] || 0) / totalDays).toFixed(3));
  }

  const bucketOccurrences = {};
  days.forEach((day) => {
    let bucketIndex;
    if (period === 'dow') bucketIndex = (day.date.getDay() + 6) % 7;
    else if (period === 'dom') bucketIndex = day.date.getDate() - 1;
    else if (period === 'month') bucketIndex = day.date.getMonth();

    sums[bucketIndex] = (sums[bucketIndex] || 0) + countOf(depotCommitsFor('dist', day, user.name));
    bucketOccurrences[bucketIndex] = (bucketOccurrences[bucketIndex] || 0) + 1;
  });

  return AVG_LABELS[period].map((_, i) =>
    bucketOccurrences[i] ? +((sums[i] || 0) / bucketOccurrences[i]).toFixed(2) : 0
  );
}

function distDayCommits(day) {
  const out = [];
  USERS.forEach((u) => {
    if (!avgActiveUsers.has(u.name)) return;
    depotCommitsFor('dist', day, u.name).forEach((c) => out.push(c));
  });
  return out;
}

function avgDataGeneric(period, dimension, key, metric, actionOverride) {
  const days = daysForBlock('dist');
  const countOf = avgCountFn(metric, actionOverride);
  const sums = {};
  const matchesDim = (c) => (dimension === 'depot' ? c.depot === key : c.workspace === key);

  if (period === 'hour') {
    days.forEach((day) => {
      const byHour = {};
      distDayCommits(day).filter(matchesDim).forEach((c) => {
        const hour = c.date.getHours();
        (byHour[hour] || (byHour[hour] = [])).push(c);
      });
      Object.keys(byHour).forEach((hour) => {
        sums[hour] = (sums[hour] || 0) + countOf(byHour[hour]);
      });
    });
    const totalDays = days.length || 1;
    return AVG_LABELS.hour.map((_, i) => +((sums[i] || 0) / totalDays).toFixed(3));
  }

  const bucketOccurrences = {};
  days.forEach((day) => {
    let bucketIndex;
    if (period === 'dow') bucketIndex = (day.date.getDay() + 6) % 7;
    else if (period === 'dom') bucketIndex = day.date.getDate() - 1;
    else if (period === 'month') bucketIndex = day.date.getMonth();

    const count = countOf(distDayCommits(day).filter(matchesDim));
    sums[bucketIndex] = (sums[bucketIndex] || 0) + count;
    bucketOccurrences[bucketIndex] = (bucketOccurrences[bucketIndex] || 0) + 1;
  });

  return AVG_LABELS[period].map((_, i) =>
    bucketOccurrences[i] ? +((sums[i] || 0) / bucketOccurrences[i]).toFixed(2) : 0
  );
}

function buildAvgChart() {
  const lpWrap = document.getElementById('lpWrap_dist');
  if (lpWrap) lpWrap.innerHTML = localPeriodControlHtml('dist', 'buildAvgChart');
  const groupBy = window.avgGroupBy || 'authors';
  const metric = window.avgMetric || 'intensity';
  document.getElementById('avgTitle').textContent = AVG_TITLES[avgPeriod];
  const labels = AVG_LABELS[avgPeriod];
  const yTitles = { intensity: 'ср. сабмитов', files: 'ср. файлов', action: 'ср. файлов (действие)', weight: 'ср. объём, ГБ' };
  const yTitle = yTitles[metric] || yTitles.intensity;

  let datasets;
  const isActionMetric = metric === 'action';
  const ACTION_SHADE_ALPHA = { edit: 0.85, add: 0.55, delete: 0.3 };

  if (groupBy === 'workspaces' || groupBy === 'depot') {
    const isDepot = groupBy === 'depot';
    const keys = isDepot ? DEPOTS.filter((k) => (!depotPickers['dist'] || depotPickers['dist'].active.has(k))) : visibleWorkspacesForScope('dist');
    if (isActionMetric) {
      datasets = [];
      keys.forEach((key) => {
        const color = isDepot ? getDepotColor(key) : getWorkspaceColor(key);
        const label = isDepot ? key.replace(/^\/\//, '').replace(/\/$/, '') : key;
        ACTION_LIST.filter((a) => avgActionActive.has(a)).forEach((a) => {
          datasets.push({
            label: `${label} · ${ACTION_LABELS[a]}`,
            data: avgDataGeneric(avgPeriod, isDepot ? 'depot' : 'workspace', key, metric, a),
            backgroundColor: ha(color, ACTION_SHADE_ALPHA[a]),
            borderColor: color,
            borderWidth: 1,
            borderRadius: 2,
            stack: key,
          });
        });
      });
    } else {
      datasets = keys.map((key) => {
        const color = isDepot ? getDepotColor(key) : getWorkspaceColor(key);
        const label = isDepot ? key.replace(/^\/\//, '').replace(/\/$/, '') : key;
        return {
          label,
          data: avgDataGeneric(avgPeriod, isDepot ? 'depot' : 'workspace', key, metric),
          backgroundColor: ha(color, 0.45),
          borderColor: color,
          borderWidth: 1,
          borderRadius: 3,
        };
      });
    }
  } else {
    const wsPickerForDist = workspacePickers['dist'];
    const visUsers = USERS.filter((u) => {
      if (!avgActiveUsers.has(u.name)) return false;
      const owned = workspacesOwnedBy(u.name);
      if (!owned.length || !wsPickerForDist) return true;
      return owned.some((ws) => wsPickerForDist.active.has(ws));
    });
    if (isActionMetric) {
      datasets = [];
      visUsers.forEach((u) => {
        ACTION_LIST.filter((a) => avgActionActive.has(a)).forEach((a) => {
          datasets.push({
            label: `${u.name} · ${ACTION_LABELS[a]}`,
            data: avgData(u, avgPeriod, metric, a),
            backgroundColor: ha(u.color, ACTION_SHADE_ALPHA[a]),
            borderColor: u.color,
            borderWidth: 1,
            borderRadius: 2,
            stack: u.name,
          });
        });
      });
    } else {
      datasets = visUsers.map((u) => ({
        label: u.name,
        data: avgData(u, avgPeriod, metric),
        backgroundColor: ha(u.color, 0.45),
        borderColor: u.color,
        borderWidth: 1,
        borderRadius: 3,
      }));
    }
  }

  if (avgChartInst) avgChartInst.destroy();
  avgChartInst = new Chart('avgChart', {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}` } },
      },
      scales: {
        x: { stacked: isActionMetric, grid: { display: false }, ticks: { color: themeColor('muted'), maxRotation: 0, autoSkip: true, maxTicksLimit: 24 } },
        y: { stacked: isActionMetric, grid: { color: themeColor('border') }, ticks: { color: themeColor('muted') }, title: { display: true, text: yTitle, font: { size: 10 }, color: themeColor('muted') } },
      },
    },
  });

  const legendEl = document.getElementById('avgChartLegend');
  if (legendEl) {
    legendEl.innerHTML = renderStaticLegend(datasets.map((ds) => ({ color: ds.borderColor, label: ds.label })));
  }
}

const AVG_PERIOD_OPTIONS = [
  { id: 'hour', label: 'Часы дня', desc: '0–23' },
  { id: 'dow', label: 'Дни недели', desc: 'Пн–Вс' },
  { id: 'dom', label: 'Дни месяца', desc: '1–31' },
  { id: 'month', label: 'Месяцы года', desc: 'Янв–Дек' },
];

function setAvgP(period) {
  avgPeriod = period;
  renderAvgPeriodPill();
  buildAvgChart();
}

function renderAvgPeriodPill() {
  const container = document.getElementById('avgPeriodPill');
  if (!container) return;
  container.innerHTML = renderRadioPill({
    key: 'avgperiod',
    label: 'Период',
    options: AVG_PERIOD_OPTIONS,
    selectedId: avgPeriod,
    onSelectExpr: (id) => `setAvgP('${id}')`,
  });
  const state = ensurePopState('avgperiod');
  if (state.open) {
    document.getElementById('pop-avgperiod')?.classList.add('on');
    document.getElementById('btn-avgperiod')?.classList.add('open');
  }
}

renderAvgPeriodPill();

const AVG_METRIC_OPTIONS = [
  { id: 'intensity', label: 'Сабмиты', desc: 'кол-во сабмитов' },
  { id: 'files', label: 'Файлы', desc: 'кол-во файлов' },
  { id: 'action', label: 'Действия', desc: 'edit/add/delete' },
  { id: 'weight', label: 'Вес', desc: 'объём засабмиченного' },
];
window.avgMetric = 'intensity';
let avgActionActive = new Set(ACTION_LIST);

function setAvgMetric(id) {
  window.avgMetric = id;
  renderAvgMetricPill();
  renderAvgMetricFilter();
  buildAvgChart();
}

function renderAvgMetricPill() {
  const container = document.getElementById('avgMetricPill');
  if (!container) return;
  container.innerHTML = renderRadioPill({
    key: 'avgmetric',
    label: 'Показатель',
    options: AVG_METRIC_OPTIONS,
    selectedId: window.avgMetric,
    onSelectExpr: (id) => `setAvgMetric('${id}')`,
  });
  const state = ensurePopState('avgmetric');
  if (state.open) {
    document.getElementById('pop-avgmetric')?.classList.add('on');
    document.getElementById('btn-avgmetric')?.classList.add('open');
  }
}

function renderAvgMetricFilter() {
  const container = document.getElementById('avgMetricFilter');
  if (!container) return;
  if (window.avgMetric !== 'action') {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = renderDropdownFilter({
    key: 'avg-action',
    icon: DROPDOWN_ICONS.depot,
    label: 'Действия',
    searchPlaceholder: '',
    items: ACTION_LIST,
    itemText: (a) => ACTION_LABELS[a],
    isActive: (a) => avgActionActive.has(a),
    activeCount: avgActionActive.size,
    itemExtraHtml: (a) => `<div class="dpi-dot" style="background:${ACTION_COLORS[a]}"></div>`,
    onSearchExpr: '',
    onSelectAllExpr: 'avgActionSelectAll()',
    onItemClickExpr: (a) => `avgActionToggle('${a}')`,
  });
  const st = ensurePopState('avg-action');
  if (st.open) {
    document.getElementById('pop-avg-action')?.classList.add('on');
    document.getElementById('btn-avg-action')?.classList.add('open');
  }
}

function avgActionToggle(action) {
  if (avgActionActive.has(action)) avgActionActive.delete(action);
  else avgActionActive.add(action);
  renderAvgMetricFilter();
  buildAvgChart();
}

function avgActionSelectAll() {
  avgActionActive = new Set(ACTION_LIST);
  renderAvgMetricFilter();
  buildAvgChart();
}

renderAvgMetricPill(); renderAvgMetricFilter();

const AVG_USR_KEY = 'authtree-dist';

function buildAvgUserBtns() {
  const container = document.getElementById('avgUBtns');
  if (!container) return;

  const wsPicker = workspacePickers['dist'];

  container.innerHTML = renderAuthorWorkspaceTree({
    key: AVG_USR_KEY,
    users: USERS,
    isAuthorActive: (u) => avgActiveUsers.has(u.name),
    workspacesForAuthor: (name) => workspacesOwnedBy(name),
    isWorkspaceActive: (ws) => !wsPicker || wsPicker.active.has(ws),
    activeAuthorCount: avgActiveUsers.size,
    activeWorkspaceCount: wsPicker ? wsPicker.active.size : WORKSPACE_LIST.length,
    totalWorkspaceCount: WORKSPACE_LIST.length,
    onSearchExpr: `onAvgUserSearch(this.value)`,
    onSelectAllExpr: `toggleAvgUserAll()`,
    onAuthorToggleExpr: (u) => `toggleAvgUser('${u.name.replace(/'/g, "\\'")}')`,
    onWorkspaceToggleExpr: (ws) => `workspaceToggleOne('dist','${ws}')`,
    rerenderExpr: `buildAvgUserBtns()`,
  });

  const state = ensurePopState(AVG_USR_KEY);
  if (state.open) {
    document.getElementById('pop-' + AVG_USR_KEY)?.classList.add('on');
    document.getElementById('btn-' + AVG_USR_KEY)?.classList.add('open');
  }
  if (typeof buildPrintSummaryDist === 'function') buildPrintSummaryDist();
}

function onAvgUserSearch(value) {
  handleDropdownFilterSearch(AVG_USR_KEY, value, buildAvgUserBtns);
}

function toggleAvgUserAll() {
  avgActiveUsers = new Set(USERS.map((u) => u.name));
  if (workspacePickers['dist']) workspacePickers['dist'].active = new Set(WORKSPACE_LIST);
  buildAvgUserBtns();
  buildAvgChart();
}

function toggleAvgUser(name) {
  if (avgActiveUsers.has(name)) {
    avgActiveUsers.delete(name);
  } else {
    avgActiveUsers.add(name);
  }
  buildAvgUserBtns();
  buildAvgChart();
}

window.avgGroupBy = 'authors';

function setAvgGroupBy(mode) {
  window.avgGroupBy = mode;
  renderAvgGroupByPill();
  buildAvgChart();
}

function renderAvgGroupByPill() {
  const container = document.getElementById('avgGroupByPill');
  if (!container) return;
  container.innerHTML = renderRadioPill({
    key: 'avggroupby',
    label: 'Группировать по',
    options: CHART_GROUP_BY_OPTIONS,
    selectedId: window.avgGroupBy,
    onSelectExpr: (id) => `setAvgGroupBy('${id}')`,
  });
  const state = ensurePopState('avggroupby');
  if (state.open) {
    document.getElementById('pop-avggroupby')?.classList.add('on');
    document.getElementById('btn-avggroupby')?.classList.add('open');
  }
}

renderAvgGroupByPill();
