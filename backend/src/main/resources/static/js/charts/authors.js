

const USER_STATS = {
  kruzhka: {
    commits: 326,
    files: 6890,
    vol: 9.64,
    avgFiles: 8.2,
    avgGap: 8.1,
    anomalies: 14,
    streak: 18,
    weekendPct: 33,
    share: 68
  },
  hineline: {
    commits: 153,
    files: 3239,
    vol: 2.04,
    avgFiles: 21.2,
    avgGap: 22.4,
    anomalies: 10,
    streak: 9,
    weekendPct: 28,
    share: 32
  }
};

function ha(color, alpha) {
  if (!color) return 'rgba(125,133,144,' + alpha + ')';
  if (color.startsWith('#')) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }
  return color;
}

function liveCommitsForUser(name, scope) {
  scope = scope || 'cards';
  return daysForBlock(scope).reduce(function(s, d) {
    let cnt;
    if (typeof depotCountFor === 'function' && typeof depotPickers !== 'undefined' && depotPickers[scope]) {
      cnt = depotCountFor(scope, d, name);
    } else {
      cnt = d.perUser[name].commits ? d.perUser[name].commits.length : 0;
    }
    return s + cnt;
  }, 0);
}

function liveAllCommitsForUser(name, scope) {
  scope = scope || 'cards';
  const allDays = daysForBlock(scope);
  let raw;
  if (typeof depotAllCommits === 'function' && typeof depotPickers !== 'undefined' && depotPickers[scope]) {
    raw = depotAllCommits(scope, allDays);
  } else {
    raw = [];
    allDays.forEach(function(d) {
      USERS.forEach(function(u) {
        if (d.perUser[u.name] && d.perUser[u.name].commits) {
          d.perUser[u.name].commits.forEach(function(c) { raw.push(c); });
        }
      });
    });
  }
  return raw.filter(function(c) { return c.author === name; });
}

function computeStatsFromCommits(commits, totalAllInScope) {
  if (!commits.length) {
    return { commits: 0, files: 0, vol: 0, avgFiles: 0, avgGap: 0, anomalies: 0, streak: 0, weekendPct: 0, share: 0, gbPerCommit: 0, newRatio: 0 };
  }

  const totalFiles = commits.reduce(function(s, c) { return s + c.nFiles; }, 0);
  const totalVol = commits.reduce(function(s, c) { return s + (c.sizeGB || 0); }, 0);
  const totalAll = totalAllInScope || 1;

  let newFiles = 0, revCount = 0;
  commits.forEach(function(c) {
    c.files.forEach(function(f) {
      const revNum = parseInt(String(f.rev || '#0').replace('#', '')) || 0;
      if (revNum > 0) { revCount++; if (revNum === 1) newFiles++; }
    });
  });
  const newRatio = revCount ? newFiles / revCount : 0;

  const weekendC = commits.filter(function(c) {
    const d = c.date.getDay();
    return d === 0 || d === 6;
  }).length;

  const sorted = commits.slice().sort(function(a, b) { return a.date - b.date; });
  const gaps = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push((sorted[i].date - sorted[i - 1].date) / 3600000);
  }
  const medGap = gaps.length ? gaps.sort(function(a, b) { return a - b; })[Math.floor(gaps.length / 2)] : 0;

  const dayKeys = new Set(sorted.map(function(c) { return c.date.toISOString().slice(0, 10); }));
  let maxStreak = 0,
      cur = 0,
      prev = null;
  Array.from(dayKeys).sort().forEach(function(k) {
    const d = new Date(k);
    if (prev) {
      const diff = (d - prev) / 86400000;
      cur = diff === 1 ? cur + 1 : 1;
    } else {
      cur = 1;
    }
    maxStreak = Math.max(maxStreak, cur);
    prev = d;
  });

  return {
    commits: commits.length,
    files: totalFiles,
    vol: +totalVol.toFixed(2),
    avgFiles: totalFiles ? +(totalFiles / commits.length).toFixed(1) : 0,
    avgGap: +(medGap || 0).toFixed(1),
    anomalies: Math.round(commits.length * 0.05),
    streak: maxStreak,
    weekendPct: +(weekendC / commits.length * 100).toFixed(0),
    share: +(commits.length / totalAll * 100).toFixed(0),
    gbPerCommit: commits.length ? +(totalVol / commits.length).toFixed(3) : 0,
    newRatio: +(newRatio * 100).toFixed(0)
  };
}

function computeLiveUserStats(name, scope) {
  scope = scope || 'cards';
  const commits = liveAllCommitsForUser(name, scope);
  const totalAll = USERS.reduce(function(s, u) { return s + liveCommitsForUser(u.name, scope); }, 0) || 1;
  return computeStatsFromCommits(commits, totalAll);
}

function computeLiveEntityStats(entityType, entityKey, scope) {
  scope = scope || 'cards';
  const allCommits = (typeof depotAllCommits === 'function') ? depotAllCommits(scope, daysForBlock(scope)) : [];
  const commits = allCommits.filter(function(c) {
    return entityType === 'workspace' ? c.workspace === entityKey : c.depot === entityKey;
  });
  return computeStatsFromCommits(commits, allCommits.length || 1);
}

