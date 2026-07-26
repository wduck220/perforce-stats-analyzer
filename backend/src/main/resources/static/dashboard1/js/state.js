

function themeColor(varName) {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--' + varName).trim();
  return v || '#7d8590';
}

window.globalPeriod = { from: null, to: null };
let _filteredDaysCache = null;
let _filteredDaysCacheKey = null;

function filteredDays() {
  const { from, to } = window.globalPeriod;
  const key = (from || '') + '|' + (to || '');
  if (_filteredDaysCacheKey === key && _filteredDaysCache) return _filteredDaysCache;
  let result;
  if (!from && !to) {
    result = DAY_DATA;
  } else {
    const fromT = from ? new Date(from).getTime() : -Infinity;
    const toT = to ? new Date(to).getTime() + 86399999 : Infinity;
    result = DAY_DATA.filter((d) => { const t = d.date.getTime(); return t >= fromT && t <= toT; });
  }
  _filteredDaysCacheKey = key;
  _filteredDaysCache = result;
  return result;
}

function applyGlobalPeriod() {
  _filteredDaysCache = null;
  _filteredDaysCacheKey = null;
  if (typeof invalidateBusFactorCache === 'function') invalidateBusFactorCache();
  if (typeof invalidateHotFilesCache === 'function') invalidateHotFilesCache();
  if (typeof invalidateAnomaliesCache === 'function') invalidateAnomaliesCache();
  if (typeof invalidateApRulesCache === 'function') invalidateApRulesCache();
  if (typeof invalidateFactsCache === 'function') invalidateFactsCache();
  if (typeof rebuildWholeDashboard === 'function') rebuildWholeDashboard();
}

function computeDaysForPeriod(period) {
  if (!period || (!period.from && !period.to)) return DAY_DATA;
  const fromT = period.from ? new Date(period.from).getTime() : -Infinity;
  const toT = period.to ? new Date(period.to).getTime() + 86399999 : Infinity;
  return DAY_DATA.filter((d) => { const t = d.date.getTime(); return t >= fromT && t <= toT; });
}

window.localPeriods = {};
function getLocalPeriod(key) {
  if (!window.localPeriods[key]) window.localPeriods[key] = { active: false, from: null, to: null };
  return window.localPeriods[key];
}

function daysForBlock(key) {
  const lp = getLocalPeriod(key);
  return lp.active ? computeDaysForPeriod(lp) : filteredDays();
}

function localPeriodControlHtml(key, rebuildFnName) {
  const lp = getLocalPeriod(key);
  const presetVal = !lp.active ? 'global' : (lp.from || lp.to) ? 'custom' : 'all';
  return `<div class="lp-control" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;background:rgba(88,166,255,0.08);border:1px solid rgba(88,166,255,0.35);border-radius:6px;padding:5px 10px;">
    <svg width="12" height="12" viewBox="0 0 16 16" fill="#58a6ff" style="flex-shrink:0"><path d="M4.5 0a.5.5 0 01.5.5V1h6V.5a.5.5 0 011 0V1h1.5A1.5 1.5 0 0115 2.5v11A1.5 1.5 0 0113.5 15h-11A1.5 1.5 0 011 13.5v-11A1.5 1.5 0 012.5 1H4V.5a.5.5 0 01.5-.5zM2 4v9.5a.5.5 0 00.5.5h11a.5.5 0 00.5-.5V4H2z"/></svg>
    <label style="font-size:11px;color:#58a6ff;font-weight:600;">Период блока:</label>
    <select class="dsel" id="lpPreset_${key}" onchange="setLocalPeriodPreset('${key}', this.value, '${rebuildFnName}')" style="font-size:11px;">
      <option value="global" ${presetVal === 'global' ? 'selected' : ''}>Как общий</option>
      <option value="all" ${presetVal === 'all' ? 'selected' : ''}>Всё время</option>
      <option value="30">Последние 30 дней</option>
      <option value="90">Последние 90 дней</option>
      <option value="180">Последние 180 дней</option>
      <option value="custom" ${presetVal === 'custom' ? 'selected' : ''}>Свой диапазон…</option>
    </select>
    <input type="date" id="lpFrom_${key}" value="${lp.from || ''}" onchange="setLocalPeriodCustom('${key}', '${rebuildFnName}')"
           style="display:${presetVal === 'custom' ? '' : 'none'};background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 5px;font-size:11px;font-family:var(--mono);">
    <span id="lpDash_${key}" style="display:${presetVal === 'custom' ? '' : 'none'};color:var(--muted)">→</span>
    <input type="date" id="lpTo_${key}" value="${lp.to || ''}" onchange="setLocalPeriodCustom('${key}', '${rebuildFnName}')"
           style="display:${presetVal === 'custom' ? '' : 'none'};background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 5px;font-size:11px;font-family:var(--mono);">
    ${lp.active ? `<button onclick="resetLocalPeriod('${key}', '${rebuildFnName}')" style="font-size:11px;font-family:var(--font);padding:3px 9px;border-radius:4px;cursor:pointer;border:1px solid var(--border);background:var(--s2);color:var(--text);">Сброс к общему</button>` : ''}
  </div>`;
}

