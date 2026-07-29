

function anomAllCommits(blockKey) {
  const out = [];
  (blockKey ? daysForBlock(blockKey) : filteredDays()).forEach((day) => {
    USERS.forEach((u) => {
      const pu = day.perUser[u.name];
      if (pu && pu.commits) pu.commits.forEach((c) => out.push(c));
    });
  });
  return out;
}

function meanStd(arr) {
  if (!arr.length) return { mean: 0, std: 0 };
  const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
  const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
  return { mean, std: Math.sqrt(variance) };
}

function statsFor(arr) {
  const { mean, std } = meanStd(arr);
  const sorted = arr.slice().sort((a, b) => a - b);
  const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  const q1 = q(0.25), q3 = q(0.75);
  let skew = 0;
  if (arr.length > 0 && std > 1e-9) {
    const m3 = arr.reduce((s, v) => s + (v - mean) ** 3, 0) / arr.length;
    skew = m3 / std ** 3;
  }
  return { mean, std, q1, q3, iqr: q3 - q1, skew };
}

function euclidDist(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return Math.sqrt(s);
}

const ANOM_Z_THRESHOLD = 2.8;
const ANOM_IQR_MULT = 2.2;
const ANOM_ISO_Z_THRESHOLD = 2.5;
const ANOM_LOF_THRESHOLD = 1.6;
const ANOM_KNN_K = 10;

const ANOM_SIGNAL_LABELS = {
  file_count: 'Число файлов',
  total_size: 'Объём',
  avg_size: 'Средний размер файла',
  hour: 'Час сабмита',
  ext_unusual: 'Необычные типы файлов',
};
const ANOM_METHOD_LABELS = {
  zscore: 'Z-score',
  iqr: 'IQR',
  isoforest: 'Isolation Forest',
  lof: 'LOF',
};
const ANOM_METHOD_COLORS = { zscore: '#58a6ff', iqr: '#3fb950', isoforest: '#d29922', lof: '#bc8cff' };

let anomComputeCache = null;

function invalidateAnomaliesCache() {
  anomComputeCache = null;
}
let anomAuthorExtFreqCache = null;

function computeAuthorExtFreq() {
  if (anomAuthorExtFreqCache) return anomAuthorExtFreqCache;
  const commits = anomAllCommits('anomalies');
  const byAuthor = {};
  commits.forEach((c) => { (byAuthor[c.author] || (byAuthor[c.author] = [])).push(c); });
  const freq = {};
  Object.keys(byAuthor).forEach((author) => {
    const extCounts = {};
    let total = 0;
    byAuthor[author].forEach((c) => c.files.forEach((f) => { extCounts[f.ext] = (extCounts[f.ext] || 0) + 1; total++; }));
    const f = {};
    Object.keys(extCounts).forEach((ext) => { f[ext] = extCounts[ext] / total; });
    freq[author] = f;
  });
  anomAuthorExtFreqCache = freq;
  return freq;
}

function computeAnomalies() {
  if (anomComputeCache) return anomComputeCache;
  const result = computeAnomaliesUncached();
  anomComputeCache = result;
  return result;
}

function anomBuildCommitLookup() {
  if (window._anomCommitByCL) return window._anomCommitByCL;
  const byCL = {};
  DAY_DATA.forEach((day) => USERS.forEach((u) => {
    (day.perUser[u.name]?.commits || []).forEach((c) => { byCL[String(c.cl).replace('#', '')] = c; });
  }));
  window._anomCommitByCL = byCL;
  return byCL;
}

const ANOM_PY_FEATURE_ADAPTERS = {
  file_count: { toDisplayUnit: (bytes) => bytes, fmt: (v) => Math.round(v).toLocaleString('ru') },
  total_size: { toDisplayUnit: (bytes) => bytes / 1e9, fmt: (v) => v.toFixed(2) + ' ГБ' },
  avg_size: { toDisplayUnit: (bytes) => bytes / 1e9, fmt: (v) => (v * 1000).toFixed(0) + ' МБ' },
  hour: { toDisplayUnit: (v) => v, fmt: (v) => String(Math.round(v)).padStart(2, '0') + ':00' },
};
const ANOM_PY_METHOD_KEY_MAP = { ZScore: 'zscore', IQR: 'iqr', IsolationForest: 'isoforest', LOF: 'lof' };

function anomPyDetailToRow(detail) {
  const commitLookup = anomBuildCommitLookup();
  const commit = commitLookup[String(detail.changeListId)];
  if (!commit) return null;

  const features = (detail.deviations || []).map((dev) => {
    const adapter = ANOM_PY_FEATURE_ADAPTERS[dev.feature];
    const actual = adapter ? adapter.toDisplayUnit(dev.value) : dev.value;
    return {
      key: dev.feature,
      label: ANOM_SIGNAL_LABELS[dev.feature] || dev.feature,
      actual,
      typical: null,
      fmt: adapter ? adapter.fmt : (v) => String(v),
      st: {},
      z: dev.z_score,
      active: true,
    };
  });

  const methods = Object.entries(detail.method_votes || {}).map(([pyKey, active]) => ({
    key: ANOM_PY_METHOD_KEY_MAP[pyKey] || pyKey.toLowerCase(),
    label: ANOM_METHOD_LABELS[ANOM_PY_METHOD_KEY_MAP[pyKey]] || pyKey,
    active,
    note: active ? 'сработал (по данным Python-модели)' : 'в пределах нормы',
  }));
  const votes = methods.filter((m) => m.active).length;
  const topSignal = features[0] || { label: '—', z: 0 };

  return { commit, features, methods, votes, topSignal };
}

function computeAnomaliesFromPython() {
  const level = window.PYTHON_REPORT?.anomalies?.submits;
  if (!level || !level.anomaly_details) return null;
  return level.anomaly_details.map(anomPyDetailToRow).filter(Boolean);
}

function computeAnomaliesUncached() {
  const pyResult = computeAnomaliesFromPython();
  if (pyResult !== null) return pyResult;
  return computeAnomaliesUncachedJS();
}