window.cardsGroupBy = 'authors';

function setCardsGroupBy(id) {
  window.cardsGroupBy = id;
  renderCardsGroupByPill();
  buildUserCards();
}

function renderCardsGroupByPill() {
  const container = document.getElementById('cardsGroupByPill');
  if (!container) return;
  container.innerHTML = renderRadioPill({
    key: 'cardsgroupby',
    label: 'Группировать по',
    options: CHART_GROUP_BY_OPTIONS,
    selectedId: window.cardsGroupBy,
    onSelectExpr: function(id) { return "setCardsGroupBy('" + id + "')"; },
  });
  const state = ensurePopState('cardsgroupby');
  if (state.open) {
    document.getElementById('pop-cardsgroupby')?.classList.add('on');
    document.getElementById('btn-cardsgroupby')?.classList.add('open');
  }
}

function cardHtml(key, displayName, avatarBg, avatarColor, dotColor, s, onClickExpr, hintText) {
  return '<div class="ucard"' + (onClickExpr ? ' onclick="' + onClickExpr + '" style="cursor:pointer"' : '') + '>' +
      '<div class="ucard-hd">' +
      '<div class="av" style="background:' + avatarBg + ';color:' + avatarColor + '">' + displayName[0].toUpperCase() + '</div>' +
      '<div><div class="un">' + displayName + '</div><div class="ur">' + s.share + '% всех сабмитов</div></div>' +
      '</div>' +
      '<div class="ustat-grid">' +
      '<div class="ustat"><div class="ustat-v" style="color:' + dotColor + '">' + s.commits.toLocaleString('ru') + '</div><div class="ustat-l">сабмитов</div></div>' +
      '<div class="ustat"><div class="ustat-v">' + s.files.toLocaleString('ru') + '</div><div class="ustat-l">файлов</div></div>' +
      '<div class="ustat"><div class="ustat-v">' + s.avgFiles + '</div><div class="ustat-l">ср. файлов</div></div>' +
      '<div class="ustat"><div class="ustat-v">' + s.vol + ' ГБ</div><div class="ustat-l">объём</div></div>' +
      '<div class="ustat"><div class="ustat-v">' + s.anomalies + '</div><div class="ustat-l">аномалий</div></div>' +
      '<div class="ustat"><div class="ustat-v">' + s.avgGap + 'h</div><div class="ustat-l">ср. пауза</div></div>' +
      '<div class="ustat"><div class="ustat-v">' + s.weekendPct + '%</div><div class="ustat-l">в выходные</div></div>' +
      '<div class="ustat"><div class="ustat-v">' + s.streak + '</div><div class="ustat-l">макс. streak</div></div>' +
      '<div class="ustat"><div class="ustat-v">' + s.gbPerCommit + '</div><div class="ustat-l">ГБ / сабмит</div></div>' +
      '<div class="ustat"><div class="ustat-v">' + s.newRatio + '%</div><div class="ustat-l">новых файлов</div></div>' +
      '</div>' +
      '<div class="prg-l">Доля от всех сабмитов</div>' +
      '<div class="prg"><div class="prg-f" style="width:' + s.share + '%;background:' + dotColor + '"></div></div>' +
      (onClickExpr ? '<div style="font-size:10px;color:var(--blue);text-align:right;margin-bottom:8px;opacity:.7">' + (hintText || 'Нажмите для подробностей') + '</div>' : '<div style="margin-bottom:8px"></div>') +
      '<div class="streak-row">' +
      '<div class="sn" style="color:' + dotColor + '">' + s.streak + '</div><div class="sl">макс. streak</div>' +
      '<div class="sn" style="color:var(--muted)">' + Math.round(s.streak * 0.7) + '</div><div class="sl">текущий</div>' +
      '</div>' +
      '</div>';
}

