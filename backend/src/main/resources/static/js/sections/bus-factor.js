

function buildFileOwnership() {
  const fileMap = {};
  daysForBlock('busfactor').forEach(d => {
    USERS.forEach(u => {
      d.perUser[u.name].commits.forEach(c => {
        const depotShort = c.depot.replace(/^\/\//, '').replace(/\/$/, '');
        c.files.forEach(f => {
          if (!fileMap[f.path]) fileMap[f.path] = { authors: {}, depots: {}, workspaces: {}, events: [], totalEdits: 0, ext: f.ext };
          const fo = fileMap[f.path];
          fo.authors[u.name] = (fo.authors[u.name] || 0) + 1;
          fo.depots[depotShort] = (fo.depots[depotShort] || 0) + 1;
          fo.workspaces[c.workspace] = (fo.workspaces[c.workspace] || 0) + 1;
          fo.events.push({ author: u.name, date: c.date, depot: depotShort, workspace: c.workspace });
          fo.totalEdits++;
        });
      });
    });
  });
  return Object.entries(fileMap).map(([path, d]) => {
    const authors = Object.entries(d.authors).sort((a, b) => b[1] - a[1]);
    const total = authors.reduce((s, [, c]) => s + c, 0);
    const dominant = authors[0];
    const events = d.events.sort((a, b) => a.date - b.date);
    return {
      path, ext: d.ext, authors, events,
      totalEdits: d.totalEdits,
      authorCount: authors.length,
      dominantAuthor: dominant[0],
      dominantPct: Math.round(dominant[1] / total * 100),
      depot: Object.entries(d.depots).sort((a, b) => b[1] - a[1])[0][0],
      workspace: Object.entries(d.workspaces).sort((a, b) => b[1] - a[1])[0][0],
      firstAuthorDate: events[0].date,
      firstDate: events[0].date,
      lastDate: events[events.length - 1].date,
    };
  });
}

let FILE_OWNERSHIP = buildFileOwnership();

function invalidateBusFactorCache() {
  FILE_OWNERSHIP = buildFileOwnership();
}

let bfView = 'impact';
window.bfDimension = 'author';
window.bfFilters = { count: null, countOp: 'gte', threshold: 80 };

function setBfDimension(dim) {
  window.bfDimension = dim;
  document.querySelectorAll('#bfDimSeg .sb').forEach((b) => b.classList.toggle('on', b.getAttribute('data-dim') === dim));
  document.getElementById('bfCountLabel').textContent = dim === 'author' ? 'Авторов на файл' : 'Воркспейсов на файл';

  window.bfFilters.count = null;
  document.getElementById('bfCountInput').value = '';
  buildBusFactor();
}

function bfApplyCountFilter() {
  window.bfFilters.countOp = document.getElementById('bfCountOp').value;
  const el = document.getElementById('bfCountInput');
  if (el.value === '') { window.bfFilters.count = null; buildBusFactor(); return; }
  let n = parseInt(el.value, 10);
  const max = parseInt(el.max, 10) || 1;
  if (isNaN(n) || n < 1) n = 1;
  if (n > max) n = max;
  el.value = String(n);
  window.bfFilters.count = n;
  buildBusFactor();
}

function bfFilteredFiles() {
  const f = window.bfFilters;
  const dp = depotPickers['busfactor'];
  const wp = workspacePickers['busfactor'];
  const ep = typeof extensionPickers !== 'undefined' ? extensionPickers['busfactor'] : null;

  const dpActiveShort = dp && dp.active.size < DEPOTS.length ? new Set([...dp.active].map((d) => d.replace(/^\/\//, '').replace(/\/$/, ''))) : null;
  const wsActive = wp && wp.active.size < (window.WORKSPACE_LIST || []).length ? wp.active : null;
  const activeAuthors = USERS.some((u) => !isAuthorActiveInScope('busfactor', u.name)) ? scopeAuthorActiveSet('busfactor') : null;

  const result = [];
  FILE_OWNERSHIP.forEach((file) => {
    if (ep && ep.size < EXTS_LIST.length && !ep.has(file.ext)) return;

    let events = file.events;
    if (dpActiveShort) events = events.filter((e) => dpActiveShort.has(e.depot));
    if (wsActive) events = events.filter((e) => wsActive.has(e.workspace));
    if (activeAuthors) events = events.filter((e) => activeAuthors.has(e.author));
    if (!events.length) return;

    const authorCounts = {};
    const depotCounts = {};
    const wsCounts = {};
    events.forEach((e) => {
      authorCounts[e.author] = (authorCounts[e.author] || 0) + 1;
      depotCounts[e.depot] = (depotCounts[e.depot] || 0) + 1;
      wsCounts[e.workspace] = (wsCounts[e.workspace] || 0) + 1;
    });
    const authors = Object.entries(authorCounts).sort((a, b) => b[1] - a[1]);
    const dominant = authors[0];
    const wsBreakdown = Object.entries(wsCounts).sort((a, b) => b[1] - a[1]);
    const dominantWs = wsBreakdown[0];

    if (f.count !== null) {
      const cnt = window.bfDimension === 'author' ? authors.length : wsBreakdown.length;
      const passes = f.countOp === 'eq' ? cnt === f.count : f.countOp === 'lte' ? cnt <= f.count : cnt >= f.count;
      if (!passes) return;
    }

    result.push({
      ...file, events, authors, authorCount: authors.length,
      dominantAuthor: dominant[0], dominantPct: Math.round((dominant[1] / events.length) * 100),
      workspaces: wsBreakdown, workspaceCount: wsBreakdown.length,
      dominantWorkspace: dominantWs[0], dominantWsPct: Math.round((dominantWs[1] / events.length) * 100),
      totalEdits: events.length,
      firstDate: events[0].date, lastDate: events[events.length - 1].date,
      depot: Object.entries(depotCounts).sort((a, b) => b[1] - a[1])[0][0],
      workspace: dominantWs[0],
      isSoloRisk: (window.bfDimension === 'author' ? authors.length : wsBreakdown.length) === 1,
    });
  });
  return result;
}

function bfRefreshCountBounds(files) {
  const el = document.getElementById('bfCountInput');
  if (!el) return;
  const dimKey = window.bfDimension === 'author' ? 'authorCount' : 'workspaceCount';
  const max = files.length ? Math.max(...files.map((f) => f[dimKey])) : 1;
  el.max = String(max);
  el.placeholder = `все (1–${max})`;
}

function setBfView(v) {
  bfView = v;
  document.querySelectorAll('#bfViewSeg .sb').forEach((b) => b.classList.toggle('on', b.getAttribute('data-view') === v));
  renderBfRight();
}

function setBfFilter(key, value) {
  window.bfFilters[key] = key === 'threshold' ? (parseInt(value, 10) || 0) : value;
  buildBusFactor();
}

function bfClampThreshold() {
  const el = document.getElementById('bfThresholdInput');
  let v = parseInt(el.value, 10);
  if (isNaN(v) || v < 0) v = 0;
  if (v > 100) v = 100;
  el.value = String(v);
  setBfFilter('threshold', v);
}

function openBfExtModal(ext) {
  if (typeof openFdm !== 'function') return;
  const files = bfFilteredFiles().filter((f) => f.ext === ext);
  if (!files.length) return;
  const isWs = window.bfDimension === 'workspace';
  const dimKey = isWs ? 'workspaceCount' : 'authorCount';
  const domKey = isWs ? 'dominantWorkspace' : 'dominantAuthor';
  const avgDim = files.reduce((s, f) => s + f[dimKey], 0) / files.length;
  const soloCount = files.filter((f) => f[dimKey] === 1).length;
  const byGroup = {};
  files.forEach((f) => { byGroup[f[domKey]] = (byGroup[f[domKey]] || 0) + 1; });
  const groupRanking = Object.entries(byGroup).sort((a, b) => b[1] - a[1]);
  const topFiles = [...files].sort((a, b) => b.totalEdits - a.totalEdits).slice(0, 10);

  openFdm({
    label: '.' + ext, val: files.length + ' файлов', sub: `avg ${avgDim.toFixed(1)} ${isWs ? 'воркспейсов' : 'авторов'} на файл`, stripe: avgDim < 1.5 ? 'sr' : avgDim < 2 ? 'so' : 'sg',
    body: fdmStats([
      [files.length, 'Файлов данного типа'],
      [soloCount, `С 1 ${isWs ? 'воркспейсом' : 'автором'}`],
      [Math.round(soloCount / files.length * 100) + '%', 'Риск-доля'],
      [files.reduce((s, f) => s + f.totalEdits, 0), 'Правок суммарно'],
    ]) +
    fdmSec(`Кто чаще всего доминирует по этому типу`, fdmRankTable(groupRanking.map(([name, cnt], i) => ({
      label: name, value: cnt + ' файл.', sub: Math.round(cnt / files.length * 100) + '%', highlight: i === 0,
      color: isWs ? ((typeof WORKSPACE_OWNER !== 'undefined' && USERS.find(u => u.name === WORKSPACE_OWNER[name])) ? USERS.find(u => u.name === WORKSPACE_OWNER[name]).color : undefined) : (USERS.find(u => u.name === name) || {}).color,
    })))) +
    fdmSec('Топ файлов по числу правок', fdmRankTable(topFiles.map((f, i) => ({
      label: f.path.split('/').pop(), value: f.totalEdits + ' изм.', sub: f[domKey], highlight: i === 0,
    })))),
  });
}

function openBfFileModal(path) {
  const file = FILE_OWNERSHIP.find(f => f.path === path);
  if (!file || typeof openFdm !== 'function') return;
  const rows = file.authors.map(([name, cnt]) => {
    const u = USERS.find(x => x.name === name);
    return { label: name, value: cnt + ' правок', sub: Math.round(cnt / file.totalEdits * 100) + '%', color: u ? u.color : undefined };
  });
  openFdm({
    label: file.path.split('/').pop(), val: file.totalEdits + ' правок', sub: file.path, stripe: file.authorCount === 1 ? 'sr' : 'sg',
    body: fdmStats([[file.authorCount, 'Авторов'], [file.dominantAuthor, 'Доминирующий'], [file.dominantPct + '%', 'Доля доминирующего'], [fmtDateRu(file.firstDate), 'Первая правка'], [fmtDateRu(file.lastDate), 'Последняя правка'], [file.depot, 'Депо'], [file.workspace, 'Воркспейс']]) +
      fdmSec('Авторы', fdmRankTable(rows)) +
      fdmSec('Хронология правок', fdmRankTable(file.events.map(e => ({ label: fmtDateRu(e.date), value: e.author, color: (USERS.find(u => u.name === e.author) || {}).color }))))
  });
}

function buildBusFactor() {
  const lpWrap = document.getElementById('lpWrap_busfactor');
  if (lpWrap) lpWrap.innerHTML = localPeriodControlHtml('busfactor', 'buildBusFactor');
  const files = bfFilteredFiles();
  bfRefreshCountBounds(files);
  if (!files.length) {
    document.getElementById('bfVal').textContent = '—';
    document.getElementById('bfSingle').textContent = '—';
    document.getElementById('bfMulti').textContent = '—';
    document.getElementById('bfTotal').textContent = '0';
    document.getElementById('bfRight').innerHTML = '<div class="fc-sub" style="padding:12px">Нет файлов, удовлетворяющих фильтрам</div>';
    return;
  }
  const dimKey = window.bfDimension === 'author' ? 'authorCount' : 'workspaceCount';
  const singleAuthor = files.filter(f => f[dimKey] === 1);
  const multi = files.filter(f => f[dimKey] > 1);
  const avgAuthors = files.reduce((s, f) => s + f[dimKey], 0) / files.length;
  const sortedCounts = files.map(f => f[dimKey]).sort((a, b) => a - b);
  const medianAuthors = sortedCounts[Math.floor(sortedCounts.length / 2)];

  const bfScore = Math.min(avgAuthors, 3);
  const pct = (bfScore - 1) / 2;
  const arcLen = 220;
  const offset = arcLen - arcLen * pct;
  document.getElementById('bfArc').setAttribute('stroke-dashoffset', offset);
  const needleAngle = -90 + pct * 180;
  document.getElementById('bfNeedle').setAttribute('transform', `rotate(${needleAngle} 90 90)`);

  const color = pct < 0.33 ? 'var(--red)' : pct < 0.66 ? 'var(--orange)' : 'var(--green)';
  const valEl = document.getElementById('bfVal');
  valEl.textContent = avgAuthors.toFixed(1);
  valEl.style.color = color;

  document.getElementById('bfSingle').textContent = `${singleAuthor.length} (${Math.round(singleAuthor.length / files.length * 100)}%)`;
  document.getElementById('bfMulti').textContent = `${multi.length} (${Math.round(multi.length / files.length * 100)}%)`;
  document.getElementById('bfTotal').textContent = files.length.toLocaleString('ru');
  const medEl = document.getElementById('bfMedian');
  if (medEl) medEl.textContent = medianAuthors + ' (медиана)';

  renderBfRight();
}

function bfActiveUsers(files) {
  const checked = typeof isAuthorActiveInScope === 'function' ? USERS.filter((u) => isAuthorActiveInScope('busfactor', u.name)) : USERS;
  if (!files) return checked;
  const namesWithFiles = new Set();
  files.forEach((f) => f.authors.forEach(([name]) => namesWithFiles.add(name)));
  return checked.filter((u) => namesWithFiles.has(u.name));
}

function bfImpactFor(files, threshold) {
  return bfActiveUsers(files).map(u => {
    const soloFiles = files.filter(f => f.dominantAuthor === u.name && f.dominantPct >= threshold);
    const pct = Math.round(soloFiles.length / files.length * 100);
    return { user: u, soloFiles: soloFiles.length, pct };
  }).sort((a, b) => b.pct - a.pct);
}

function bfImpactForWorkspace(files, threshold) {
  const wsList = [...new Set(files.map((f) => f.dominantWorkspace))];
  return wsList.map((ws) => {
    const soloFiles = files.filter((f) => f.dominantWorkspace === ws && f.dominantWsPct >= threshold);
    const pct = Math.round(soloFiles.length / files.length * 100);
    const owner = typeof WORKSPACE_OWNER !== 'undefined' ? WORKSPACE_OWNER[ws] : null;
    const ownerUser = owner ? USERS.find((u) => u.name === owner) : null;
    return { ws, soloFiles: soloFiles.length, pct, color: ownerUser ? ownerUser.color : themeColor('muted') };
  }).sort((a, b) => b.pct - a.pct);
}

window.bfTopN = { files: 20, ownership: 15, handoff: 15, bytype: 10 };

function bfClampTopN(view, matchedLen) {
  const el = document.getElementById('bfTopN_' + view);
  if (!el) return;
  let n = parseInt(el.value, 10);
  if (isNaN(n) || n < 1) n = matchedLen ? 1 : 0;
  if (n > matchedLen) n = matchedLen;
  el.value = String(n);
  window.bfTopN[view] = n;
  renderBfRight();
}
function bfTopNControlHtml(view, matchedLen) {
  return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;">
    <label style="font-size:11px;color:var(--muted);">Показать топ:</label>
    <input type="number" id="bfTopN_${view}" value="${window.bfTopN[view]}" min="1"
           onblur="bfClampTopN('${view}', ${matchedLen})" onkeydown="if(event.key==='Enter')this.blur()"
           style="width:55px;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:11px;font-family:var(--mono);outline:none;">
    <span style="font-size:11px;color:var(--muted)">из ${matchedLen}</span>
  </div>`;
}

function renderBfRight() {
  const el = document.getElementById('bfRight');
  const files = bfFilteredFiles();
  const threshold = window.bfFilters.threshold;
  if (!files.length) { el.innerHTML = '<div class="fc-sub" style="padding:12px">Нет файлов, удовлетворяющих фильтрам</div>'; return; }

  if (bfView === 'impact') {
    const by = window.bfDimension;
    const impacts = by === 'author' ? bfImpactFor(files, threshold) : bfImpactForWorkspace(files, threshold);
    const rowsHtml = impacts.map(i => {
      const name = by === 'author' ? i.user.name : i.ws;
      const color = by === 'author' ? i.user.color : i.color;
      return `
          <div class="bf-impact-row">
            <div class="bf-impact-hd">
              <div class="bf-owner-dot" style="background:${color}"></div>
              <span class="bf-impact-name" style="color:${color}">${name}</span>
              <span class="bf-impact-sub">${i.soloFiles} файлов · ${i.pct}% проекта</span>
            </div>
            <div class="bf-impact-bar-wrap">
              <div class="bf-impact-bar" style="width:${i.pct}%;background:${color}88;border:1px solid ${color}"></div>
            </div>
            <div style="font-size:11px;color:var(--muted);margin-top:6px">
              Если ${by === 'author' ? 'уйдёт' : 'станет недоступен'} <strong style="color:${color}">${name}</strong> —
              будет затронуто <strong style="color:var(--text)">${i.pct}%</strong> файлов (в рамках фильтра)
            </div>
          </div>`;
    }).join('');
    el.innerHTML = `
      <div class="ct">Влияние ухода</div>
      <div class="cs">% файлов где ${by === 'author' ? 'автор' : 'воркспейс'} — единственный или доминирующий (≥<strong style="color:var(--text)">${threshold}%</strong>) редактор</div>
      <div class="bf-impact-list">${rowsHtml}</div>`;
  }

  else if (bfView === 'depots') {
    const isWsD = window.bfDimension === 'workspace';
    const dimKeyD = isWsD ? 'workspaceCount' : 'authorCount';
    const groups = [...new Set(files.map(f => f.depot))];
    const groupStats = groups.map(name => {
      const gFiles = files.filter(f => f.depot === name);
      if (!gFiles.length) return null;
      const single = gFiles.filter(f => f[dimKeyD] === 1);
      const multi = gFiles.filter(f => f[dimKeyD] > 1);
      const avgA = gFiles.reduce((s, f) => s + f[dimKeyD], 0) / gFiles.length;
      const impact = isWsD ? bfImpactForWorkspace(gFiles, threshold) : bfImpactFor(gFiles, threshold);
      return { name, total: gFiles.length, single: single.length, multi: multi.length, avgA, impact };
    }).filter(Boolean).sort((a, b) => a.avgA - b.avgA);

    el.innerHTML = `
      <div class="ct">Bus Factor по депо</div>
      <div class="cs">концентрация знаний · риск при уходе ${isWsD ? 'воркспейса' : 'автора'}</div>
      <div style="display:flex;flex-direction:column;gap:14px;margin-top:8px">
        ${groupStats.map(g => `
          <div style="background:var(--s2);border:1px solid var(--border2);border-radius:6px;padding:14px;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
              <span style="font-size:13px;font-weight:600;color:var(--text)">${g.name}</span>
              <span style="margin-left:auto;font-size:11px;color:var(--muted)">${g.total} файлов · avg ${isWsD?'воркспейсов':'авторов'}: <strong style="color:${g.avgA < 1.5 ? 'var(--red)' : g.avgA < 2 ? 'var(--orange)' : 'var(--green)'}">${g.avgA.toFixed(1)}</strong></span>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px;">
              <div style="background:var(--bg);border-radius:4px;padding:8px 10px;border:1px solid var(--border2);">
                <div style="font-size:15px;font-weight:700;font-family:var(--mono);color:var(--red)">${g.single}</div>
                <div style="font-size:10px;color:var(--muted)">1 автор (риск)</div>
              </div>
              <div style="background:var(--bg);border-radius:4px;padding:8px 10px;border:1px solid var(--border2);">
                <div style="font-size:15px;font-weight:700;font-family:var(--mono);color:var(--green)">${g.multi}</div>
                <div style="font-size:10px;color:var(--muted)">2+ авторов</div>
              </div>
              <div style="background:var(--bg);border-radius:4px;padding:8px 10px;border:1px solid var(--border2);">
                <div style="font-size:15px;font-weight:700;font-family:var(--mono)">${Math.round(g.single / g.total * 100)}%</div>
                <div style="font-size:10px;color:var(--muted)">риск (%)</div>
              </div>
            </div>
            <div style="font-size:10px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Влияние ухода</div>
            ${g.impact.map(ai => {
              const nm = isWsD ? ai.ws : ai.user.name;
              const col = isWsD ? ai.color : ai.user.color;
              return `
              <div style="margin-bottom:6px;">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
                  <div class="bf-owner-dot" style="background:${col}"></div>
                  <span style="font-size:11px;font-weight:600;color:${col}">${nm}</span>
                  <span style="font-size:11px;color:var(--muted);margin-left:auto">${ai.soloFiles} файлов · ${ai.pct}%</span>
                </div>
                <div class="bf-impact-bar-wrap">
                  <div class="bf-impact-bar" style="width:${ai.pct}%;background:${col}88;border:1px solid ${col}"></div>
                </div>
              </div>`;
            }).join('')}
          </div>`).join('')}
      </div>`;
  }

  else if (bfView === 'files') {
    const isWs = window.bfDimension === 'workspace';
    const dimKey = isWs ? 'workspaceCount' : 'authorCount';
    const domKey = isWs ? 'dominantWorkspace' : 'dominantAuthor';
    const soloAll = files.filter(f => f[dimKey] === 1);
    const solo = soloAll.slice(0, window.bfTopN.files);
    const groups = isWs
      ? [...new Set(soloAll.map(f => f[domKey]))].map(name => ({ name, color: (typeof WORKSPACE_OWNER !== 'undefined' && USERS.find(u => u.name === WORKSPACE_OWNER[name])) ? USERS.find(u => u.name === WORKSPACE_OWNER[name]).color : themeColor('muted') }))
      : bfActiveUsers(files).map(u => ({ name: u.name, color: u.color }));
    const byGroup = {};
    groups.forEach(g => byGroup[g.name] = soloAll.filter(f => f[domKey] === g.name));

    el.innerHTML = `
      <div class="ct">Файлы с единственным ${isWs ? 'воркспейсом' : 'автором'}</div>
      <div class="cs">файлы, которые ${isWs ? 'сабмитили только через один воркспейс' : 'редактировал только один разработчик'} — зона риска (клик — детали)</div>
      <div style="display:flex;gap:10px;margin-bottom:10px;flex-wrap:wrap">
        ${groups.map(g => `<span style="font-size:11px;display:flex;align-items:center;gap:5px">
          <span class="bf-owner-dot" style="background:${g.color}"></span>
          <span style="color:${g.color}">${g.name}</span>
          <span style="color:var(--muted)">${(byGroup[g.name]||[]).length} файлов</span>
        </span>`).join('')}
      </div>
      ${bfTopNControlHtml('files', soloAll.length)}
      <div class="bf-file-list">
        ${solo.map(f => {
          const g = groups.find(gg => gg.name === f[domKey]);
          const shortPath = f.path.split('/').slice(-2).join('/');
          return `<div class="bf-file-row" style="cursor:pointer" onclick="openBfFileModal('${f.path.replace(/'/g, "\\'")}')">
            <div class="bf-owner-dot" style="background:${g ? g.color : themeColor('muted')}"></div>
            <span class="bf-file-name" title="${f.path}">${shortPath}</span>
            <span class="bf-file-owner" style="color:${g ? g.color : themeColor('muted')}">${f[domKey]}</span>
            <span class="bf-file-pct">${f.totalEdits} изм.</span>
          </div>`;
        }).join('')}
      </div>`;
  }

  else if (bfView === 'ownership') {
    const isWs = window.bfDimension === 'workspace';
    const breakdownKey = isWs ? 'workspaces' : 'authors';
    const allSorted = [...files].sort((a, b) => b.totalEdits - a.totalEdits);
    const top = allSorted.slice(0, window.bfTopN.ownership);
    const colorFor = (name) => isWs
      ? ((typeof WORKSPACE_OWNER !== 'undefined' && USERS.find(u => u.name === WORKSPACE_OWNER[name])) ? USERS.find(u => u.name === WORKSPACE_OWNER[name]).color : themeColor('muted'))
      : ((USERS.find(u => u.name === name) || {}).color || themeColor('muted'));
    el.innerHTML = `
      <div class="ct">Ownership горячих файлов</div>
      <div class="cs">топ файлов по числу изменений · доля каждого ${isWs ? 'воркспейса' : 'автора'} (клик — детали)</div>
      ${bfTopNControlHtml('ownership', allSorted.length)}
      <div class="scroll-box" style="display:flex;flex-direction:column;gap:6px;padding:8px;">
        ${top.map(f => {
          const shortPath = f.path.split('/').slice(-1)[0];
          const breakdown = f[breakdownKey];
          const total = breakdown.reduce((s, [, c]) => s + c, 0);
          const bars = breakdown.map(([name, cnt]) => {
            const w = Math.round(cnt / total * 100);
            return `<div style="width:${w}%;height:100%;background:${colorFor(name)}88;border-right:1px solid var(--bg)" title="${name}: ${w}%"></div>`;
          }).join('');
          return `<div style="cursor:pointer" onclick="openBfFileModal('${f.path.replace(/'/g, "\\'")}')">
            <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px">
              <span style="font-family:var(--mono);color:var(--text)">${shortPath}</span>
              <span style="color:var(--muted)">${f.totalEdits} изм.</span>
            </div>
            <div style="height:8px;background:var(--border);border-radius:3px;overflow:hidden;display:flex">${bars}</div>
          </div>`;
        }).join('')}
      </div>
      <div style="display:flex;gap:12px;margin-top:10px;flex-wrap:wrap">
        ${(isWs ? [...new Set(files.flatMap(f => f.workspaces.map(w => w[0])))] : bfActiveUsers(files).map(u => u.name)).map(name => `<span style="font-size:10px;display:flex;align-items:center;gap:4px">
          <span style="width:10px;height:10px;border-radius:2px;background:${colorFor(name)}88;border:1px solid ${colorFor(name)};display:inline-block"></span>
          ${name}
        </span>`).join('')}
      </div>`;
  }

  else if (bfView === 'bytype') {
    const isWs = window.bfDimension === 'workspace';
    const dimKey = isWs ? 'workspaceCount' : 'authorCount';
    const exts = [...new Set(files.map(f => f.ext))];
    const rowsAll = exts.map(ext => {
      const eFiles = files.filter(f => f.ext === ext);
      const avgA = eFiles.reduce((s, f) => s + f[dimKey], 0) / eFiles.length;
      const singlePct = Math.round(eFiles.filter(f => f[dimKey] === 1).length / eFiles.length * 100);
      return { ext, count: eFiles.length, avgA, singlePct };
    }).sort((a, b) => a.avgA - b.avgA);
    const rows = rowsAll.slice(0, window.bfTopN.bytype);
    el.innerHTML = `
      <div class="ct">Bus Factor по типу файла</div>
      <div class="cs">какие типы файлов сильнее всего сконцентрированы у одного ${isWs ? 'воркспейса' : 'автора'} (клик — детали)</div>
      ${bfTopNControlHtml('bytype', rowsAll.length)}
      <div class="bf-file-list">
        ${rows.map(r => `<div class="bf-file-row" style="cursor:pointer" onclick="openBfExtModal('${r.ext}')">
          <span class="bf-file-name" style="font-family:var(--mono)">.${r.ext}</span>
          <span class="bf-file-owner" style="color:${r.avgA < 1.5 ? 'var(--red)' : r.avgA < 2 ? 'var(--orange)' : 'var(--green)'}">avg ${r.avgA.toFixed(1)} ${isWs ? 'ws' : 'авт.'}</span>
          <span class="bf-file-pct">${r.singlePct}% на 1 ${isWs ? 'воркспейсе' : 'авторе'} · ${r.count} файлов</span>
        </div>`).join('')}
      </div>`;
  }

  else if (bfView === 'handoff') {
    const isWs = window.bfDimension === 'workspace';
    const dimKey = isWs ? 'workspaceCount' : 'authorCount';
    const domKey = isWs ? 'dominantWorkspace' : 'dominantAuthor';
    const evKey = isWs ? 'workspace' : 'author';
    const allDates = files.flatMap(f => f.events.map(e => e.date));
    const midDate = allDates.sort((a, b) => a - b)[Math.floor(allDates.length / 2)];
    const ready = [], notReady = [];
    files.forEach(f => {
      const before = new Set(f.events.filter(e => e.date < midDate).map(e => e[evKey]));
      const after = new Set(f.events.filter(e => e.date >= midDate).map(e => e[evKey]));
      const joined = [...after].some(a => !before.has(a));
      if (f[dimKey] > 1 && joined) ready.push(f); else if (f[dimKey] === 1) notReady.push(f);
    });
    el.innerHTML = `
      <div class="ct">Готовность к передаче знаний</div>
      <div class="cs">файлы, к которым во второй половине периода подключился новый ${isWs ? 'воркспейс' : 'автор'} — знание уже расходится</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
        <div style="background:var(--bg);border:1px solid var(--border2);border-radius:6px;padding:12px">
          <div style="font-size:20px;font-weight:700;color:var(--green)">${ready.length}</div>
          <div style="font-size:11px;color:var(--muted)">файлов — знание уже начало расходиться</div>
        </div>
        <div style="background:var(--bg);border:1px solid var(--border2);border-radius:6px;padding:12px">
          <div style="font-size:20px;font-weight:700;color:var(--red)">${notReady.length}</div>
          <div style="font-size:11px;color:var(--muted)">файлов — как трогал один ${isWs?'воркспейс':'человек'}, так и трогает</div>
        </div>
      </div>
      ${bfTopNControlHtml('handoff', notReady.length)}
      <div class="bf-file-list">
        ${notReady.slice(0, window.bfTopN.handoff).map(f => {
          const g = isWs ? null : USERS.find(u => u.name === f[domKey]);
          const color = isWs ? ((typeof WORKSPACE_OWNER !== 'undefined' && USERS.find(u => u.name === WORKSPACE_OWNER[f[domKey]])) ? USERS.find(u => u.name === WORKSPACE_OWNER[f[domKey]]).color : themeColor('muted')) : (g ? g.color : themeColor('muted'));
          return `<div class="bf-file-row" style="cursor:pointer" onclick="openBfFileModal('${f.path.replace(/'/g, "\\'")}')">
            <div class="bf-owner-dot" style="background:${color}"></div>
            <span class="bf-file-name" title="${f.path}">${f.path.split('/').slice(-2).join('/')}</span>
            <span class="bf-file-owner" style="color:${color}">${f[domKey]}</span>
            <span class="bf-file-pct">${f.totalEdits} изм.</span>
          </div>`;
        }).join('')}
      </div>`;
  }
}

if (document.getElementById('bfViewSeg')) buildBusFactor();
