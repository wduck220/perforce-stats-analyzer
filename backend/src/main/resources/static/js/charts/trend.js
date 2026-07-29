

const TREND_TITLES = { day: 'По дням', week: 'По неделям', month: 'По месяцам', year: 'По годам' };
const TREND_SUBS = {
  day: 'сабмиты за каждый день',
  week: 'сабмиты за каждую неделю',
  month: 'сабмиты за каждый месяц',
  year: 'сабмиты за каждый год',
};

function trendKey(date, gran) {
  if (gran === 'day') return date.toISOString().slice(0, 10);
  if (gran === 'week') { const t = new Date(date); t.setDate(t.getDate() - ((t.getDay() + 6) % 7)); return t.toISOString().slice(0, 10); }
  if (gran === 'month') return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  return String(date.getFullYear());
}

function trendLabel(key, gran) {
  if (gran === 'day' || gran === 'week') { const d = new Date(key); return d.toLocaleDateString('ru', { day: 'numeric', month: 'short' }); }
  if (gran === 'month') { const [y, m] = key.split('-'); return ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'][+m - 1] + " '" + y.slice(2); }
  return key;
}

const TREND_GRAN_OPTIONS = [
  { id: 'day', label: 'День' },
  { id: 'week', label: 'Неделя' },
  { id: 'month', label: 'Месяц' },
  { id: 'year', label: 'Год' },
];

function setTrendGran(g) {
  trendGran = g;
  renderTrendGranPill();
  buildWeekChart();
}

function renderTrendGranPill() {
  const container = document.getElementById('trendGranPill');
  if (!container) return;
  container.innerHTML = renderRadioPill({
    key: 'trendgran',
    label: 'Гранулярность',
    options: TREND_GRAN_OPTIONS,
    selectedId: trendGran,
    onSelectExpr: (id) => `setTrendGran('${id}')`,
  });
  const state = ensurePopState('trendgran');
  if (state.open) {
    document.getElementById('pop-trendgran')?.classList.add('on');
    document.getElementById('btn-trendgran')?.classList.add('open');
  }
}

renderTrendGranPill();

const TREND_METRIC_OPTIONS = [
  { id: 'intensity', label: 'Сабмиты', desc: 'кол-во сабмитов' },
  { id: 'files', label: 'Файлы', desc: 'кол-во файлов' },
  { id: 'action', label: 'Действия', desc: 'edit/add/delete' },
  { id: 'weight', label: 'Вес', desc: 'объём засабмиченного' },
];
window.trendMetric = 'intensity';
let trendActionActive = new Set(ACTION_LIST);

function setTrendMetric(id) {
  window.trendMetric = id;
  renderTrendMetricPill();
  renderTrendMetricFilter();
  buildWeekChart();
}

function renderTrendMetricPill() {
  const container = document.getElementById('trendMetricPill');
  if (!container) return;
  container.innerHTML = renderRadioPill({
    key: 'trendmetric',
    label: 'Показатель',
    options: TREND_METRIC_OPTIONS,
    selectedId: window.trendMetric,
    onSelectExpr: (id) => `setTrendMetric('${id}')`,
  });
  const state = ensurePopState('trendmetric');
  if (state.open) {
    document.getElementById('pop-trendmetric')?.classList.add('on');
    document.getElementById('btn-trendmetric')?.classList.add('open');
  }
}

function renderTrendMetricFilter() {
  const container = document.getElementById('trendMetricFilter');
  if (!container) return;
  if (window.trendMetric !== 'action') {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = renderDropdownFilter({
    key: 'trend-action',
    icon: DROPDOWN_ICONS.depot,
    label: 'Действия',
    searchPlaceholder: '',
    items: ACTION_LIST,
    itemText: (a) => ACTION_LABELS[a],
    isActive: (a) => trendActionActive.has(a),
    activeCount: trendActionActive.size,
    itemExtraHtml: (a) => `<div class="dpi-dot" style="background:${ACTION_COLORS[a]}"></div>`,
    onSearchExpr: '',
    onSelectAllExpr: 'trendActionSelectAll()',
    onItemClickExpr: (a) => `trendActionToggle('${a}')`,
  });
  const st = ensurePopState('trend-action');
  if (st.open) {
    document.getElementById('pop-trend-action')?.classList.add('on');
    document.getElementById('btn-trend-action')?.classList.add('open');
  }
}

function trendActionToggle(action) {
  if (trendActionActive.has(action)) trendActionActive.delete(action);
  else trendActionActive.add(action);
  renderTrendMetricFilter();
  buildWeekChart();
}

function trendActionSelectAll() {
  trendActionActive = new Set(ACTION_LIST);
  renderTrendMetricFilter();
  buildWeekChart();
}

renderTrendMetricPill(); renderTrendMetricFilter();

function buildWeekChart() {
  const lpWrap = document.getElementById('lpWrap_trend');
  if (lpWrap) lpWrap.innerHTML = localPeriodControlHtml('trend', 'buildWeekChart');
  const groupBy = window.trendGroupBy || 'authors';
  const metric = window.trendMetric || 'intensity';
  const isActionMetric = metric === 'action';
  document.getElementById('trendTitle').textContent = TREND_TITLES[trendGran];

  const days = daysForBlock('trend');
  const buckets = {};

  const countOf = (commits) => {
    if (metric === 'files') return commits.reduce((s, c) => s + c.nFiles, 0);
    if (metric === 'weight') return commits.reduce((s, c) => s + (c.sizeGB || 0), 0);
    return commits.length;
  };

  const actionCountOf = (commits, action) => commits.reduce((s, c) => s + c.files.filter((f) => f.action === action).length, 0);

  days.forEach((d) => {
    const k = trendKey(d.date, trendGran);
    if (!buckets[k]) buckets[k] = {};
    USERS.forEach((u) => {
      if (!trendActiveUsers.has(u.name)) return;
      const commits = depotCommitsFor('trend', d, u.name);
      if (groupBy === 'authors') {
        if (isActionMetric) {
          if (!buckets[k][u.name]) buckets[k][u.name] = {};
          ACTION_LIST.forEach((a) => {
            if (!trendActionActive.has(a)) return;
            buckets[k][u.name][a] = (buckets[k][u.name][a] || 0) + actionCountOf(commits, a);
          });
        } else {
          buckets[k][u.name] = (buckets[k][u.name] || 0) + countOf(commits);
        }
      } else {

        const byDim = {};
        commits.forEach((c) => {
          const dimKey = groupBy === 'depot' ? c.depot : c.workspace;
          (byDim[dimKey] || (byDim[dimKey] = [])).push(c);
        });
        Object.keys(byDim).forEach((dimKey) => {
          if (isActionMetric) {
            if (!buckets[k][dimKey]) buckets[k][dimKey] = {};
            ACTION_LIST.forEach((a) => {
              if (!trendActionActive.has(a)) return;
              buckets[k][dimKey][a] = (buckets[k][dimKey][a] || 0) + actionCountOf(byDim[dimKey], a);
            });
          } else {
            buckets[k][dimKey] = (buckets[k][dimKey] || 0) + countOf(byDim[dimKey]);
          }
        });
      }
    });
  });

  const keys = Object.keys(buckets).sort();
  const labels = keys.map((k) => trendLabel(k, trendGran));

  let seriesKeys, seriesLabel, seriesColor;
  if (groupBy === 'depot') {
    seriesKeys = DEPOTS.filter((k) => (!depotPickers['trend'] || depotPickers['trend'].active.has(k)));
    seriesLabel = (k) => k.replace(/^\/\//, '').replace(/\/$/, '');
    seriesColor = (k) => (typeof getDepotColor === 'function' ? getDepotColor(k) : themeColor('muted'));
  } else if (groupBy === 'workspaces') {
    seriesKeys = visibleWorkspacesForScope('trend');
    seriesLabel = (k) => k;
    seriesColor = (k) => (typeof getWorkspaceColor === 'function' ? getWorkspaceColor(k) : themeColor('muted'));
  } else {
    const wsPickerForTrend = workspacePickers['trend'];
    seriesKeys = USERS.filter((u) => {
      if (!trendActiveUsers.has(u.name)) return false;
      const owned = workspacesOwnedBy(u.name);
      if (!owned.length || !wsPickerForTrend) return true;
      return owned.some((ws) => wsPickerForTrend.active.has(ws));
    }).map((u) => u.name);
    seriesLabel = (k) => k;
    seriesColor = (k) => (USERS.find((u) => u.name === k) || {}).color || themeColor('muted');
  }

  const totalPerBucket = keys.map((k) => seriesKeys.reduce((s, sk) => {
    const v = buckets[k][sk];
    if (!v) return s;
    return s + (isActionMetric ? Object.values(v).reduce((s2, n) => s2 + n, 0) : v);
  }, 0));
  const MA_WINDOW = 3;
  const movingAvg = totalPerBucket.map((_, i) => {
    const start = Math.max(0, i - MA_WINDOW + 1);
    const slice = totalPerBucket.slice(start, i + 1);
    return +(slice.reduce((s, v) => s + v, 0) / slice.length).toFixed(1);
  });

  const subEl = document.getElementById('trendSub');
  if (subEl) {
    const groupLabel = groupBy === 'authors' ? 'авторам' : groupBy === 'workspaces' ? 'воркспейсам' : 'депо';
    const metricLabel = metric === 'files' ? ' · файлы' : metric === 'action' ? ' · действия' : metric === 'weight' ? ' · объём (ГБ)' : '';
    const baseSub = `стек по ${groupLabel}${metricLabel} · ` + TREND_SUBS[trendGran];
    let deltaHtml = '';
    if (totalPerBucket.length >= 2 && typeof renderPeriodDelta === 'function') {
      const last = totalPerBucket[totalPerBucket.length - 1];
      const prev = totalPerBucket[totalPerBucket.length - 2];
      deltaHtml = ` · последний период к предыдущему: ${renderPeriodDelta(last, prev)}`;
    }
    subEl.innerHTML = baseSub + deltaHtml;
  }

  if (weekChartInst) weekChartInst.destroy();
  const ACTION_SHADE_ALPHA = { edit: 0.85, add: 0.55, delete: 0.3 };
  let mainDatasets;
  if (isActionMetric) {
    mainDatasets = [];
    seriesKeys.forEach((sk) => {
      const baseColor = seriesColor(sk);
      ACTION_LIST.filter((a) => trendActionActive.has(a)).forEach((a) => {
        mainDatasets.push({
          label: `${seriesLabel(sk)} · ${ACTION_LABELS[a]}`,
          data: keys.map((k) => (buckets[k][sk] && buckets[k][sk][a]) || 0),
          backgroundColor: ha(baseColor, ACTION_SHADE_ALPHA[a]),
          borderColor: baseColor,
          borderWidth: 1,
          borderRadius: 2,
        });
      });
    });
  } else {
    mainDatasets = seriesKeys.map((sk) => ({
      label: seriesLabel(sk),
      data: keys.map((k) => buckets[k][sk] || 0),
      backgroundColor: ha(seriesColor(sk), .45),
      borderColor: seriesColor(sk),
      borderWidth: 1,
      borderRadius: 3,
    }));
  }

  weekChartInst = new Chart('weekChart', {
    type: 'bar',
    data: {
      labels,
      datasets: mainDatasets.concat([{
        type: 'line',
        label: `Скользящее среднее (${MA_WINDOW})`,
        data: movingAvg,
        borderColor: themeColor('text'),
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 3,
        tension: 0.3,
        order: 0,
      }]),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}`,
          },
        },
      },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { color: themeColor('muted'), maxRotation: 0, autoSkip: true, maxTicksLimit: 14 } },
        y: { stacked: true, grid: { color: themeColor('border') }, ticks: { color: themeColor('muted') } },
      },
    },
  });

  const legendEl = document.getElementById('trendChartLegend');
  if (legendEl) {
    let legendItems;
    if (isActionMetric) {
      legendItems = [];
      seriesKeys.forEach((sk) => {
        ACTION_LIST.filter((a) => trendActionActive.has(a)).forEach((a) => {
          legendItems.push({ color: seriesColor(sk), label: `${seriesLabel(sk)} · ${ACTION_LABELS[a]}` });
        });
      });
    } else {
      legendItems = seriesKeys.map((sk) => ({ color: seriesColor(sk), label: seriesLabel(sk) }));
    }
    legendItems.push({ color: themeColor('text'), label: `Скользящее среднее (${MA_WINDOW})` });
    legendEl.innerHTML = renderStaticLegend(legendItems);
  }
}