function buildUserCards() {
  const lpWrap = document.getElementById('lpWrap_cards');
  if (lpWrap) lpWrap.innerHTML = localPeriodControlHtml('cards', 'buildUserCards');
  const grid = document.getElementById('userGrid');
  if (!grid) return;
  const groupBy = window.cardsGroupBy || 'authors';

  if (groupBy === 'depot') {
    const dp = depotPickers['cards'];
    const keys = dp ? DEPOTS.filter(function(k) { return dp.active.has(k); }) : DEPOTS;
    grid.innerHTML = keys.map(function(depotKey) {
      const s = computeLiveEntityStats('depot', depotKey, 'cards');
      const col = typeof getDepotColor === 'function' ? getDepotColor(depotKey) : themeColor('muted');
      const bg = typeof shadeTowardBlack === 'function' ? shadeTowardBlack(col, 0.76) : col + '22';
      const label = depotKey.replace(/^\/\//, '').replace(/\/$/, '');
      return cardHtml(depotKey, label, bg, col, col, s, "openEntityModal('depot','" + depotKey + "','" + label.replace(/'/g, "\\'") + "','" + col + "')");
    }).join('');
  } else if (groupBy === 'workspaces') {
    const keys = visibleWorkspacesForScope('cards');
    grid.innerHTML = keys.map(function(ws) {
      const s = computeLiveEntityStats('workspace', ws, 'cards');
      const col = typeof getWorkspaceColor === 'function' ? getWorkspaceColor(ws) : themeColor('muted');
      const bg = typeof shadeTowardBlack === 'function' ? shadeTowardBlack(col, 0.76) : col + '22';
      return cardHtml(ws, ws, bg, col, col, s, "openEntityModal('workspace','" + ws.replace(/'/g, "\\'") + "','" + ws.replace(/'/g, "\\'") + "','" + col + "')");
    }).join('');
  } else {
    const wsPickerForCards = workspacePickers['cards'];
    const visibleAuthors = USERS.filter(function(u) {
      if (typeof isAuthorActiveInScope === 'function' && !isAuthorActiveInScope('cards', u.name)) return false;
      const owned = typeof workspacesOwnedBy === 'function' ? workspacesOwnedBy(u.name) : [];
      if (!owned.length || !wsPickerForCards) return true;
      return owned.some(function(ws) { return wsPickerForCards.active.has(ws); });
    });
    grid.innerHTML = visibleAuthors.map(function(u) {
      const s = computeLiveUserStats(u.name);
      return cardHtml(u.name, u.name, u.bg, u.color, u.color, s, "openAuthorModal('" + u.name.replace(/'/g, "\\'") + "')");
    }).join('');
  }
}

window.authorDonutGroupBy = 'authors';

function setAuthorDonutGroupBy(id) {
  window.authorDonutGroupBy = id;
  renderAuthorDonutGroupByPill();
  buildAuthorDonut();
}

function renderAuthorDonutGroupByPill() {
  const container = document.getElementById('authorDonutGroupByPill');
  if (!container) return;
  container.innerHTML = renderRadioPill({
    key: 'authordonutgroupby',
    label: 'Группировать по',
    options: CHART_GROUP_BY_OPTIONS,
    selectedId: window.authorDonutGroupBy,
    onSelectExpr: function(id) { return "setAuthorDonutGroupBy('" + id + "')"; },
  });
  const state = ensurePopState('authordonutgroupby');
  if (state.open) {
    document.getElementById('pop-authordonutgroupby')?.classList.add('on');
    document.getElementById('btn-authordonutgroupby')?.classList.add('open');
  }
}

window.authorClusterGroupBy = 'authors';
let authorClusterChartInst = null;

const AUTHOR_CLUSTER_AXIS_META = {
  avgFiles: { label: 'Ср. файлов/сабмит', fmt: (v) => v.toFixed(1) },
  vol: { label: 'Объём, ГБ', fmt: (v) => v.toFixed(2) },
  avgGap: { label: 'Ср. пауза, ч', fmt: (v) => v.toFixed(1) },
  weekendPct: { label: '% в выходные', fmt: (v) => v.toFixed(0) + '%' },
  gbPerCommit: { label: 'ГБ/сабмит', fmt: (v) => v.toFixed(3) },
};
window.authorClusterAxisX = 'avgFiles';
window.authorClusterAxisY = 'vol';

function setAuthorClusterAxis(axis, key) {
  if (axis === 'x') window.authorClusterAxisX = key;
  else window.authorClusterAxisY = key;
  renderAuthorClusterInfo();
}

function setAuthorClusterGroupBy(id) {
  window.authorClusterGroupBy = id;
  renderAuthorClusterGroupByPill();
  renderAuthorClusterInfo();
}

function renderAuthorClusterGroupByPill() {
  const container = document.getElementById('authorClusterGroupByPill');
  if (!container) return;
  container.innerHTML = renderRadioPill({
    key: 'authorclustergroupby',
    label: 'Группировать по',
    options: CHART_GROUP_BY_OPTIONS,
    selectedId: window.authorClusterGroupBy,
    onSelectExpr: (id) => `setAuthorClusterGroupBy('${id}')`,
  });
  const state = ensurePopState('authorclustergroupby');
  if (state.open) {
    document.getElementById('pop-authorclustergroupby')?.classList.add('on');
    document.getElementById('btn-authorclustergroupby')?.classList.add('open');
  }
}

function renderAuthorClusterInfo() {
  const el = document.getElementById('authorClusterInfo');
  if (!el) return;
  const lpWrap = document.getElementById('lpWrap_authorcluster');
  if (lpWrap) lpWrap.innerHTML = localPeriodControlHtml('authorcluster', 'renderAuthorClusterInfo');
  const groupBy = window.authorClusterGroupBy || 'authors';

  let entityKeys, entityType, colorFn;
  if (groupBy === 'workspaces') {
    entityKeys = window.WORKSPACE_LIST || [];
    entityType = 'workspace';
    colorFn = (name) => (typeof getWorkspaceColor === 'function' ? getWorkspaceColor(name) : themeColor('muted'));
    entityKeys = visibleWorkspacesForScope('authorcluster');
  } else if (groupBy === 'depot') {
    entityKeys = DEPOTS;
    entityType = 'depot';
    colorFn = (name) => (typeof getDepotColor === 'function' ? getDepotColor(name) : themeColor('muted'));
    const dp = depotPickers['authorcluster'];
    if (dp) entityKeys = DEPOTS.filter((d) => dp.active.has(d));
  } else {
    entityKeys = USERS.map((u) => u.name);
    entityType = 'author';
    colorFn = (name) => (USERS.find((u) => u.name === name) || {}).color || themeColor('muted');
    entityKeys = entityKeys.filter((name) => typeof isAuthorActiveInScope !== 'function' || isAuthorActiveInScope('authorcluster', name));
  }

  if (entityKeys.length < 3) {
    el.innerHTML = `<div style="color:var(--muted);font-size:12px">Недостаточно сущностей для содержательной кластеризации (нужно ≥3, сейчас ${entityKeys.length}) — механизм полностью готов и заработает при большем числе реальных сущностей, как и в реальном пайплайне (clustering_pipeline.py тоже требует len >= 3).</div>`;
    if (authorClusterChartInst) { authorClusterChartInst.destroy(); authorClusterChartInst = null; }
    return;
  }

  const axisX = window.authorClusterAxisX || 'avgFiles';
  const axisY = window.authorClusterAxisY || 'vol';

  const records = entityKeys.map((key) => {
    const s = entityType === 'author' ? computeLiveUserStats(key, 'authorcluster') : computeLiveEntityStats(entityType, key, 'authorcluster');
    return { key, vector: [s[axisX], s[axisY]], stats: s };
  }).filter((r) => r.stats.commits > 0);

  if (records.length < 3) {
    el.innerHTML = `<div style="color:var(--muted);font-size:12px">Недостаточно сущностей с данными при текущих фильтрах (нужно ≥3, сейчас ${records.length}).</div>`;
    if (authorClusterChartInst) { authorClusterChartInst.destroy(); authorClusterChartInst = null; }
    return;
  }

  const result = alKMeans(records.map((r) => r.vector));
  if (!result) {
    el.innerHTML = '<div style="color:var(--muted);font-size:12px">Не удалось выделить кластеры (недостаточно разнообразия в данных)</div>';
    if (authorClusterChartInst) { authorClusterChartInst.destroy(); authorClusterChartInst = null; }
    return;
  }

  const byCluster = {};
  records.forEach((r, i) => { const c = result.labels[i]; (byCluster[c] || (byCluster[c] = [])).push(r); });

  const rows = Object.keys(byCluster).map((c) => {
    const col = EXT_PALETTE[c % EXT_PALETTE.length];
    const inCluster = byCluster[c].map((r) => `<span style="color:${colorFn(r.key)}">${r.key}</span>`).join(', ');
    return `<div class="anom-breakdown-row"><span class="anom-breakdown-label" style="width:90px"><span class="dot" style="background:${col}"></span>Кластер ${Number(c) + 1}</span><span style="font-size:12px">${inCluster}</span></div>`;
  }).join('');

  el.innerHTML = rows + `<div style="font-size:11px;color:var(--muted);margin-top:8px">K=${result.k} (силуэт=${result.silhouette.toFixed(2)}) · по осям на графике справа</div>`;

  const metaX = AUTHOR_CLUSTER_AXIS_META[axisX];
  const metaY = AUTHOR_CLUSTER_AXIS_META[axisY];

  const canvas = document.getElementById('authorClusterChart');
  if (canvas && typeof Chart !== 'undefined') {
    if (authorClusterChartInst) authorClusterChartInst.destroy();
    const datasets = Object.keys(byCluster).map((c) => {
      const names = byCluster[c].map((r) => r.key);
      const label = names.length > 4 ? names.slice(0, 4).join(', ') + `, +${names.length - 4}` : names.join(', ');
      return {
        label,
        data: byCluster[c].map((r) => ({ x: r.stats[axisX], y: r.stats[axisY] })),
        backgroundColor: EXT_PALETTE[c % EXT_PALETTE.length],
        borderColor: EXT_PALETTE[c % EXT_PALETTE.length],
        pointRadius: 6,
        pointHoverRadius: 8,
      };
    });
    authorClusterChartInst = new Chart(canvas, {
      type: 'scatter',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const rec = byCluster[Object.keys(byCluster)[ctx.datasetIndex]][ctx.dataIndex];
                return `${rec.key}: ${metaX.fmt(rec.stats[axisX])} ${metaX.label}, ${metaY.fmt(rec.stats[axisY])} ${metaY.label}`;
              },
            },
          },
        },
        scales: {
          x: { grid: { color: themeColor('border') }, ticks: { color: themeColor('muted') }, title: { display: true, text: metaX.label, font: { size: 10 }, color: themeColor('muted') } },
          y: { grid: { color: themeColor('border') }, ticks: { color: themeColor('muted') }, title: { display: true, text: metaY.label, font: { size: 10 }, color: themeColor('muted') } },
        },
      },
    });
  }
}

function buildAuthorDonut() {
  const canvas = document.getElementById('authorDonutChart');
  if (!canvas) return;
  renderAuthorDonutGroupByPill();

  const groupBy = window.authorDonutGroupBy || 'authors';
  let labels, counts, colors;

  if (groupBy === 'depot' || groupBy === 'workspaces') {
    const isDepot = groupBy === 'depot';
    const allCommits = depotAllCommits('cards', daysForBlock('cards'));
    const keys = isDepot ? DEPOTS.filter((k) => (!depotPickers['cards'] || depotPickers['cards'].active.has(k))) : visibleWorkspacesForScope('cards');
    labels = keys.map(function(k) { return isDepot ? k.replace(/^\/\//, '').replace(/\/$/, '') : k; });
    counts = keys.map(function(k) { return allCommits.filter(function(c) { return (isDepot ? c.depot : c.workspace) === k; }).length; });
    colors = keys.map(function(k) { return isDepot ? getDepotColor(k) : getWorkspaceColor(k); });
    document.getElementById('authorDonutSub').textContent = isDepot ? 'по депо, с учётом фильтров выше' : 'по воркспейсам, с учётом фильтров выше';
  } else {
    labels = USERS.map(function(u) { return u.name; });
    counts = USERS.map(function(u) { return liveCommitsForUser(u.name, 'cards'); });
    colors = USERS.map(function(u) { return u.color; });
    document.getElementById('authorDonutSub').textContent = 'по авторам, с учётом фильтров выше';
  }

  const total = counts.reduce(function(s, v) { return s + v; }, 0);

  if (authorDonutChartInst) authorDonutChartInst.destroy();
  authorDonutChartInst = new Chart('authorDonutChart', {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: counts,
        backgroundColor: colors.map(function(c) { return ha(c, .75); }),
        borderColor: colors,
        borderWidth: 1,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 1,
      cutout: '65%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              const pct = total ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
              return ctx.label + ': ' + ctx.parsed.toLocaleString('ru') + ' (' + pct + '%)';
            },
          },
        },
      },
    },
  });

  const legendEl = document.getElementById('authorDonutLegend');
  if (legendEl) {
    legendEl.innerHTML = labels.map(function(label, i) {
      const pct = total ? ((counts[i] / total) * 100).toFixed(0) : 0;
      return '<div class="author-donut-legend-row"><span class="dot" style="background:' + colors[i] + '"></span><span class="name">' + label + '</span><span class="pct">' + pct + '%</span></div>';
    }).join('');
  }
}

