

let HF_FILE_EVENTS = {};
let HF_TOTAL_DAYS = 0;
let HF_TOTAL_WEEKS = 0;
let HF_ACTIVE_DAYS = [];

function buildHfFileEvents() {
  const days = daysForBlock('hotfiles');
  const map = {};
  days.forEach((d, di) => {
    USERS.forEach(u => {
      d.perUser[u.name].commits.forEach(c => {
        const depotShort = c.depot.replace(/^\/\//, '').replace(/\/$/, '');
        c.files.forEach(f => {
          if (!map[f.path]) map[f.path] = { path: f.path, ext: f.ext, events: [] };
          map[f.path].events.push({
            di, author: u.name, depot: depotShort, workspace: c.workspace,
            action: f.action, rev: parseInt((f.rev || '#1').replace('#', '')) || 1,
            sizeKB: parseInt(f.size) || 0, cl: c.cl,
            coFiles: c.files.filter(ff => ff.path !== f.path).map(ff => ff.path.split('/').pop()),
          });
        });
      });
    });
  });
  HF_FILE_EVENTS = map;
  HF_ACTIVE_DAYS = days;
  HF_TOTAL_DAYS = days.length;
  HF_TOTAL_WEEKS = Math.ceil(HF_TOTAL_DAYS / 7);
}
buildHfFileEvents();

function invalidateHotFilesCache() {
  buildHfFileEvents();
}

function computeHfFileStats() {
  const dp = depotPickers['hotfiles'];
  const wp = workspacePickers['hotfiles'];
  const ep = typeof extensionPickers !== 'undefined' ? extensionPickers['hotfiles'] : null;
  const dpActiveShort = dp && dp.active.size < DEPOTS.length ? new Set([...dp.active].map((d) => d.replace(/^\/\//, '').replace(/\/$/, ''))) : null;
  const wsActive = wp && wp.active.size < (window.WORKSPACE_LIST || []).length ? wp.active : null;
  const activeAuthors = USERS.some((u) => !isAuthorActiveInScope('hotfiles', u.name)) ? scopeAuthorActiveSet('hotfiles') : null;

  const out = [];
  Object.values(HF_FILE_EVENTS).forEach((file) => {
    if (ep && ep.size < EXTS_LIST.length && !ep.has(file.ext)) return;
    let events = file.events;
    if (dpActiveShort) events = events.filter((e) => dpActiveShort.has(e.depot));
    if (wsActive) events = events.filter((e) => wsActive.has(e.workspace));
    if (activeAuthors) events = events.filter((e) => activeAuthors.has(e.author));
    if (!events.length) return;

    const weekly = Array(HF_TOTAL_WEEKS).fill(0);
    const weeklyByAuthor = {};
    const weeklyByWorkspace = {};
    const authorEdits = {};
    const workspaceEdits = {};
    const actions = { add: 0, edit: 0, delete: 0 };
    const coFileCounts = {};
    let maxRev = 0, totalSizeKB = 0, firstDi = events[0].di, lastDi = events[0].di;
    events.forEach((e) => {
      const wi = Math.floor(e.di / 7);
      weekly[wi]++;
      (weeklyByAuthor[e.author] || (weeklyByAuthor[e.author] = Array(HF_TOTAL_WEEKS).fill(0)))[wi]++;
      (weeklyByWorkspace[e.workspace] || (weeklyByWorkspace[e.workspace] = Array(HF_TOTAL_WEEKS).fill(0)))[wi]++;
      authorEdits[e.author] = (authorEdits[e.author] || 0) + 1;
      workspaceEdits[e.workspace] = (workspaceEdits[e.workspace] || 0) + 1;
      if (actions[e.action] !== undefined) actions[e.action]++;
      maxRev = Math.max(maxRev, e.rev);
      totalSizeKB += e.sizeKB;
      firstDi = Math.min(firstDi, e.di);
      lastDi = Math.max(lastDi, e.di);
      e.coFiles.forEach((cf) => { coFileCounts[cf] = (coFileCounts[cf] || 0) + 1; });
    });

    const span = Math.max(1, lastDi - firstDi + 1);
    const lastDate = HF_ACTIVE_DAYS[lastDi]?.date || HF_ACTIVE_DAYS[0].date;
    const lastDate0 = HF_ACTIVE_DAYS[HF_TOTAL_DAYS - 1]?.date || new Date();
    const daysAgo = Math.round((lastDate0 - lastDate) / 86400000);

    const activeWeeks = weekly.map((v, i) => ({ v, i })).filter((x) => x.v > 0);
    let trend = 'stable';
    if (activeWeeks.length >= 2) {
      const mid = Math.floor(activeWeeks.length / 2);
      const firstAvg = activeWeeks.slice(0, mid).reduce((s, x) => s + x.v, 0) / mid;
      const secondAvg = activeWeeks.slice(mid).reduce((s, x) => s + x.v, 0) / (activeWeeks.length - mid);
      trend = secondAvg > firstAvg * 1.3 ? 'up' : secondAvg < firstAvg * 0.7 ? 'down' : 'stable';
    }

    const authors = Object.keys(authorEdits);
    const workspaces = Object.keys(workspaceEdits);
    const churnRate = +(events.length / span).toFixed(3);
    const refactorScore = Math.round(Math.min(100, churnRate * 25 + Math.min(authors.length, 5) * 8 + Math.min(totalSizeKB / 500, 20)));

    out.push({
      path: file.path, ext: file.ext, events, edits: events.length,
      authors: new Set(authors), authorCount: authors.length, authorEdits,
      workspaces: new Set(workspaces), workspaceCount: workspaces.length, workspaceEdits,
      weekly, weeklyByAuthor, weeklyByWorkspace, firstDi, lastDi, maxRev, totalSizeKB, actions,
      churnRate, daysAgo, lastDate, firstDate: HF_ACTIVE_DAYS[firstDi]?.date || HF_ACTIVE_DAYS[0].date,
      isNew: firstDi > HF_TOTAL_DAYS * 0.75, isCold: daysAgo > 60,
      trend, refactorScore, isSoloRisk: authors.length === 1, isSoloRiskWs: workspaces.length === 1,
      coFileCounts,
    });
  });
  return out;
}

const HF_CFG = {
  hot:   { title: 'Горячие файлы',  sub: 'наибольшее число изменений за период',                 badge: 'badge-fire',  text: 'HOT',   filter: f => f.edits > 2,  sort: 'edits'      },
  churn: { title: 'Churn',          sub: 'файлы которые постоянно переписываются — зона нестабильности', badge: 'badge-churn', text: 'CHURN', filter: f => f.churnRate > 0, sort: 'churn_rate' },
  cold:  { title: 'Холодные файлы', sub: 'не редактировались 60+ дней',                          badge: 'badge-cold',  text: 'COLD',  filter: f => f.isCold,     sort: 'last_edit'  },
  new:   { title: 'Новые файлы',    sub: 'добавлены в последние 25% периода',                     badge: 'badge-new',   text: 'NEW',   filter: f => f.isNew,      sort: 'last_edit'  },
};

let hfTab = 'hot', hfSel = null, hfChurnChart = null;

function setHfTab(t) {
  hfTab = t;
  hfSel = null;
  closeHfDetail(true);
  document.querySelectorAll('#hfTabSeg .sb').forEach((b, i) =>
    b.classList.toggle('on', i === { hot:0, churn:1, cold:2, new:3 }[t])
  );
  const cfg = HF_CFG[t];
  document.getElementById('hfTitle').textContent = cfg.title;
  document.getElementById('hfSub').textContent = cfg.sub;
  document.getElementById('hfSort').value = cfg.sort;
  buildHotFiles();
}

function hfMetric(f, key) {
  switch(key) {
    case 'edits':      return f.edits;
    case 'authors':    return window.hfDimension === 'workspace' ? f.workspaceCount : f.authorCount;
    case 'revisions':  return f.maxRev;
    case 'size':       return f.totalSizeKB;
    case 'last_edit':  return f.daysAgo;
    case 'churn_rate': return f.churnRate;
    case 'refactor':   return f.refactorScore;
    default:           return f.edits;
  }
}

function hfClampLimit() {
  const el = document.getElementById('hfLimit');
  const total = (window._hfMatchedCount || 1);
  let n = parseInt(el.value, 10);
  if (isNaN(n) || n < 1) n = total ? 1 : 0;
  if (n > total) n = total;
  el.value = String(n);
  buildHotFiles();
}

const HF_TREND_ICON = { up: '↑ растёт', down: '↓ затихает', stable: '→ стабильно' };
const HF_TREND_COLOR = { up: 'var(--red)', down: 'var(--blue)', stable: 'var(--muted)' };

window.hfDimension = 'author';
function setHfDimension(dim) {
  window.hfDimension = dim;
  document.querySelectorAll('#hfDimSeg .sb').forEach((b) => b.classList.toggle('on', b.getAttribute('data-dim') === dim));
  buildHotFiles();
}

function buildHotFiles() {
  const lpWrap = document.getElementById('lpWrap_hotfiles');
  if (lpWrap) lpWrap.innerHTML = localPeriodControlHtml('hotfiles', 'buildHotFiles');
  const cfg = HF_CFG[hfTab];
  const sortKey = document.getElementById('hfSort').value;

  const metricLabel = { edits:'Изм./Rev.', authors:'Авт.', revisions:'Ревизий', size:'КБ', last_edit:'Дн.', churn_rate:'Изм./д', refactor:'Риск' };
  document.getElementById('hfMetricHd').textContent = metricLabel[sortKey] || 'Изм.';

  const barColors = { hot:'#f0883e', churn:'#f85149', cold:'#58a6ff', new:'#3fb950' };
  const barColor = barColors[hfTab];

  const allStats = computeHfFileStats();
  const matched = allStats.filter(cfg.filter).sort((a, b) => hfMetric(b, sortKey) - hfMetric(a, sortKey));
  window._hfMatchedCount = matched.length;

  const limitInput = document.getElementById('hfLimit');
  let limit = parseInt(limitInput.value, 10);
  if (isNaN(limit) || limit < 1) limit = matched.length ? 1 : 0;
  if (limit > matched.length) limit = matched.length;
  const files = matched.slice(0, limit);

  window._hfFiles = files;

  if (!files.length) {
    document.getElementById('hfTbody').innerHTML =
      `<tr><td colspan="5" style="padding:20px;color:var(--muted);text-align:center">Нет файлов, удовлетворяющих фильтрам</td></tr>`;
    return;
  }

  const maxVal = Math.max(...files.map(f => hfMetric(f, sortKey)), 1);

  document.getElementById('hfTbody').innerHTML = files.map((f, i) => {
    const parts = f.path.split('/');
    const fname = parts.pop();
    const fdir = parts.slice(-2).join('/');
    const metric = hfMetric(f, sortKey);
    const barPct = Math.round(metric / maxVal * 100);
    const metricDisp = sortKey === 'churn_rate' ? metric.toFixed(2)
      : sortKey === 'size' ? (metric/1024).toFixed(1)+' МБ'
      : metric;
    const isWsDim = window.hfDimension === 'workspace';
    const dotEntities = isWsDim ? [...f.workspaces] : [...f.authors];
    const dots = dotEntities.map(n => {
      const color = isWsDim ? (typeof getWorkspaceColor === 'function' ? getWorkspaceColor(n) : themeColor('muted')) : (USERS.find(u => u.name === n)?.color || themeColor('muted'));
      return `<div class="hf-dot" style="background:${color}" title="${n}"></div>`;
    }).join('');
    const maxW = Math.max(...f.weekly, 1);
    const last8 = f.weekly.slice(-8);
    const spark = last8.map(v =>
      `<div class="hf-spark-b" style="height:${Math.max(2,Math.round(v/maxW*16))}px;background:${barColor}99"></div>`
    ).join('');
    const isSel = hfSel === f.path;
    const soloRiskBadge = (isWsDim ? f.isSoloRiskWs : f.isSoloRisk) ? `<span class="hf-badge" style="background:rgba(248,81,73,.15);color:var(--red);border:1px solid var(--red)" title="Единственный ${isWsDim?'воркспейс':'автор'} — риск Bus Factor">1 ${isWsDim?'ws':'авт.'}</span>` : '';
    const trendBadge = `<span style="font-size:10px;color:${HF_TREND_COLOR[f.trend]}" title="Тренд активности">${HF_TREND_ICON[f.trend]}</span>`;
    return `<tr class="${isSel?'sel':''}" onclick="selectHf(${i})">
      <td class="hf-rank">${i+1}</td>
      <td class="hf-name">
        <span class="hf-filename">${fname} <span class="hf-badge ${cfg.badge}">${cfg.text}</span> ${soloRiskBadge}</span>
        <span class="hf-filepath">${fdir} · ${trendBadge}</span>
      </td>
      <td><div class="hf-dots">${dots}</div><div style="font-size:9px;color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:90px">${dotEntities.join(', ')}</div></td>
      <td class="hf-bar-cell">
        <div class="hf-bar-wrap"><div class="hf-bar-fill" style="width:${barPct}%;background:${barColor}"></div></div>
        <div class="hf-spark" style="margin-top:3px">${spark}</div>
      </td>
      <td class="hf-metric">${metricDisp}</td>
    </tr>`;
  }).join('');
}

function selectHf(i) {
  const f = window._hfFiles[i];
  if (!f) return;
  hfSel = f.path;

  document.getElementById('hfEmpty').style.display = 'none';
  const panel = document.getElementById('hfDetail');
  panel.classList.add('on');

  document.getElementById('hfDetailName').textContent = f.path;

  const lastStr = f.lastDate.toLocaleDateString('ru', {day:'numeric',month:'short',year:'numeric'});
  const firstStr = f.firstDate.toLocaleDateString('ru', {day:'numeric',month:'short',year:'numeric'});
  const isWsDim = window.hfDimension === 'workspace';
  document.getElementById('hfDGrid').innerHTML = [
    {v: f.edits,                           l: 'Изм. / ревизий', c: 'var(--orange)'},
    {v: f.churnRate.toFixed(2)+'/д',       l: 'Churn rate',    c: 'var(--red)'},
    {v: f.maxRev,                          l: 'Макс. ревизия',  c: 'var(--purple)'},
    {v: isWsDim ? f.workspaceCount : f.authorCount, l: isWsDim ? 'Воркспейсов' : 'Авторов', c: 'var(--blue)'},
    {v: (f.totalSizeKB/1024).toFixed(1)+' МБ', l: 'Объём правок', c: ''},
    {v: f.daysAgo+' дн. назад',            l: 'Последнее изм.', c: ''},
    {v: firstStr,                          l: 'Первое изм.',   c: ''},
    {v: f.refactorScore,                   l: 'Риск-скор (рефакторинг)', c: f.refactorScore>60?'var(--red)':f.refactorScore>35?'var(--orange)':'var(--green)'},
  ].map(c => `<div class="hf-dcell">
    <div class="hf-dcell-v" style="color:${c.c||'var(--text)'}">${c.v}</div>
    <div class="hf-dcell-l">${c.l}</div>
  </div>`).join('');

  const total = f.edits;
  const ownEntities = isWsDim ? [...f.workspaces] : [...f.authors];
  const ownEdits = isWsDim ? f.workspaceEdits : f.authorEdits;
  const ownRows = ownEntities.map(name => {
    const cnt = ownEdits[name] || 0;
    const color = isWsDim ? (typeof getWorkspaceColor === 'function' ? getWorkspaceColor(name) : themeColor('muted')) : (USERS.find(u => u.name === name)?.color || themeColor('muted'));
    const pct = Math.round(cnt / total * 100);
    return `<div class="hf-own-row">
      <div class="hf-dot" style="background:${color};flex-shrink:0"></div>
      <span style="font-size:11px;color:${color};font-weight:600;width:80px">${name}</span>
      <div class="hf-own-bar"><div class="hf-own-fill" style="width:${pct}%;background:${color}"></div></div>
      <span style="font-size:11px;font-family:var(--mono);color:var(--muted);width:50px;text-align:right">${cnt} (${pct}%)</span>
    </div>`;
  }).join('');
  const riskNote = (isWsDim ? f.isSoloRiskWs : f.isSoloRisk) ? `<div style="font-size:11px;color:var(--red);margin-top:8px">⚠ Единственный ${isWsDim?'воркспейс':'автор'} — см. «Bus Factor → Файлы с 1 автором» для контекста по всему проекту.</div>` : '';

  const coTop = Object.entries(f.coFileCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const coHtml = coTop.length ? `<div style="margin-top:10px">
    <div style="font-size:10px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Часто меняются вместе</div>
    ${coTop.map(([name, cnt]) => `<div style="display:flex;justify-content:space-between;font-size:11px;padding:3px 0;">
      <span style="font-family:var(--mono);color:var(--text)">${name}</span>
      <span style="color:var(--muted)">${cnt}× вместе</span>
    </div>`).join('')}
  </div>` : '';

  document.getElementById('hfOwnership').innerHTML =
    `<div style="font-size:10px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Ownership</div>${ownRows}${riskNote}${coHtml}`;

  const weekLabels = f.weekly.map((_, wi) => {
    const d = new Date(HF_ACTIVE_DAYS[0]?.date || new Date());
    d.setDate(d.getDate() + wi * 7);
    return d.toLocaleDateString('ru', {day:'numeric',month:'short'});
  });
  if (hfChurnChart) hfChurnChart.destroy();
  const weeklyByDim = isWsDim ? f.weeklyByWorkspace : f.weeklyByAuthor;
  const dimNames = Object.keys(weeklyByDim);
  const datasets = dimNames.length > 1
    ? dimNames.map((name) => {
        const color = isWsDim ? (typeof getWorkspaceColor === 'function' ? getWorkspaceColor(name) : themeColor('muted')) : (USERS.find(x => x.name === name)?.color || themeColor('muted'));
        return { label: name, data: weeklyByDim[name], backgroundColor: ha(color, .5), borderColor: color, borderWidth: 1, borderRadius: 2 };
      })
    : [{ data: f.weekly, backgroundColor: ha('#f85149', .4), borderColor: '#f85149', borderWidth: 1, borderRadius: 2 }];
  hfChurnChart = new Chart('hfChurnChart', {
    type: 'bar',
    data: { labels: weekLabels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: authorNames.length > 1, labels: { color: themeColor('muted'), boxWidth: 10, font: { size: 10 } } } },
      scales: {
        x: { display: false, stacked: true },
        y: { stacked: true, grid: { color: themeColor('border2') }, ticks: { color: themeColor('muted'), maxTicksLimit: 3 } }
      }
    }
  });

  buildHotFiles();
}

function closeHfDetail(silent) {
  hfSel = null;
  document.getElementById('hfDetail').classList.remove('on');
  document.getElementById('hfEmpty').style.display = 'block';
  if (!silent) buildHotFiles();
}

renderApriori();
buildBusFactor();
initTlYearSel();
buildTlUserBtns();
buildTimeline();
buildHotFiles();