function computeAnomaliesUncachedJS() {
  const commits = anomAllCommits('anomalies');
  if (!commits.length) return [];

  const byAuthor = {};
  commits.forEach((c) => { (byAuthor[c.author] || (byAuthor[c.author] = [])).push(c); });

  const EXT_RARE_THRESHOLD = 0.05;
  const authorExtFreq = {};
  Object.keys(byAuthor).forEach((author) => {
    const extCounts = {};
    let total = 0;
    byAuthor[author].forEach((c) => c.files.forEach((f) => { extCounts[f.ext] = (extCounts[f.ext] || 0) + 1; total++; }));
    const freq = {};
    Object.keys(extCounts).forEach((ext) => { freq[ext] = extCounts[ext] / total; });
    authorExtFreq[author] = freq;
  });
  function unusualExtRatioFor(c) {
    const freq = authorExtFreq[c.author] || {};
    if (!c.nFiles) return 0;
    const unusualCount = c.files.filter((f) => (freq[f.ext] || 0) < EXT_RARE_THRESHOLD).length;
    return unusualCount / c.nFiles;
  }

  const authorStats = {};
  Object.keys(byAuthor).forEach((author) => {
    const list = byAuthor[author];
    authorStats[author] = {
      file_count: statsFor(list.map((c) => c.nFiles)),
      total_size: statsFor(list.map((c) => c.sizeGB)),
      avg_size: statsFor(list.map((c) => Math.log(c.sizeGB / c.nFiles + 1e-6))),
      hour: statsFor(list.map((c) => c.date.getHours())),
      ext_unusual: statsFor(list.map((c) => unusualExtRatioFor(c))),
    };
  });

  const DEPOTS_SEEN = [...new Set(commits.map((c) => c.depot))];
  const WS_SEEN = [...new Set(commits.map((c) => c.workspace))];
  const gFiles = meanStd(commits.map((c) => c.nFiles));
  const gSize = meanStd(commits.map((c) => c.sizeGB));
  const gAvgSize = meanStd(commits.map((c) => Math.log(c.sizeGB / c.nFiles + 1e-6)));
  const gExtUnusual = meanStd(commits.map((c) => unusualExtRatioFor(c)));

  function vectorFor(c) {
    const zf = gFiles.std > 1e-4 ? (c.nFiles - gFiles.mean) / gFiles.std : 0;
    const zs = gSize.std > 1e-4 ? (c.sizeGB - gSize.mean) / gSize.std : 0;
    const za = gAvgSize.std > 1e-4 ? (Math.log(c.sizeGB / c.nFiles + 1e-6) - gAvgSize.mean) / gAvgSize.std : 0;
    const ze = gExtUnusual.std > 1e-4 ? (unusualExtRatioFor(c) - gExtUnusual.mean) / gExtUnusual.std : 0;
    const angle = (c.date.getHours() / 24) * 2 * Math.PI;
    const depotVec = DEPOTS_SEEN.map((d) => (d === c.depot ? 1 : 0));
    const wsVec = WS_SEEN.map((w) => (w === c.workspace ? 1 : 0));
    return [zf, zs, za, ze, Math.sin(angle), Math.cos(angle), ...depotVec, ...wsVec];
  }

  const vectors = commits.map(vectorFor);
  const n = vectors.length;
  const dims = vectors[0].length;
  const centroid = Array(dims).fill(0).map((_, i) => vectors.reduce((s, v) => s + v[i], 0) / n);

  const isoDist = vectors.map((v) => euclidDist(v, centroid));
  const isoStat = meanStd(isoDist);
  const isoThreshold = isoStat.mean + ANOM_ISO_Z_THRESHOLD * isoStat.std;

  const K = Math.min(ANOM_KNN_K, n - 1);
  const kDist = new Array(n);
  const neighborsIdx = new Array(n);
  for (let i = 0; i < n; i++) {
    const vi = vectors[i];
    const topIdx = new Array(K).fill(-1);
    const topDist = new Array(K).fill(Infinity);
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const vj = vectors[j];
      let d2 = 0;
      for (let k = 0; k < dims; k++) { const diff = vi[k] - vj[k]; d2 += diff * diff; }
      const d = Math.sqrt(d2);
      if (d < topDist[K - 1]) {
        let pos = K - 1;
        while (pos > 0 && topDist[pos - 1] > d) {
          topDist[pos] = topDist[pos - 1];
          topIdx[pos] = topIdx[pos - 1];
          pos--;
        }
        topDist[pos] = d;
        topIdx[pos] = j;
      }
    }
    neighborsIdx[i] = topIdx.filter((x) => x >= 0);
    const validDist = topDist.filter((x) => x < Infinity);
    kDist[i] = validDist.length ? validDist.reduce((s, d) => s + d, 0) / validDist.length : 1e-6;
  }
  const lofScore = vectors.map((_, i) => {
    const myDensity = 1 / (kDist[i] || 1e-6);
    const neigh = neighborsIdx[i];
    if (!neigh.length) return 1;
    const avgNeighborDensity = neigh.reduce((s, j) => s + 1 / (kDist[j] || 1e-6), 0) / neigh.length;
    return myDensity > 0 ? avgNeighborDensity / myDensity : 1;
  });

  const results = commits.map((c, idx) => {
    const s = authorStats[c.author];
    const avgSize = c.sizeGB / c.nFiles;
    let hourDiff = Math.abs(c.date.getHours() - s.hour.mean);
    if (hourDiff > 12) hourDiff = 24 - hourDiff;

    const rawFeatures = [
      { key: 'file_count', val: c.nFiles, st: s.file_count, fmt: (v) => Math.round(v).toLocaleString('ru') },
      { key: 'total_size', val: c.sizeGB, st: s.total_size, fmt: (v) => v.toFixed(2) + ' ГБ' },
      { key: 'avg_size', val: avgSize, compareVal: Math.log(avgSize + 1e-6), st: s.avg_size, fmt: (v) => (v * 1000).toFixed(0) + ' МБ' },
      { key: 'hour', val: c.date.getHours(), st: s.hour, distOverride: hourDiff, fmt: (v) => String(Math.round(v)).padStart(2, '0') + ':00' },
      { key: 'ext_unusual', val: unusualExtRatioFor(c), st: s.ext_unusual, fmt: (v) => (v * 100).toFixed(0) + '%' },
    ];
    const features = rawFeatures.map((f) => {
      const compareVal = f.compareVal !== undefined ? f.compareVal : f.val;
      const dist = f.distOverride !== undefined ? f.distOverride : Math.abs(compareVal - f.st.mean);
      const z = f.st.std > 1e-4 ? dist / f.st.std : 0;

      const thMult = f.key === 'ext_unusual' ? 2.4 : 1;
      const iqrActive = f.st.iqr > 1e-6 && (compareVal < f.st.q1 - ANOM_IQR_MULT * thMult * f.st.iqr || compareVal > f.st.q3 + ANOM_IQR_MULT * thMult * f.st.iqr);

      const typical = f.compareVal !== undefined ? Math.exp(f.st.mean) - 1e-6 : f.st.mean;
      return {
        key: f.key, label: ANOM_SIGNAL_LABELS[f.key], actual: f.val, typical, fmt: f.fmt, st: f.st,
        z, zActive: z > ANOM_Z_THRESHOLD * thMult, iqrActive,
        active: z > ANOM_Z_THRESHOLD * thMult || iqrActive,
      };
    });

    const zscoreTriggered = features.some((f) => f.zActive);
    const iqrTriggered = features.some((f) => f.iqrActive);
    const isoTriggered = isoDist[idx] > isoThreshold;
    const lofTriggered = lofScore[idx] > ANOM_LOF_THRESHOLD;

    const zTop = features.slice().sort((a, b) => b.z - a.z)[0];
    const iqrTop = features.filter((f) => f.iqrActive)[0];

    const methods = [
      { key: 'zscore', label: ANOM_METHOD_LABELS.zscore, active: zscoreTriggered, note: zscoreTriggered ? `${zTop.label}: z=${zTop.z.toFixed(1)} (порог ${(ANOM_Z_THRESHOLD * (zTop.key === 'ext_unusual' ? 2.4 : 1)).toFixed(1)})` : 'в пределах нормы' },
      { key: 'iqr', label: ANOM_METHOD_LABELS.iqr, active: iqrTriggered, note: iqrTriggered ? `${iqrTop.label} вне межквартильного размаха` : 'в пределах нормы' },
      { key: 'isoforest', label: ANOM_METHOD_LABELS.isoforest, active: isoTriggered, note: isoTriggered ? `расстояние от центра ${isoDist[idx].toFixed(1)} (обычно ~${isoStat.mean.toFixed(1)})` : 'обычная комбинация признаков' },
      { key: 'lof', label: ANOM_METHOD_LABELS.lof, active: lofTriggered, note: lofTriggered ? `плотность в ${lofScore[idx].toFixed(1)}× реже соседей` : 'плотность как у соседей' },
    ];
    const votes = methods.filter((m) => m.active).length;

    return { commit: c, features, methods, votes, topSignal: zTop };
  }).filter((r) => r.votes >= 2);

  results.sort((a, b) => b.votes - a.votes || b.topSignal.z - a.topSignal.z);
  return results;
}

let anomExpandedCl = null;
let anomChartInst = null;

function toggleAnomalyRow(cl) {
  anomExpandedCl = anomExpandedCl === cl ? null : cl;
  renderAnomalies();
}

window.anomLevel = 'submits';

const ANOM_LEVEL_OPTIONS = [
  { id: 'submits', label: 'Сабмиты' },
  { id: 'users', label: 'Пользователи' },
  { id: 'days', label: 'Дни' },
  { id: 'depots', label: 'Депо' },
  { id: 'workspaces', label: 'Воркспейсы' },
];