function setLocalPeriodPreset(key, preset, rebuildFnName) {
  const lp = getLocalPeriod(key);
  const fromEl = document.getElementById('lpFrom_' + key);
  const toEl = document.getElementById('lpTo_' + key);
  const dash = document.getElementById('lpDash_' + key);
  if (preset === 'global') {
    lp.active = false; lp.from = null; lp.to = null;
  } else if (preset === 'all') {
    lp.active = true; lp.from = null; lp.to = null;
  } else if (preset === 'custom') {
    if (fromEl) fromEl.style.display = '';
    if (toEl) toEl.style.display = '';
    if (dash) dash.style.display = '';
    if (!lp.from && !lp.to) {
      const days = filteredDays();
      const last = days[days.length - 1]?.date || new Date();
      lp.to = last.toISOString().slice(0, 10);
      const from = new Date(last); from.setDate(from.getDate() - 29);
      lp.from = from.toISOString().slice(0, 10);
      if (fromEl) fromEl.value = lp.from;
      if (toEl) toEl.value = lp.to;
    }
    lp.active = true;
  } else {
    const n = parseInt(preset, 10);
    const allDays = DAY_DATA;
    const last = allDays[allDays.length - 1]?.date || new Date();
    const from = new Date(last); from.setDate(from.getDate() - (n - 1));
    lp.active = true;
    lp.from = from.toISOString().slice(0, 10);
    lp.to = last.toISOString().slice(0, 10);
  }
  invalidateBlockCache(key);
  if (typeof window[rebuildFnName] === 'function') window[rebuildFnName]();
}

function setLocalPeriodCustom(key, rebuildFnName) {
  const lp = getLocalPeriod(key);
  lp.active = true;
  lp.from = document.getElementById('lpFrom_' + key).value || null;
  lp.to = document.getElementById('lpTo_' + key).value || null;
  invalidateBlockCache(key);
  if (typeof window[rebuildFnName] === 'function') window[rebuildFnName]();
}

function resetLocalPeriod(key, rebuildFnName) {
  window.localPeriods[key] = { active: false, from: null, to: null };
  invalidateBlockCache(key);
  if (typeof window[rebuildFnName] === 'function') window[rebuildFnName]();
}

function invalidateBlockCache(key) {
  if (key === 'busfactor' && typeof invalidateBusFactorCache === 'function') invalidateBusFactorCache();
  if (key === 'hotfiles' && typeof invalidateHotFilesCache === 'function') invalidateHotFilesCache();
  if (key === 'anomalies' && typeof invalidateAnomaliesCache === 'function') invalidateAnomaliesCache();
  if (key === 'apriori' && typeof invalidateApRulesCache === 'function') invalidateApRulesCache();
  if (key === 'facts' && typeof invalidateFactsCache === 'function') invalidateFactsCache();
}

let activeUsers = new Set(USERS.map((u) => u.name));
let selectedDayKey = null;

let avgPeriod = 'hour';
let avgActiveUsers = new Set(USERS.map((u) => u.name));

let avgChartInst = null;
let weekChartInst = null;
let scatterChartInst = null;
let userBarChartInst = null;
let fileStackChartInst = null;
let authorDonutChartInst = null;

let fileVizMode = 'ext';
let scatterMode = 'files_size';
let userVizMode = 'commits';
let fileStackMode = 'ext';
let trendGran = 'week';