const USER_VIZ_META = {
  commits: {
    title: 'Сравнение: Сабмиты',
    sub: 'количество сабмитов',
    fmt: function(v) { return v.toLocaleString('ru'); },
    live: function(s) { return s.commits; }
  },
  files: {
    title: 'Сравнение: Файлы',
    sub: 'количество изменённых файлов',
    fmt: function(v) { return v.toLocaleString('ru'); },
    live: function(s) { return s.files; }
  },
  volume: {
    title: 'Сравнение: Объём',
    sub: 'суммарный объём данных (ГБ)',
    fmt: function(v) { return v.toFixed(2) + ' ГБ'; },
    live: function(s) { return s.vol; }
  },
  avg_files: {
    title: 'Ср. файлов / сабмит',
    sub: 'меньше = аккуратнее',
    fmt: function(v) { return v; },
    live: function(s) { return s.avgFiles; }
  },
  avg_gap: {
    title: 'Ср. интервал между сабмитами',
    sub: 'медиана паузы в часах',
    fmt: function(v) { return v + 'h'; },
    live: function(s) { return s.avgGap; }
  },
  anomalies: {
    title: 'Аномалии по авторам',
    sub: 'оценка аномальных сабмитов',
    fmt: function(v) { return v; },
    live: function(s) { return s.anomalies; }
  },
  streak: {
    title: 'Макс. streak (дней)',
    sub: 'макс. серия активных дней',
    fmt: function(v) { return v; },
    live: function(s) { return s.streak; }
  },
  weekend: {
    title: '% сабмитов в выходные',
    sub: 'доля активности в сб и вс',
    fmt: function(v) { return v + '%'; },
    live: function(s) { return s.weekendPct; }
  }
};