function setAnomLevel(level) {
  window.anomLevel = level;
  renderAnomLevelPill();
  document.getElementById('anomSubmitsView').style.display = level === 'submits' ? '' : 'none';
  document.getElementById('anomAggregateView').style.display = level === 'submits' ? 'none' : '';
  renderAnomalies();
}

function renderAnomLevelPill() {
  const container = document.getElementById('anomLevelPill');
  if (!container) return;
  container.innerHTML = renderRadioPill({
    key: 'anomlevel',
    label: 'Уровень',
    options: ANOM_LEVEL_OPTIONS,
    selectedId: window.anomLevel || 'submits',
    onSelectExpr: (id) => `setAnomLevel('${id}')`,
  });
  const state = ensurePopState('anomlevel');
  if (state.open) {
    document.getElementById('pop-anomlevel')?.classList.add('on');
    document.getElementById('btn-anomlevel')?.classList.add('open');
  }
}

function renderAnomalies() {
  const lpWrap = document.getElementById('lpWrap_anomalies');
  if (lpWrap) lpWrap.innerHTML = localPeriodControlHtml('anomalies', 'renderAnomalies');
  if (window.anomLevel === 'submits') renderAnomaliesSubmitsLevel();
  else renderAnomaliesAggregateLevel(window.anomLevel);
}

function renderAnomaliesSubmitsLevel() {
  const all = computeAnomalies();
  const user = document.getElementById('anomUser').value;
  const type = document.getElementById('anomType').value;

  const matched = all.filter((r) => (user === 'all' || r.commit.author === user) && (type === 'all' || r.features.some((f) => f.key === type && f.active)));

  const topNInput = document.getElementById('anomTopNSubmits');
  let maxN = parseInt(topNInput.value, 10);
  if (isNaN(maxN) || maxN < 1) maxN = matched.length ? 1 : 0;
  if (maxN > matched.length) maxN = matched.length;
  topNInput.value = String(maxN);
  if (matched.length > 0) topNInput.max = String(matched.length);

  const filtered = matched.slice(0, maxN);

  document.getElementById('anomCount').textContent = `${filtered.length} из ${all.length}`;

  const authorColor = Object.fromEntries(USERS.map((u) => [u.name, u.color]));
  const fileColor = (n) => (n > 500 ? 'var(--red)' : n > 100 ? 'var(--orange)' : '');

  document.getElementById('anomalyBody').innerHTML = filtered.map((r) => {
    const c = r.commit;
    const isOpen = anomExpandedCl === c.cl;
    const votesColor = r.votes >= 3 ? 'var(--red)' : 'var(--orange)';

    const featureRows = r.features.map((f) => {
      const actualNum = typeof f.actual === 'number' ? f.actual : null;
      const typicalNum = typeof f.typical === 'number' ? f.typical : null;
      let deltaHtml = '';
      if (actualNum !== null && typicalNum !== null && typicalNum > 1e-9) {
        const ratio = actualNum / typicalNum;
        const dir = actualNum >= typicalNum ? 'выше' : 'ниже';
        const times = actualNum >= typicalNum ? ratio : 1 / ratio;
        deltaHtml = times >= 1.15 ? `<span class="anom-detail-delta">×${times.toFixed(1)} ${dir} нормы</span>` : '';
      }
      let extBreakdown = '';
      if (f.key === 'ext_unusual' && f.active) {
        const extFreq = computeAuthorExtFreq()[c.author] || {};
        const counts = {};
        c.files.forEach((file) => { if ((extFreq[file.ext] || 0) < 0.05) counts[file.ext] = (counts[file.ext] || 0) + 1; });
        const chips = Object.entries(counts).sort((a, b) => b[1] - a[1])
          .map(([ext, cnt]) => `<span class="anom-file-chip">.${ext} ×${cnt} <i>у автора обычно ${((extFreq[ext] || 0) * 100).toFixed(0)}%</i></span>`).join('');
        if (chips) extBreakdown = `<div class="anom-ext-breakdown">${chips}</div>`;
      }
      const skewVal = f.st && typeof f.st.skew === 'number' ? f.st.skew : 0;
      const skewHtml = Math.abs(skewVal) > 0.5 ? `<span class="anom-detail-skew" title="Асимметрия распределения этого признака у данного автора">skew ${skewVal.toFixed(1)}</span>` : '';
      const badgesHtml = (deltaHtml || skewHtml) ? `<div class="anom-feat-badges">${deltaHtml}${skewHtml}</div>` : '';
      return `
      <div class="anom-feat-card${f.active ? ' active' : ''}">
        <div class="anom-feat-head">
          <span class="anom-detail-dot" style="background:${f.active ? votesColor : 'var(--border2)'}"></span>
          <span class="anom-feat-name">${f.label}</span>
        </div>
        <div class="anom-feat-values">
          <div class="anom-feat-value"><span class="anom-feat-value-label">Факт</span><span class="anom-feat-value-num">${f.fmt(f.actual)}</span></div>
          <div class="anom-feat-value"><span class="anom-feat-value-label">Обычно</span><span class="anom-feat-value-num">${f.typical === null || f.typical === undefined ? '—' : f.fmt(f.typical)}</span></div>
        </div>
        ${badgesHtml}
        ${extBreakdown}
      </div>`;
    }).join('');

    const methodRows = r.methods.map((m) => `
      <div class="anom-method-row${m.active ? ' active' : ''}">
        <span class="anom-method-dot" style="background:${m.active ? ANOM_METHOD_COLORS[m.key] : 'var(--border2)'}"></span>
        <span class="anom-method-name">${m.label}</span>
        <span class="anom-method-note">${m.note}</span>
      </div>`).join('');

    const filesPreview = c.files.slice(0, 8).map((f) => `<span class="anom-file-chip">${f.path.split('/').pop()} <i>${f.action}</i></span>`).join('');

    return `
    <tr class="anom-row${isOpen ? ' open' : ''}" onclick="toggleAnomalyRow('${c.cl}')" style="cursor:pointer">
      <td style="color:var(--muted)">${c.cl}</td>
      <td style="color:${authorColor[c.author]}">${c.author}</td>
      <td style="${fileColor(c.nFiles) ? 'color:' + fileColor(c.nFiles) : ''}">${c.nFiles.toLocaleString('ru')}</td>
      <td>${c.totalSize}</td>
      <td>${c.date.toLocaleString('ru')}</td>
      <td><span class="badge ${r.votes >= 3 ? 'br' : 'bo'}">${r.topSignal.label} · ${r.votes}/4</span></td>
    </tr>
    ${isOpen ? `<tr class="anom-detail-row"><td colspan="6">
      <div class="anom-detail-cols">
        <div>
          <div class="anom-detail-mini-title">Признаки</div>
          <div class="anom-detail-grid">${featureRows}</div>
        </div>
        <div>
          <div class="anom-detail-mini-title">Методы (согласие ${r.votes}/4)</div>
          <div class="anom-method-grid">${methodRows}</div>
        </div>
      </div>
      <div class="anom-detail-files"><span style="color:var(--muted);font-size:11px">Файлы (первые 8 из ${c.nFiles}):</span> ${filesPreview}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:6px">${c.depot.replace(/^\/\//, '').replace(/\/$/, '')} · ${c.workspace} · «${c.desc}»</div>
    </td></tr>` : ''}`;
  }).join('');

  renderAnomalyChart('submits');
  renderAnomalyBreakdown(all);
  renderAnomalyMethodBreakdown(all);
  renderAnomalyGroupBreakdown(all, anomAllCommits('anomalies'));
  renderTopDifferingFeatures(all);
}

function renderTopDifferingFeatures(allAnomalies) {
  const el = document.getElementById('anomTopDiffFeatures');
  if (!el) return;
  const allCommits = anomAllCommits('anomalies');
  const anomClSet = new Set(allAnomalies.map((r) => r.commit.cl));
  const records = allCommits.map((c) => ({
    file_count: c.nFiles,
    total_size: c.sizeGB,
    avg_size: c.sizeGB / c.nFiles,
    hour: c.date.getHours(),
  }));
  const mask = allCommits.map((c) => anomClSet.has(c.cl));
  const keys = ['file_count', 'total_size', 'avg_size', 'hour'];
  const diffs = alTopDifferingFeatures(records, keys, mask, 4);
  if (!diffs.length) { el.innerHTML = '<div style="color:var(--muted);font-size:12px">Недостаточно данных</div>'; return; }

  const fmt = { file_count: (v) => Math.round(v).toLocaleString('ru'), total_size: (v) => v.toFixed(2) + ' ГБ', avg_size: (v) => (v * 1000).toFixed(0) + ' МБ', hour: (v) => v.toFixed(1) + ' ч' };
  const maxAbs = Math.max(...diffs.map((d) => Math.abs(d.diff)), 1e-6);

  el.innerHTML = diffs.map((d) => {
    const pct = Math.round((Math.abs(d.diff) / maxAbs) * 100);
    const dir = d.diff > 0 ? 'выше' : 'ниже';
    const color = d.diff > 0 ? '#f85149' : '#58a6ff';
    return `<div class="anom-breakdown-row">
      <span class="anom-breakdown-label">${ANOM_SIGNAL_LABELS[d.feature] || d.feature}</span>
      <div class="anom-breakdown-bar"><div class="anom-breakdown-fill" style="width:${pct}%;background:${color}"></div></div>
      <span class="anom-breakdown-pct">${fmt[d.feature](d.anomalyMean)} vs ${fmt[d.feature](d.normalMean)} (${dir})</span>
    </div>`;
  }).join('');
}

function aggregateAnomByUser(commits) {
  const byUser = {};
  commits.forEach((c) => { (byUser[c.author] || (byUser[c.author] = [])).push(c); });
  return Object.entries(byUser).map(([user, list]) => {
    const files = list.map((c) => c.nFiles), sizes = list.map((c) => c.sizeGB);
    const days = new Set(list.map((c) => c.date.toISOString().slice(0, 10)));
    return {
      label: user,
      file_count_mean: alMeanStd(files).mean, file_count_std: alMeanStd(files).std,
      total_size_mean: alMeanStd(sizes).mean, total_size_std: alMeanStd(sizes).std,
      submit_count: list.length, unique_days: days.size,
    };
  });
}

function aggregateAnomByDay(commits) {
  const byDay = {};
  commits.forEach((c) => { const k = c.date.toISOString().slice(0, 10); (byDay[k] || (byDay[k] = [])).push(c); });
  return Object.entries(byDay).map(([day, list]) => {
    const files = list.map((c) => c.nFiles), sizes = list.map((c) => c.sizeGB);
    return {
      label: day,
      file_count_mean: alMeanStd(files).mean, file_count_sum: files.reduce((s, v) => s + v, 0),
      total_size_mean: alMeanStd(sizes).mean, total_size_sum: sizes.reduce((s, v) => s + v, 0),
      unique_users: new Set(list.map((c) => c.author)).size,
    };
  });
}