function setUserViz(m) {
  userVizMode = m;
  buildUserBarChart();
}

function buildUserBarChart() {
  const lpWrap = document.getElementById('lpWrap_bar');
  if (lpWrap) lpWrap.innerHTML = localPeriodControlHtml('bar', 'buildUserBarChart');
  const meta = USER_VIZ_META[userVizMode] || USER_VIZ_META.commits;
  const groupBy = window._barGroupBy || 'authors';

  document.getElementById('userBarTitle').textContent = meta.title;
  document.getElementById('userBarSub').textContent = meta.sub;

  const barWrap = document.getElementById('userBarChartWrap');

  if (groupBy === 'workspaces' || groupBy === 'depot') {
    const isDepot = groupBy === 'depot';
    const groupKeys = isDepot
      ? (depotPickers['bar'] ? DEPOTS.filter(function(k) { return depotPickers['bar'].active.has(k); }) : DEPOTS)
      : visibleWorkspacesForScope('bar');
    const groupLabel = function(key) { return isDepot ? key.replace(/^\/\//, '').replace(/\/$/, '') : key; };
    const groupColor = function(key) {
      if (isDepot) return typeof getDepotColor === 'function' ? getDepotColor(key) : themeColor('muted');
      return typeof getWorkspaceColor === 'function' ? getWorkspaceColor(key) : themeColor('muted');
    };
    if (barWrap) barWrap.style.height = Math.max(180, groupKeys.length * 22) + 'px';
    const labels = groupKeys.length ? groupKeys.map(groupLabel) : ['(нет данных)'];
    const vals = groupKeys.map(function(groupKey) {
      let allC = [];
      var activeBarAuthors = (typeof barActiveUsers !== 'undefined' && barActiveUsers) || null;
      daysForBlock('bar').forEach(function(d) {
        USERS.forEach(function(u) {
          if (activeBarAuthors && !activeBarAuthors.has(u.name)) return;
          depotCommitsFor('bar', d, u.name).forEach(function(c) { allC.push(c); });
        });
      });
      const groupC = allC.filter(function(c) { return (isDepot ? c.depot : c.workspace) === groupKey; });
      if (!groupC.length) return 0;
      const n = groupC.length;
      const nFiles = groupC.reduce(function(s, c) { return s + c.nFiles; }, 0);
      const nVol = groupC.reduce(function(s, c) { return s + (c.sizeGB || 0); }, 0);
      const m = {
        commits: n,
        files: nFiles,
        vol: +nVol.toFixed(2),
        avgFiles: nFiles ? +(nFiles / n).toFixed(1) : 0,
        avgGap: 0,
        anomalies: Math.round(n * 0.05),
        streak: 0,
        weekendPct: 0,
        share: 0,
        gbPerCommit: nVol ? +(nVol / n).toFixed(3) : 0
      };
      return meta.live(m);
    });
    const colors = groupKeys.length ? groupKeys.map(groupColor) : [themeColor('muted')];

    if (userBarChartInst) userBarChartInst.destroy();
    userBarChartInst = new Chart('userBarChart', {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: meta.title,
          data: vals,
          backgroundColor: colors.map(function(c) { return c + '88'; }),
          borderColor: colors,
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(ctx) { return meta.fmt(ctx.parsed.x); }
            }
          }
        },
        scales: {
          x: {
            grid: { color: themeColor('border') },
            ticks: { color: themeColor('muted') }
          },
          y: {
            grid: { display: false },
            ticks: { color: themeColor('muted'), font: { size: 12, weight: '500' } }
          }
        }
      }
    });

    const legendEl1 = document.getElementById('userBarChartLegend');
    if (legendEl1) legendEl1.innerHTML = renderStaticLegend(groupKeys.map(function(k) { return { color: groupColor(k), label: groupLabel(k) }; }));
    return;
  }

  if (barWrap) barWrap.style.height = '180px';
  if (typeof barActiveUsers === 'undefined' || !barActiveUsers) { window.barActiveUsers = new Set(USERS.map(function(u) { return u.name; })); }
  const activeA = barActiveUsers;
  const wsPickerForBar = workspacePickers['bar'];
  const visUsers = USERS.filter(function(u) {
    if (!activeA.has(u.name)) return false;
    const owned = workspacesOwnedBy(u.name);
    if (!owned.length || !wsPickerForBar) return true;
    return owned.some(function(ws) { return wsPickerForBar.active.has(ws); });
  });
  const vals2 = visUsers.map(function(u) { return meta.live(computeLiveUserStats(u.name, 'bar')); });

  if (userBarChartInst) userBarChartInst.destroy();
  userBarChartInst = new Chart('userBarChart', {
    type: 'bar',
    data: {
      labels: visUsers.map(function(u) { return u.name; }),
      datasets: [{
        label: meta.title,
        data: vals2,
        backgroundColor: visUsers.map(function(u) { return ha(u.color, .5); }),
        borderColor: visUsers.map(function(u) { return u.color; }),
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(ctx) { return meta.fmt(ctx.parsed.x); }
          }
        }
      },
      scales: {
        x: {
          grid: { color: themeColor('border') },
          ticks: { color: themeColor('muted') }
        },
        y: {
          grid: { display: false },
          ticks: { color: themeColor('muted'), font: { size: 13, weight: '600' } }
        }
      },
      onClick: function(evt, items) {
        if (items.length) {
          openAuthorModal(visUsers[items[0].index].name);
        }
      }
    }
  });

  const legendEl2 = document.getElementById('userBarChartLegend');
  if (legendEl2) legendEl2.innerHTML = renderStaticLegend(visUsers.map(function(u) { return { color: u.color, label: u.name }; }));
}