function aggregateAnomByDepot(commits) {
  const byDepot = {};
  commits.forEach((c) => { (byDepot[c.depot] || (byDepot[c.depot] = [])).push(c); });
  return Object.entries(byDepot).map(([depot, list]) => {
    const files = list.map((c) => c.nFiles), sizes = list.map((c) => c.sizeGB);
    return {
      label: depot.replace(/^\/\//, '').replace(/\/$/, ''),
      file_count_mean: alMeanStd(files).mean, file_count_std: alMeanStd(files).std,
      total_size_mean: alMeanStd(sizes).mean, total_size_sum: sizes.reduce((s, v) => s + v, 0),
      unique_users: new Set(list.map((c) => c.author)).size,
    };
  });
}

function aggregateAnomByWorkspace(commits) {
  const byWs = {};
  commits.forEach((c) => { (byWs[c.workspace] || (byWs[c.workspace] = [])).push(c); });
  return Object.entries(byWs).map(([ws, list]) => {
    const files = list.map((c) => c.nFiles), sizes = list.map((c) => c.sizeGB);
    return {
      label: ws,
      file_count_mean: alMeanStd(files).mean, file_count_std: alMeanStd(files).std,
      total_size_mean: alMeanStd(sizes).mean, total_size_sum: sizes.reduce((s, v) => s + v, 0),
      submit_count: list.length,
    };
  });
}

const ANOM_AGG_KEY_LABELS = {
  file_count_mean: 'Ср. файлов', file_count_std: 'Стд. файлов', file_count_sum: 'Всего файлов',
  total_size_mean: 'Ср. объём, ГБ', total_size_std: 'Стд. объёма', total_size_sum: 'Всего объём, ГБ',
  submit_count: 'Сабмитов', unique_days: 'Активных дней', unique_users: 'Разных авторов',
};
const ANOM_AGG_ENTITY_LABEL = { users: 'Автор', days: 'День', depots: 'Депо', workspaces: 'Воркспейс' };

function anomAggEntityColor(level, label, index) {
  if (level === 'users') {
    const u = USERS.find((x) => x.name === label);
    if (u) return u.color;
  }
  return EXT_PALETTE[index % EXT_PALETTE.length];
}

const ANOM_LEVEL_META = {
  users: { title: 'Аномальные пользователи', aggregate: aggregateAnomByUser, minEntities: 3 },
  days: { title: 'Аномальные дни', aggregate: aggregateAnomByDay, minEntities: 3 },
  depots: { title: 'Аномальные депо', aggregate: aggregateAnomByDepot, minEntities: 3 },
  workspaces: { title: 'Аномальные воркспейсы', aggregate: aggregateAnomByWorkspace, minEntities: 3 },
};

let anomAggExpanded = null;
let anomAggLastNarrowKey = null;

function toggleAnomAggRow(label) {
  anomAggExpanded = anomAggExpanded === label ? null : label;
  renderAnomaliesAggregateLevel(window.anomLevel);
}

function anomAggThresholds(level) {
  if (level === 'days') return { zThreshold: 2.2, iqrMult: 1.8, voteThreshold: 2 };
  return { zThreshold: 1.15, iqrMult: 1, voteThreshold: 1 };
}

function commitsGroupedForLevel(level, commits) {
  const byKey = {};
  const keyOf = level === 'users' ? (c) => c.author
    : level === 'days' ? (c) => c.date.toISOString().slice(0, 10)
    : level === 'depots' ? (c) => c.depot.replace(/^\/\//, '').replace(/\/$/, '')
    : (c) => c.workspace;
  commits.forEach((c) => { const k = keyOf(c); (byKey[k] || (byKey[k] = [])).push(c); });
  return byKey;
}

function renderAnomaliesAggregateLevel(level) {
  const meta = ANOM_LEVEL_META[level];
  document.getElementById('anomAggregateTitle').textContent = meta.title;

  const treeWrap = document.getElementById('ws_anomagg');
  if (treeWrap) treeWrap.style.display = level === 'users' ? 'none' : '';
  document.getElementById('anomAggDepotFilterWrap').style.display = level === 'depots' ? 'none' : '';

  if (level !== 'users') renderAuthorTree('anomagg');
  const authorActive = level === 'users' ? null : (USERS.some((u) => !isAuthorActiveInScope('anomagg', u.name)) ? scopeAuthorActiveSet('anomagg') : null);
  const authorKey = authorActive ? [...authorActive].sort().join(',') : 'all';

  const dp = level === 'depots' ? null : depotPickers['anomagg'];
  const wp = level === 'users' ? null : workspacePickers['anomagg'];
  const depotKey = dp ? [...dp.active].sort().join(',') : 'all';
  const wsKey = wp ? [...wp.active].sort().join(',') : 'all';

  const narrowKey = `${level}|${authorKey}|${depotKey}|${wsKey}`;
  if (narrowKey !== anomAggLastNarrowKey) {
    anomAggLastNarrowKey = narrowKey;
    const typeSelectReset = document.getElementById('anomAggType');
    if (typeSelectReset) typeSelectReset.value = 'all';
  }

  let commits = anomAllCommits('anomalies');
  if (authorActive && authorActive.size < USERS.length) commits = commits.filter((c) => authorActive.has(c.author));
  if (dp && dp.active.size < DEPOTS.length) commits = commits.filter((c) => dp.active.has(c.depot));
  if (wp && wp.active.size < (window.WORKSPACE_LIST || []).length) commits = commits.filter((c) => wp.active.has(c.workspace));

  const records = meta.aggregate(commits);
  const entityLabel = ANOM_AGG_ENTITY_LABEL[level] || 'Сущность';

  document.getElementById('anomDaysRateWrap').style.display = level === 'days' ? '' : 'none';

  if (records.length < meta.minEntities) {
    document.getElementById('anomAggregateCount').textContent = '';
    document.getElementById('anomAggregateHead').innerHTML = '';
    document.getElementById('anomAggregateBody').innerHTML = `<tr><td style="color:var(--muted);padding:14px">Недостаточно сущностей для содержательного сравнения (нужно ≥${meta.minEntities}, сейчас ${records.length}) — в демо-датасете это ожидаемо; механизм заработает полноценно при большем числе реальных сущностей.</td></tr>`;

    const noDataMsg = `<div style="color:var(--muted);padding:10px;font-size:12px">Недостаточно сущностей (нужно ≥${meta.minEntities}, сейчас ${records.length})</div>`;
    ['anomAggCombos', 'anomAggMethods', 'anomAggTopDiff', 'anomDaysRate'].forEach((id) => { const el = document.getElementById(id); if (el) el.innerHTML = noDataMsg; });
    renderAnomalyChart(level);
    return;
  }

  const keys = Object.keys(records[0]).filter((k) => k !== 'label');
  const numericRecords = records.map((r) => { const o = {}; keys.forEach((k) => { o[k] = r[k]; }); return o; });
  const result = alDetectAnomalies(numericRecords, keys, anomAggThresholds(level));

  if (!result) {
    document.getElementById('anomAggregateCount').textContent = '';
    document.getElementById('anomAggregateBody').innerHTML = '<tr><td style="color:var(--muted);padding:14px">Не удалось посчитать</td></tr>';
    return;
  }

  const typeSelect = document.getElementById('anomAggType');
  const prevType = typeSelect.value;
  typeSelect.innerHTML = '<option value="all">Все</option>' + keys.map((k) => `<option value="${k}">${ANOM_AGG_KEY_LABELS[k] || k}</option>`).join('');
  typeSelect.value = keys.includes(prevType) ? prevType : 'all';
  const typeFilter = typeSelect.value;

  document.getElementById('anomAggregateHead').innerHTML = `<tr><th></th><th>${entityLabel}</th>${keys.map((k) => `<th>${ANOM_AGG_KEY_LABELS[k] || k}</th>`).join('')}<th>Методы</th></tr>`;

  const maxByKey = {};
  keys.forEach((k) => { maxByKey[k] = Math.max(1e-9, ...records.map((r) => r[k])); });
  const fmtVal = (k, v) => (k.includes('size') ? v.toFixed(2) : Math.round(v).toLocaleString('ru'));

  const th = anomAggThresholds(level);
  const perRecordFeatures = records.map((r) => keys.map((k) => {
    const st = result.stats[k];
    const z = st.std > 1e-4 ? (r[k] - st.mean) / st.std : 0;
    const iqrActive = st.iqr > 1e-6 && (r[k] < st.q1 - th.iqrMult * st.iqr || r[k] > st.q3 + th.iqrMult * st.iqr);
    return { key: k, label: ANOM_AGG_KEY_LABELS[k] || k, actual: r[k], typical: st.mean, active: Math.abs(z) > th.zThreshold || iqrActive, fmt: (v) => fmtVal(k, v) };
  }));
  const perRecordMethods = result.methodsPerRecord.map((m) => Object.keys(m).map((mk) => ({ key: mk, label: ANOM_METHOD_LABELS[mk], active: m[mk] })));

  const mask = result.votes.map((v) => v >= 1);
  renderAggFeatureCombos(perRecordFeatures, mask);
  renderAggMethodBreakdown(perRecordMethods, mask);
  renderAggTopDiffFeatures(numericRecords, keys, mask);
  if (level === 'days') renderAnomDaysRate(records, mask);

  const commitsByEntity = commitsGroupedForLevel(level, commits);

  const allFlagged = records.map((r, i) => ({ r, idx: i, votes: result.votes[i], methods: result.methodsPerRecord[i], features: perRecordFeatures[i] }))
    .filter((x) => x.votes >= 1)
    .filter((x) => typeFilter === 'all' || x.features.some((f) => f.key === typeFilter && f.active))
    .sort((a, b) => b.votes - a.votes);

  const topNInput = document.getElementById('anomTopNAggregate');
  let maxN = parseInt(topNInput.value, 10);
  if (isNaN(maxN) || maxN < 1) maxN = allFlagged.length ? 1 : 0;
  if (maxN > allFlagged.length) maxN = allFlagged.length;
  topNInput.value = String(maxN);
  if (allFlagged.length > 0) topNInput.max = String(allFlagged.length);

  const rows = allFlagged.slice(0, maxN);
  document.getElementById('anomAggregateCount').textContent = `${rows.length} из ${allFlagged.length} (всего сущностей: ${result.total})`;

  document.getElementById('anomAggregateBody').innerHTML = rows.map(({ r, idx, votes, methods, features }) => {
    const activeMethodLabels = Object.keys(methods).filter((k) => methods[k]).map((k) => ANOM_METHOD_LABELS[k]);
    const votesColor = votes >= 3 ? '#f85149' : '#d29922';
    const dotColor = anomAggEntityColor(level, r.label, idx);
    const isOpen = anomAggExpanded === r.label;
    const cellsHtml = keys.map((k) => {
      const pct = Math.min(100, (r[k] / maxByKey[k]) * 100);
      return `<td>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:44px;height:5px;background:var(--s1);border-radius:3px;overflow:hidden;flex-shrink:0">
            <div style="width:${pct}%;height:100%;background:${votesColor}"></div>
          </div>
          <span style="font-family:var(--mono);font-size:11px">${fmtVal(k, r[k])}</span>
        </div>
      </td>`;
    }).join('');

    const featureRows = features.map((f) => `
      <div class="anom-feat-card${f.active ? ' active' : ''}">
        <div class="anom-feat-head">
          <span class="anom-detail-dot" style="background:${f.active ? votesColor : 'var(--border2)'}"></span>
          <span class="anom-feat-name">${f.label}</span>
        </div>
        <div class="anom-feat-values">
          <div class="anom-feat-value"><span class="anom-feat-value-label">Факт</span><span class="anom-feat-value-num">${f.fmt(f.actual)}</span></div>
          <div class="anom-feat-value"><span class="anom-feat-value-label">Среднее по всем</span><span class="anom-feat-value-num">${f.fmt(f.typical)}</span></div>
        </div>
      </div>`).join('');
    const methodRows = Object.keys(methods).map((mk) => `
      <div class="anom-method-row${methods[mk] ? ' active' : ''}">
        <span class="anom-method-dot" style="background:${methods[mk] ? ANOM_METHOD_COLORS[mk] : 'var(--border2)'}"></span>
        <span class="anom-method-name">${ANOM_METHOD_LABELS[mk]}</span>
      </div>`).join('');

    const entityCommits = commitsByEntity[r.label] || [];
    const fileCounts = {};
    entityCommits.forEach((c) => c.files.forEach((f) => { const name = f.path.split('/').pop(); fileCounts[name] = (fileCounts[name] || 0) + 1; }));
    const topFiles = Object.entries(fileCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const filesPreview = topFiles.map(([name, count]) => `<span class="anom-file-chip">${name} <i>×${count}</i></span>`).join('') || '<span style="color:var(--muted);font-size:11px">Нет данных</span>';

    return `<tr class="anom-row${isOpen ? ' open' : ''}" onclick="toggleAnomAggRow('${r.label.replace(/'/g, "\\'")}')" style="cursor:pointer">
      <td style="color:var(--muted);width:16px">${isOpen ? '▾' : '▸'}</td>
      <td style="font-weight:600"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${dotColor};margin-right:8px"></span>${r.label}</td>
      ${cellsHtml}
      <td><span class="badge ${votes >= 3 ? 'br' : 'bo'}">${activeMethodLabels.join(', ')} · ${votes}/4</span></td>
    </tr>
    ${isOpen ? `<tr class="anom-detail-row"><td colspan="${keys.length + 3}">
      <div class="anom-detail-cols">
        <div>
          <div class="anom-detail-mini-title">Признаки</div>
          <div class="anom-detail-grid">${featureRows}</div>
        </div>
        <div>
          <div class="anom-detail-mini-title">Методы (согласие ${votes}/4)</div>
          <div class="anom-method-grid">${methodRows}</div>
        </div>
      </div>
      <div class="anom-detail-files"><span style="color:var(--muted);font-size:11px">Часто встречающиеся файлы за период (${entityCommits.length} сабмитов):</span> ${filesPreview}</div>
    </td></tr>` : ''}`;
  }).join('') || `<tr><td colspan="${keys.length + 3}" style="color:var(--muted);padding:14px">Аномалий на этом уровне не найдено</td></tr>`;
  renderAnomalyChart(level);
}

window.anomDaysRateBy = 'dow';
function setAnomDaysRateBy(by) {
  window.anomDaysRateBy = by;
  renderAnomalies();
}
function renderAnomDaysRate(records, mask) {
  const el = document.getElementById('anomDaysRate');
  if (!el) return;
  const by = window.anomDaysRateBy || 'dow';
  const DOW_RU = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const MONTH_RU = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
  const labels = by === 'dow' ? DOW_RU : MONTH_RU;
  const total = Array(labels.length).fill(0);
  const anom = Array(labels.length).fill(0);
  records.forEach((r, i) => {
    const d = new Date(r.label);
    const idx = by === 'dow' ? d.getDay() : d.getMonth();
    total[idx]++;
    if (mask[i]) anom[idx]++;
  });
  el.innerHTML = labels.map((lab, i) => {
    const rate = total[i] ? (anom[i] / total[i]) * 100 : 0;
    return `<div class="anom-breakdown-row">
      <span class="anom-breakdown-label">${lab}</span>
      <div class="anom-breakdown-bar"><div class="anom-breakdown-fill" style="width:${Math.min(100, rate)}%;background:#d29922"></div></div>
      <span class="anom-breakdown-pct">${rate.toFixed(0)}% (${anom[i]}/${total[i]})</span>
    </div>`;
  }).join('');
}

function renderAggFeatureCombos(perRecordFeatures, mask) {
  const el = document.getElementById('anomAggCombos');
  if (!el) return;
  const total = mask.filter(Boolean).length || 1;
  const combos = {};
  perRecordFeatures.forEach((feats, i) => {
    if (!mask[i]) return;
    const activeLabels = feats.filter((f) => f.active).map((f) => f.label).sort();
    const key = activeLabels.length ? activeLabels.join(' + ') : '(ни один по отдельности)';
    combos[key] = (combos[key] || 0) + 1;
  });
  const sorted = Object.entries(combos).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxV = sorted.length ? sorted[0][1] : 1;
  el.innerHTML = sorted.map(([combo, count]) => {
    const pct = Math.round((count / total) * 100);
    const barPct = Math.round((count / maxV) * 100);
    return `<div class="anom-breakdown-row">
      <span class="anom-breakdown-label anom-breakdown-label--wide">${combo}</span>
      <div class="anom-breakdown-bar"><div class="anom-breakdown-fill" style="width:${barPct}%;background:#bc8cff"></div></div>
      <span class="anom-breakdown-pct">${count} (${pct}%)</span>
    </div>`;
  }).join('') || '<div style="color:var(--muted);font-size:12px">Нет данных</div>';
}

function renderAggMethodBreakdown(perRecordMethods, mask) {
  const el = document.getElementById('anomAggMethods');
  if (!el) return;
  const total = mask.filter(Boolean).length || 1;
  const pairCounts = {};
  let strong = 0, borderline = 0;
  perRecordMethods.forEach((methods, i) => {
    if (!mask[i]) return;
    const votes = methods.filter((m) => m.active).length;
    if (votes >= 3) strong++; else borderline++;
    const activeLabels = methods.filter((m) => m.active).map((m) => m.label).sort();
    for (let a = 0; a < activeLabels.length; a++) {
      for (let b = a + 1; b < activeLabels.length; b++) {
        const key = `${activeLabels[a]} + ${activeLabels[b]}`;
        pairCounts[key] = (pairCounts[key] || 0) + 1;
      }
    }
  });
  const sortedPairs = Object.entries(pairCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxV = sortedPairs.length ? sortedPairs[0][1] : 1;
  const summaryHtml = `<div class="anom-method-summary">
    <span><b style="color:var(--red)">${strong}</b> подтверждены 3-4 методами</span>
    <span><b style="color:var(--orange)">${borderline}</b> пограничные (ровно 1-2)</span>
  </div>`;
  const pairsHtml = sortedPairs.map(([pair, count]) => {
    const pct = Math.round((count / total) * 100);
    const barPct = Math.round((count / maxV) * 100);
    return `<div class="anom-breakdown-row">
      <span class="anom-breakdown-label anom-breakdown-label--wide">${pair}</span>
      <div class="anom-breakdown-bar"><div class="anom-breakdown-fill" style="width:${barPct}%;background:#58a6ff"></div></div>
      <span class="anom-breakdown-pct">${count} (${pct}%)</span>
    </div>`;
  }).join('') || '<div style="color:var(--muted);font-size:12px">Нет пар — совпадений по 2+ методам не найдено</div>';
  el.innerHTML = summaryHtml + pairsHtml;
}

function renderAggTopDiffFeatures(numericRecords, keys, mask) {
  const el = document.getElementById('anomAggTopDiff');
  if (!el) return;
  const diffs = alTopDifferingFeatures(numericRecords, keys, mask, 5);
  if (!diffs.length) { el.innerHTML = '<div style="color:var(--muted);font-size:12px">Недостаточно данных</div>'; return; }
  const fmt = (k, v) => (k.includes('size') ? v.toFixed(2) : Math.round(v).toLocaleString('ru'));
  const maxAbs = Math.max(...diffs.map((d) => Math.abs(d.diff)), 1e-6);
  el.innerHTML = diffs.map((d) => {
    const pct = Math.round((Math.abs(d.diff) / maxAbs) * 100);
    const dir = d.diff > 0 ? 'выше' : 'ниже';
    const color = d.diff > 0 ? '#f85149' : '#58a6ff';
    return `<div class="anom-breakdown-row">
      <span class="anom-breakdown-label">${ANOM_AGG_KEY_LABELS[d.feature] || d.feature}</span>
      <div class="anom-breakdown-bar"><div class="anom-breakdown-fill" style="width:${pct}%;background:${color}"></div></div>
      <span class="anom-breakdown-pct">${fmt(d.feature, d.anomalyMean)} vs ${fmt(d.feature, d.normalMean)} (${dir})</span>
    </div>`;
  }).join('');
}

window.anomChartMetric = 'total_size';
const ANOM_METRIC_META = {
  total_size: { label: 'Объём, ГБ', fmt: (v) => v.toFixed(2) },
  file_count: { label: 'Файлов', fmt: (v) => Math.round(v).toLocaleString('ru') },
  submit_count: { label: 'Сабмитов', fmt: (v) => Math.round(v).toLocaleString('ru') },
  avg_size: { label: 'Средний размер файла, МБ', fmt: (v) => v.toFixed(0) },
};

function setAnomChartMetric(m) {
  window.anomChartMetric = m;
  renderAnomalies();
}

function anomMetricPerCommit(c, metric) {
  if (metric === 'total_size') return c.sizeGB;
  if (metric === 'file_count') return c.nFiles;
  if (metric === 'avg_size') return (c.sizeGB / c.nFiles) * 1000;
  return 1;
}

let anomChartLastKey = null;

function renderAnomalyChart(level) {
  const canvas = document.getElementById('anomChart');
  if (!canvas || typeof Chart === 'undefined') return;
  const metric = window.anomChartMetric || 'total_size';
  const metricMeta = ANOM_METRIC_META[metric];

  let authorSet;
  if (level === 'submits') {
    const v = document.getElementById('anomUser').value;
    authorSet = v === 'all' ? null : new Set([v]);
  } else if (level === 'users') {
    authorSet = null;
  } else {
    const activeSet = scopeAuthorActiveSet('anomagg');
    authorSet = activeSet && activeSet.size < USERS.length ? new Set(activeSet) : null;
  }
  const dp = (level !== 'submits' && level !== 'depots') ? depotPickers['anomagg'] : null;
  const wp = (level !== 'submits' && level !== 'users') ? workspacePickers['anomagg'] : null;
  const authorKey = authorSet ? [...authorSet].sort().join(',') : 'all';
  const depotKey = dp ? [...dp.active].sort().join(',') : 'all';
  const wsKey = wp ? [...wp.active].sort().join(',') : 'all';

  const key = `${level}|${metric}|${authorKey}|${depotKey}|${wsKey}`;
  if (key === anomChartLastKey && anomChartInst) return;
  anomChartLastKey = key;

  if (level === 'submits' || level === 'days') {
    renderAnomalyChartTimeSeries(canvas, level, metric, metricMeta, authorSet);
  } else {
    renderAnomalyChartByEntity(canvas, level, metric, metricMeta, authorSet);
  }
}

function renderAnomalyChartTimeSeries(canvas, level, metric, metricMeta, authorFilter) {
  const authorSuffix = authorFilter ? ` · ${[...authorFilter].join(', ')}` : '';
  document.getElementById('anomChartTitle').textContent = `${metricMeta.label} по дням${authorSuffix} — коридор нормы (±2σ) и аномальные дни`;

  const dp = level !== 'submits' ? depotPickers['anomagg'] : null;
  const wp = level !== 'submits' ? workspacePickers['anomagg'] : null;
  const commitMatches = (c) => {
    if (authorFilter && !authorFilter.has(c.author)) return false;
    if (dp && dp.active.size < DEPOTS.length && !dp.active.has(c.depot)) return false;
    if (wp && wp.active.size < (window.WORKSPACE_LIST || []).length && !wp.active.has(c.workspace)) return false;
    return true;
  };

  const dailyVal = DAY_DATA.map((day) => {
    let val = 0, count = 0;
    USERS.forEach((u) => {
      const pu = day.perUser[u.name];
      if (pu && pu.commits) pu.commits.forEach((c) => { if (commitMatches(c)) { val += anomMetricPerCommit(c, metric); count++; } });
    });
    if (metric === 'avg_size' && count > 0) val = val / count;
    return { date: day.date, val };
  });

  const { mean, std } = alMeanStd(dailyVal.map((d) => d.val));
  const upper = mean + 2 * std;
  const lower = Math.max(0, mean - 2 * std);

  let anomalousDaySet;
  if (level === 'submits') {
    const src = authorFilter ? computeAnomalies().filter((r) => authorFilter.has(r.commit.author)) : computeAnomalies();
    anomalousDaySet = new Set(src.map((r) => r.commit.date.toISOString().slice(0, 10)));
  } else {
    const commits = anomAllCommits('anomalies').filter(commitMatches);
    const records = aggregateAnomByDay(commits);
    const keys = Object.keys(records[0] || {}).filter((k) => k !== 'label');
    const numericRecords = records.map((r) => { const o = {}; keys.forEach((k) => { o[k] = r[k]; }); return o; });
    const result = keys.length ? alDetectAnomalies(numericRecords, keys, anomAggThresholds(level)) : null;
    anomalousDaySet = new Set(result ? records.filter((_, i) => result.votes[i] >= 1).map((r) => r.label) : []);
  }

  const labels = dailyVal.map((d) => d.date.toLocaleDateString('ru', { day: '2-digit', month: '2-digit' }));
  const anomPoints = dailyVal.map((d) => (anomalousDaySet.has(d.date.toISOString().slice(0, 10)) ? d.val : null));

  if (anomChartInst) anomChartInst.destroy();
  anomChartInst = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Верхняя граница нормы',
          data: dailyVal.map(() => upper),
          borderColor: 'transparent',
          backgroundColor: 'rgba(88,166,255,0.08)',
          fill: '+1',
          pointRadius: 0,
          borderWidth: 0,
        },
        {
          label: 'Нижняя граница нормы',
          data: dailyVal.map(() => lower),
          borderColor: 'transparent',
          backgroundColor: 'rgba(88,166,255,0.08)',
          fill: false,
          pointRadius: 0,
          borderWidth: 0,
        },
        {
          label: metricMeta.label,
          data: dailyVal.map((d) => +d.val.toFixed(3)),
          borderColor: '#58a6ff',
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.25,
        },
        {
          label: 'Аномальный день',
          data: anomPoints,
          type: 'scatter',
          borderColor: '#f85149',
          backgroundColor: '#f85149',
          pointRadius: 4,
          pointHoverRadius: 6,
          showLine: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          filter: (item) => item.dataset.label !== 'Верхняя граница нормы' && item.dataset.label !== 'Нижняя граница нормы',
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: themeColor('muted'), maxTicksLimit: 12, autoSkip: true } },
        y: { grid: { color: themeColor('border') }, ticks: { color: themeColor('muted') }, title: { display: true, text: metricMeta.label, font: { size: 10 }, color: themeColor('muted') } },
      },
    },
  });
}

function renderAnomalyChartByEntity(canvas, level, metric, metricMeta, authorFilter) {
  const entityLabel = ANOM_AGG_ENTITY_LABEL[level] || 'Сущность';
  const authorSuffix = authorFilter ? ` · ${[...authorFilter].join(', ')}` : '';
  document.getElementById('anomChartTitle').textContent = `${metricMeta.label} по «${entityLabel.toLowerCase()}»${authorSuffix} — аномальные выделены красным`;

  let commits = anomAllCommits('anomalies');
  if (authorFilter) commits = commits.filter((c) => authorFilter.has(c.author));
  const dp = level !== 'depots' ? depotPickers['anomagg'] : null;
  const wp = level !== 'users' ? workspacePickers['anomagg'] : null;
  if (dp && dp.active.size < DEPOTS.length) commits = commits.filter((c) => dp.active.has(c.depot));
  if (wp && wp.active.size < (window.WORKSPACE_LIST || []).length) commits = commits.filter((c) => wp.active.has(c.workspace));
  const aggregateFn = { users: aggregateAnomByUser, depots: aggregateAnomByDepot, workspaces: aggregateAnomByWorkspace }[level];
  const records = aggregateFn ? aggregateFn(commits) : [];

  if (records.length < 3) {
    if (anomChartInst) { anomChartInst.destroy(); anomChartInst = null; }
    return;
  }

  const keys = Object.keys(records[0]).filter((k) => k !== 'label');
  const numericRecords = records.map((r) => { const o = {}; keys.forEach((k) => { o[k] = r[k]; }); return o; });
  const result = alDetectAnomalies(numericRecords, keys, anomAggThresholds(level));
  const anomalousSet = new Set(result ? records.filter((_, i) => result.votes[i] >= 1).map((r) => r.label) : []);

  const valueByEntity = {};
  const countByEntity = {};
  records.forEach((r) => { valueByEntity[r.label] = 0; countByEntity[r.label] = 0; });
  commits.forEach((c) => {
    const key = level === 'users' ? c.author : level === 'depots' ? c.depot.replace(/^\/\//, '').replace(/\/$/, '') : c.workspace;
    if (valueByEntity[key] === undefined) return;
    valueByEntity[key] += anomMetricPerCommit(c, metric);
    countByEntity[key]++;
  });
  if (metric === 'avg_size') {
    Object.keys(valueByEntity).forEach((k) => { if (countByEntity[k] > 0) valueByEntity[k] = valueByEntity[k] / countByEntity[k]; });
  }

  const labels = records.map((r) => r.label);
  const values = records.map((r) => +valueByEntity[r.label].toFixed(3));
  const colors = records.map((r) => (anomalousSet.has(r.label) ? '#f85149' : '#58a6ff'));

  if (anomChartInst) anomChartInst.destroy();
  anomChartInst = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: metricMeta.label,
        data: values,
        backgroundColor: colors.map((c) => c + '99'),
        borderColor: colors,
        borderWidth: 1.5,
        borderRadius: 3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: themeColor('muted'), maxRotation: 30, minRotation: 0 } },
        y: { grid: { color: themeColor('border') }, ticks: { color: themeColor('muted') }, title: { display: true, text: metricMeta.label, font: { size: 10 }, color: themeColor('muted') } },
      },
    },
  });
}