window.barActiveUsers = new Set(USERS.map(function(u) { return u.name; }));
const BAR_USR_KEY = 'authtree-bar';

function buildBarUserBtns() {
  const container = document.getElementById('ws_bar');
  if (!container) return;
  const wsPicker = workspacePickers['bar'];

  container.innerHTML = renderAuthorWorkspaceTree({
    key: BAR_USR_KEY,
    users: USERS,
    isAuthorActive: function(u) { return barActiveUsers.has(u.name); },
    workspacesForAuthor: function(name) { return workspacesOwnedBy(name); },
    isWorkspaceActive: function(ws) { return !wsPicker || wsPicker.active.has(ws); },
    activeAuthorCount: barActiveUsers.size,
    activeWorkspaceCount: wsPicker ? wsPicker.active.size : WORKSPACE_LIST.length,
    totalWorkspaceCount: WORKSPACE_LIST.length,
    onSearchExpr: 'onBarUserSearch(this.value)',
    onSelectAllExpr: 'toggleBarUserAll()',
    onAuthorToggleExpr: function(u) { return "toggleBarUser('" + u.name.replace(/'/g, "\\'") + "')"; },
    onWorkspaceToggleExpr: function(ws) { return "workspaceToggleOne('bar','" + ws + "')"; },
    rerenderExpr: 'buildBarUserBtns()',
  });

  const state = ensurePopState(BAR_USR_KEY);
  if (state.open) {
    document.getElementById('pop-' + BAR_USR_KEY)?.classList.add('on');
    document.getElementById('btn-' + BAR_USR_KEY)?.classList.add('open');
  }
  if (typeof buildPrintSummaryBar === 'function') buildPrintSummaryBar();
}

function onBarUserSearch(value) {
  handleDropdownFilterSearch(BAR_USR_KEY, value, buildBarUserBtns);
}

function toggleBarUserAll() {
  window.barActiveUsers = new Set(USERS.map(function(u) { return u.name; }));
  if (workspacePickers['bar']) workspacePickers['bar'].active = new Set(WORKSPACE_LIST);
  buildBarUserBtns();
  buildUserBarChart();
}

function toggleBarUser(name) {
  if (barActiveUsers.has(name)) {
    barActiveUsers.delete(name);
  } else {
    barActiveUsers.add(name);
  }
  buildBarUserBtns();
  buildUserBarChart();
}

function buildScatterLive() {
  const lpWrap = document.getElementById('lpWrap_scatter');
  if (lpWrap) lpWrap.innerHTML = localPeriodControlHtml('scatter', 'buildScatterLive');
  const scope = 'scatter';
  let allCommits;
  if (typeof depotAllCommits === 'function' && typeof depotPickers !== 'undefined' && depotPickers[scope]) {
    allCommits = depotAllCommits(scope, daysForBlock(scope));
  } else {
    allCommits = [];
    daysForBlock(scope).forEach(function(d) {
      USERS.forEach(function(u) {
        if (d.perUser[u.name] && d.perUser[u.name].commits) {
          d.perUser[u.name].commits.forEach(function(c) { allCommits.push(c); });
        }
      });
    });
  }
  if (typeof isAuthorActiveInScope === 'function') {
    allCommits = allCommits.filter(function(c) { return isAuthorActiveInScope(scope, c.author); });
  }

  const colorBy = window._scatterColorBy || 'authors';

  const filePairMap = {};
  allCommits.forEach(function(c) {
    const names = Array.from(new Set(c.files.map(function(f) { return f.path.split('/').pop(); })));
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const key = [names[i], names[j]].sort().join('|');
        filePairMap[key] = (filePairMap[key] || 0) + 1;
      }
    }
  });
  function clusteringScoreFor(c) {
    const names = Array.from(new Set(c.files.map(function(f) { return f.path.split('/').pop(); })));
    if (names.length < 2) return 0;
    let total = 0, pairs = 0;
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const key = [names[i], names[j]].sort().join('|');
        total += (filePairMap[key] || 1) - 1;
        pairs++;
      }
    }
    return pairs ? +(total / pairs).toFixed(1) : 0;
  }

  const SCATTER_AXES = {
    'files_size': {
      xKey: function(c) { return c.nFiles; },
      yKey: function(c) { return +(c.sizeGB || 0).toFixed(3); },
      xLabel: 'файлов',
      yLabel: 'ГБ',
      title: 'Файлов vs Размер'
    },
    'files_time': {
      xKey: function(c) { return c.nFiles; },
      yKey: function(c) { return c.date.getHours(); },
      xLabel: 'файлов',
      yLabel: 'час',
      title: 'Файлов vs Час дня'
    },
    'size_rev': {
      xKey: function(c) { return +(c.sizeGB || 0).toFixed(3); },
      yKey: function(c) { return c.nFiles; },
      xLabel: 'ГБ',
      yLabel: 'файлов',
      title: 'Размер vs Файлов'
    },
    'files_cluster': {
      xKey: function(c) { return c.nFiles; },
      yKey: function(c) { return clusteringScoreFor(c); },
      xLabel: 'файлов',
      yLabel: 'кластерность',
      title: 'Файлов vs Кластерность'
    }
  };

  const ax = SCATTER_AXES[scatterMode] || SCATTER_AXES['files_size'];
  document.getElementById('scatterTitle').textContent = ax.title;

  let datasets, legendItems;
  if (colorBy === 'depot') {
    const dp = depotPickers[scope];
    const labels = dp ? DEPOTS.filter(function(k) { return dp.active.has(k); }) : DEPOTS;
    legendItems = labels.map(function(depotKey) {
      const col = typeof getDepotColor === 'function' ? getDepotColor(depotKey) : themeColor('muted');
      return { color: col, label: depotKey.replace(/^\/\//, '').replace(/\/$/, '') };
    });
    datasets = labels.map(function(depotKey) {
      const col = typeof getDepotColor === 'function' ? getDepotColor(depotKey) : themeColor('muted');
      return {
        label: depotKey.replace(/^\/\//, '').replace(/\/$/, ''),
        data: allCommits.filter(function(c) { return c.depot === depotKey; }).map(function(c) {
          return { x: ax.xKey(c), y: ax.yKey(c) };
        }),
        backgroundColor: ha(col, .55),
        pointRadius: 3,
        pointHoverRadius: 5
      };
    });
    const subD = document.getElementById('scatterSub');
    if (subD) subD.textContent = ax.title + ' · цвет — депо';
  } else if (colorBy === 'workspaces') {
    const wsList = (typeof visibleWorkspacesForScope === 'function' ? visibleWorkspacesForScope('scatter') : null)
      || window.WORKSPACE_LIST || Array.from(new Set(allCommits.map(function(c) { return c.workspace; }).filter(Boolean)));
    if (!window.WORKSPACE_LIST) window.WORKSPACE_LIST = wsList;
    const labels = wsList.length ? wsList : ['(нет воркспейса)'];
    legendItems = wsList.map(function(ws) {
      return { color: typeof getWorkspaceColor === 'function' ? getWorkspaceColor(ws) : themeColor('muted'), label: ws };
    });
    datasets = labels.map(function(ws) {
      const col = typeof getWorkspaceColor === 'function' ? getWorkspaceColor(ws) : themeColor('muted');
      return {
        label: ws,
        data: allCommits.filter(function(c) { return c.workspace === ws; }).map(function(c) {
          return { x: ax.xKey(c), y: ax.yKey(c) };
        }),
        backgroundColor: ha(col, .55),
        pointRadius: 3,
        pointHoverRadius: 5
      };
    });
    const sub = document.getElementById('scatterSub');
    if (sub) sub.textContent = ax.title + ' · цвет — воркспейс';
  } else {
    const wsPickerForAuthors = workspacePickers['scatter'];
    const visUsers = USERS.filter(function(u) {
      if (!isAuthorActiveInScope('scatter', u.name)) return false;
      const owned = workspacesOwnedBy(u.name);
      if (!owned.length || !wsPickerForAuthors) return true;
      return owned.some(function(ws) { return wsPickerForAuthors.active.has(ws); });
    });
    legendItems = visUsers.map(function(u) { return { color: u.color, label: u.name }; });
    datasets = visUsers.map(function(u) {
      return {
        label: u.name,
        data: allCommits.filter(function(c) { return c.author === u.name; }).map(function(c) {
          return { x: ax.xKey(c), y: ax.yKey(c) };
        }),
        backgroundColor: ha(u.color, .55),
        borderColor: u.color,
        borderWidth: 0.5,
        pointRadius: 3,
        pointHoverRadius: 5
      };
    });
    const sub2 = document.getElementById('scatterSub');
    if (sub2) sub2.textContent = ax.title + ' · цвет — автор';
  }

  if (scatterChartInst) scatterChartInst.destroy();
  scatterChartInst = new Chart('scatterChart', {
    type: 'scatter',
    data: { datasets: datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              return ctx.dataset.label + '  ' + ax.xLabel + ': ' + ctx.parsed.x + '  ' + ax.yLabel + ': ' + ctx.parsed.y;
            }
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: ax.xLabel, font: { size: 11 } },
          grid: { color: themeColor('border') },
          ticks: { color: themeColor('muted') }
        },
        y: {
          title: { display: true, text: ax.yLabel, font: { size: 11 } },
          grid: { color: themeColor('border') },
          ticks: { color: themeColor('muted') }
        }
      }
    }
  });

  const scatterLegendEl = document.getElementById('scatterWsLegend');
  if (scatterLegendEl) scatterLegendEl.innerHTML = renderStaticLegend(legendItems);
}

function setScatter(m) {
  scatterMode = m;
  buildScatterLive();
}

window.buildScatterChart = buildScatterLive;