window.anomGroupBy = 'authors';

function setAnomGroupBy(id) {
  window.anomGroupBy = id;
  renderAnomGroupByPill();
  renderAnomalies();
}

function renderAnomGroupByPill() {
  const container = document.getElementById('anomGroupByPill');
  if (!container) return;
  container.innerHTML = renderRadioPill({
    key: 'anomgroupby',
    label: 'Группировать по',
    options: CHART_GROUP_BY_OPTIONS,
    selectedId: window.anomGroupBy,
    onSelectExpr: (id) => `setAnomGroupBy('${id}')`,
  });
  const state = ensurePopState('anomgroupby');
  if (state.open) {
    document.getElementById('pop-anomgroupby')?.classList.add('on');
    document.getElementById('btn-anomgroupby')?.classList.add('open');
  }
}

function renderAnomalyGroupBreakdown(allAnomalies, allCommits) {
  const el = document.getElementById('anomGroupBreakdown');
  if (!el) return;
  const groupBy = window.anomGroupBy || 'authors';

  let keys, keyOf, colorOf, labelOf;
  if (groupBy === 'workspaces') {
    keys = [...new Set(allCommits.map((c) => c.workspace))];
    keyOf = (c) => c.workspace;
    colorOf = (k) => (typeof getWorkspaceColor === 'function' ? getWorkspaceColor(k) : themeColor('muted'));
    labelOf = (k) => k;
  } else if (groupBy === 'depot') {
    keys = [...new Set(allCommits.map((c) => c.depot))];
    keyOf = (c) => c.depot;
    colorOf = (k) => (typeof getDepotColor === 'function' ? getDepotColor(k) : themeColor('muted'));
    labelOf = (k) => k.replace(/^\/\//, '').replace(/\/$/, '');
  } else {
    keys = USERS.map((u) => u.name);
    keyOf = (c) => c.author;
    colorOf = (k) => (USERS.find((u) => u.name === k) || {}).color || themeColor('muted');
    labelOf = (k) => k;
  }

  const totalByKey = {}, anomByKey = {};
  keys.forEach((k) => { totalByKey[k] = 0; anomByKey[k] = 0; });
  allCommits.forEach((c) => { const k = keyOf(c); if (totalByKey[k] !== undefined) totalByKey[k]++; });
  allAnomalies.forEach((r) => { const k = keyOf(r.commit); if (anomByKey[k] !== undefined) anomByKey[k]++; });

  const rows = keys.map((k) => ({ k, rate: totalByKey[k] ? (anomByKey[k] / totalByKey[k]) * 100 : 0, count: anomByKey[k], total: totalByKey[k] }))
    .sort((a, b) => b.rate - a.rate);
  const maxRate = Math.max(0.01, ...rows.map((r) => r.rate));

  el.innerHTML = rows.map((r) => `
    <div class="anom-breakdown-row">
      <span class="anom-breakdown-label"><span class="dot" style="background:${colorOf(r.k)}"></span>${labelOf(r.k)}</span>
      <div class="anom-breakdown-bar"><div class="anom-breakdown-fill" style="width:${Math.round((r.rate / maxRate) * 100)}%;background:${colorOf(r.k)}"></div></div>
      <span class="anom-breakdown-pct">${r.rate.toFixed(1)}% (${r.count}/${r.total})</span>
    </div>`).join('') || '<div style="color:var(--muted);font-size:12px">Нет данных</div>';
}

function renderAnomalyBreakdown(allAnomalies) {
  const el = document.getElementById('anomBreakdown');
  if (!el) return;
  const total = allAnomalies.length || 1;
  const combos = {};
  allAnomalies.forEach((r) => {
    const activeLabels = r.features.filter((f) => f.active).map((f) => f.label).sort();
    const key = activeLabels.length ? activeLabels.join(' + ') : '(ни один по отдельности)';
    combos[key] = (combos[key] || 0) + 1;
  });
  const sorted = Object.entries(combos).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxV = sorted.length ? sorted[0][1] : 1;

  el.innerHTML = sorted.map(([combo, count]) => {
    const pct = Math.round((count / total) * 100);
    const barPct = Math.round((count / maxV) * 100);
    return `<div class="anom-breakdown-row">
      <span class="anom-breakdown-label anom-breakdown-label--wide">${combo}</span>
      <div class="anom-breakdown-bar"><div class="anom-breakdown-fill" style="width:${barPct}%;background:#bc8cff"></div></div>
      <span class="anom-breakdown-pct">${count} (${pct}%)</span>
    </div>`;
  }).join('') || '<div style="color:var(--muted);font-size:12px">Нет данных</div>';
}

function renderAnomalyMethodBreakdown(allAnomalies) {
  const el = document.getElementById('anomMethodBreakdown');
  if (!el) return;
  const total = allAnomalies.length || 1;

  const pairCounts = {};
  let strong = 0;
  let borderline = 0;
  allAnomalies.forEach((r) => {
    if (r.votes >= 3) strong++; else borderline++;
    const activeLabels = r.methods.filter((m) => m.active).map((m) => m.label).sort();
    for (let i = 0; i < activeLabels.length; i++) {
      for (let j = i + 1; j < activeLabels.length; j++) {
        const key = `${activeLabels[i]} + ${activeLabels[j]}`;
        pairCounts[key] = (pairCounts[key] || 0) + 1;
      }
    }
  });
  const sortedPairs = Object.entries(pairCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxV = sortedPairs.length ? sortedPairs[0][1] : 1;

  const summaryHtml = `<div class="anom-method-summary">
    <span><b style="color:var(--red)">${strong}</b> подтверждены 3-4 методами</span>
    <span><b style="color:var(--orange)">${borderline}</b> пограничные (ровно 2)</span>
  </div>`;

  const pairsHtml = sortedPairs.map(([pair, count]) => {
    const pct = Math.round((count / total) * 100);
    const barPct = Math.round((count / maxV) * 100);
    return `<div class="anom-breakdown-row">
      <span class="anom-breakdown-label anom-breakdown-label--wide">${pair}</span>
      <div class="anom-breakdown-bar"><div class="anom-breakdown-fill" style="width:${barPct}%;background:#58a6ff"></div></div>
      <span class="anom-breakdown-pct">${count} (${pct}%)</span>
    </div>`;
  }).join('') || '<div style="color:var(--muted);font-size:12px">Нет пар — все аномалии либо уникальны, либо одиночны</div>';

  el.innerHTML = summaryHtml + pairsHtml;
}

if (document.getElementById('anomGroupByPill')) renderAnomGroupByPill();
