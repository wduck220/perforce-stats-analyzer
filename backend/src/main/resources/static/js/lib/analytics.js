

function alMeanStd(arr) {
  if (!arr.length) return { mean: 0, std: 0 };
  const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
  const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
  return { mean, std: Math.sqrt(variance) };
}

function alQuantile(sortedArr, q) {
  if (!sortedArr.length) return 0;
  const idx = Math.min(sortedArr.length - 1, Math.floor(q * sortedArr.length));
  return sortedArr[idx];
}

function alStatsFor(arr) {
  const { mean, std } = alMeanStd(arr);
  const sorted = arr.slice().sort((a, b) => a - b);
  const q1 = alQuantile(sorted, 0.25), q3 = alQuantile(sorted, 0.75);
  return { mean, std, q1, q3, iqr: q3 - q1, min: sorted[0] ?? 0, max: sorted[sorted.length - 1] ?? 0 };
}

function alFullStats(arr) {
  const base = alStatsFor(arr);
  const sorted = arr.slice().sort((a, b) => a - b);
  const median = alQuantile(sorted, 0.5);
  const n = arr.length;
  const { mean, std } = base;
  let skew = 0, kurtosis = 0;
  if (n > 0 && std > 1e-9) {
    const m3 = arr.reduce((s, v) => s + (v - mean) ** 3, 0) / n;
    const m4 = arr.reduce((s, v) => s + (v - mean) ** 4, 0) / n;
    skew = m3 / std ** 3;
    kurtosis = m4 / std ** 4 - 3;
  }
  const cvPct = mean !== 0 ? (std / Math.abs(mean)) * 100 : 0;
  return { ...base, median, skew, kurtosis, cvPct, n };
}

function alPearson(x, y) {
  const n = x.length;
  if (n < 3) return { r: 0, p: 1 };
  const mx = alMeanStd(x).mean, my = alMeanStd(y).mean;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx, dy = y[i] - my;
    num += dx * dy; dx2 += dx * dx; dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  const r = denom > 1e-12 ? num / denom : 0;

  const t = Math.abs(r) * Math.sqrt((n - 2) / Math.max(1e-9, 1 - r * r));
  const p = alTDistPValue(t, n - 2);
  return { r, p };
}

function alSpearman(x, y) {
  const rank = (arr) => {
    const idx = arr.map((v, i) => i).sort((a, b) => arr[a] - arr[b]);
    const ranks = new Array(arr.length);
    idx.forEach((origIdx, rankPos) => { ranks[origIdx] = rankPos; });
    return ranks;
  };
  return alPearson(rank(x), rank(y));
}

function alTDistPValue(t, df) {
  if (df <= 0) return 1;

  const x = df / (df + t * t);
  let p = alIncompleteBeta(x, df / 2, 0.5);
  return Math.max(0, Math.min(1, p));
}

function alIncompleteBeta(x, a, b) {

  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(alLogGamma(a + b) - alLogGamma(a) - alLogGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return bt * alBetaCF(x, a, b) / a;
  return 1 - bt * alBetaCF(1 - x, b, a) / b;
}

function alBetaCF(x, a, b) {
  const MAXIT = 100, EPS = 3e-7;
  let qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d; const del = d * c; h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

function alLogGamma(x) {
  const cof = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) { y += 1; ser += cof[j] / y; }
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

function alCramersV(catX, catY) {
  const n = catX.length;
  const xVals = [...new Set(catX)], yVals = [...new Set(catY)];
  if (xVals.length < 2 || yVals.length < 2 || n === 0) return NaN;
  const table = {};
  xVals.forEach((xv) => { table[xv] = {}; yVals.forEach((yv) => { table[xv][yv] = 0; }); });
  for (let i = 0; i < n; i++) table[catX[i]][catY[i]]++;
  const rowTotals = {}, colTotals = {};
  xVals.forEach((xv) => { rowTotals[xv] = yVals.reduce((s, yv) => s + table[xv][yv], 0); });
  yVals.forEach((yv) => { colTotals[yv] = xVals.reduce((s, xv) => s + table[xv][yv], 0); });

  let chi2 = 0;
  xVals.forEach((xv) => {
    yVals.forEach((yv) => {
      const expected = (rowTotals[xv] * colTotals[yv]) / n;
      if (expected > 0) chi2 += (table[xv][yv] - expected) ** 2 / expected;
    });
  });
  const phi2 = chi2 / n;
  const r = xVals.length, k = yVals.length;
  const phi2corr = Math.max(0, phi2 - ((k - 1) * (r - 1)) / (n - 1));
  const rcorr = r - ((r - 1) ** 2) / (n - 1);
  const kcorr = k - ((k - 1) ** 2) / (n - 1);
  const denom = Math.min(kcorr - 1, rcorr - 1);
  return denom > 0 ? Math.sqrt(phi2corr / denom) : NaN;
}

function alKMeans(points, kRange) {
  kRange = kRange || [2, 3, 4, 5, 6];
  if (points.length < 3) return null;
  const dims = points[0].length;

  function distSq(a, b) { let s = 0; for (let i = 0; i < dims; i++) s += (a[i] - b[i]) ** 2; return s; }

  function runOnce(k, seed) {
    let centers = points.slice(0, k).map((p) => p.slice());

    const usedIdx = new Set();
    centers = [];
    for (let i = 0; i < k; i++) {
      let idx;
      let attempt = 0;

      do {
        idx = Math.floor(alSeededRandom(seed + i * 97 + attempt * 131) * points.length);
        attempt++;
      } while (usedIdx.has(idx) && usedIdx.size < points.length && attempt < points.length + 10);
      usedIdx.add(idx);
      centers.push(points[idx].slice());
    }
    let labels = new Array(points.length).fill(0);
    for (let iter = 0; iter < 50; iter++) {
      let changed = false;
      for (let i = 0; i < points.length; i++) {
        let best = 0, bestD = Infinity;
        for (let c = 0; c < k; c++) {
          const d = distSq(points[i], centers[c]);
          if (d < bestD) { bestD = d; best = c; }
        }
        if (labels[i] !== best) { changed = true; labels[i] = best; }
      }
      const sums = Array.from({ length: k }, () => Array(dims).fill(0));
      const counts = Array(k).fill(0);
      for (let i = 0; i < points.length; i++) {
        counts[labels[i]]++;
        for (let d = 0; d < dims; d++) sums[labels[i]][d] += points[i][d];
      }
      for (let c = 0; c < k; c++) {
        if (counts[c] > 0) centers[c] = sums[c].map((s) => s / counts[c]);
      }
      if (!changed) break;
    }
    return { labels, centers };
  }

  function silhouette(labels, k) {
    const n = points.length;
    if (k < 2) return -1;
    const SAMPLE_CAP = 200;
    const sampleIdx = n <= SAMPLE_CAP ? Array.from({ length: n }, (_, i) => i)
      : Array.from({ length: SAMPLE_CAP }, (_, i) => Math.floor(alSeededRandom(i * 13 + 1) * n));
    let total = 0, counted = 0;
    sampleIdx.forEach((i) => {
      const own = labels[i];
      let aSum = 0, aCount = 0;
      const bSumByCluster = {};
      const bCountByCluster = {};
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const d = Math.sqrt(distSq(points[i], points[j]));
        if (labels[j] === own) { aSum += d; aCount++; }
        else {
          bSumByCluster[labels[j]] = (bSumByCluster[labels[j]] || 0) + d;
          bCountByCluster[labels[j]] = (bCountByCluster[labels[j]] || 0) + 1;
        }
      }
      const a = aCount ? aSum / aCount : 0;
      const bVals = Object.keys(bSumByCluster).map((c) => bSumByCluster[c] / bCountByCluster[c]);
      if (!bVals.length) return;
      const b = Math.min(...bVals);
      const s = Math.max(a, b) > 0 ? (b - a) / Math.max(a, b) : 0;
      total += s; counted++;
    });
    return counted ? total / counted : -1;
  }

  let best = null;
  kRange.filter((k) => k <= points.length - 1).forEach((k) => {
    const { labels, centers } = runOnce(k, k * 97);
    const distinctClusters = new Set(labels).size;
    if (distinctClusters < 2) return;
    const sil = silhouette(labels, k);
    if (!best || sil > best.silhouette) best = { k, labels, centers, silhouette: sil };
  });
  return best;
}

function alSeededRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function alDetectAnomalies(records, keys, opts) {
  opts = opts || {};
  const zThreshold = opts.zThreshold || 3;
  const iqrMult = opts.iqrMult || 1.5;
  const voteThreshold = opts.voteThreshold || 2;
  if (records.length < 3 || !keys.length) return null;

  const stats = {};
  keys.forEach((k) => { stats[k] = alStatsFor(records.map((r) => r[k])); });

  const zActive = records.map((r) => keys.map((k) => stats[k].std > 1e-6 && Math.abs((r[k] - stats[k].mean) / stats[k].std) > zThreshold));
  const iqrActive = records.map((r) => keys.map((k) => stats[k].iqr > 1e-6 && (r[k] < stats[k].q1 - iqrMult * stats[k].iqr || r[k] > stats[k].q3 + iqrMult * stats[k].iqr)));

  const vectors = records.map((r) => keys.map((k) => (stats[k].std > 1e-6 ? (r[k] - stats[k].mean) / stats[k].std : 0)));
  const n = vectors.length;
  const dims = keys.length;
  const centroid = Array(dims).fill(0).map((_, i) => vectors.reduce((s, v) => s + v[i], 0) / n);
  const isoDist = vectors.map((v) => Math.sqrt(v.reduce((s, x, i) => s + (x - centroid[i]) ** 2, 0)));
  const isoStat = alMeanStd(isoDist);
  const isoActive = isoDist.map((d) => d > isoStat.mean + 2 * isoStat.std);

  const K = Math.min(10, n - 1);
  const lofActive = new Array(n).fill(false);
  if (K >= 1) {
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
        for (let d = 0; d < dims; d++) { const diff = vi[d] - vj[d]; d2 += diff * diff; }
        const dist = Math.sqrt(d2);
        if (dist < topDist[K - 1]) {
          let pos = K - 1;
          while (pos > 0 && topDist[pos - 1] > dist) { topDist[pos] = topDist[pos - 1]; topIdx[pos] = topIdx[pos - 1]; pos--; }
          topDist[pos] = dist; topIdx[pos] = j;
        }
      }
      neighborsIdx[i] = topIdx.filter((x) => x >= 0);
      const valid = topDist.filter((x) => x < Infinity);
      kDist[i] = valid.length ? valid.reduce((s, d) => s + d, 0) / valid.length : 1e-6;
    }
    for (let i = 0; i < n; i++) {
      const myDensity = 1 / (kDist[i] || 1e-6);
      const neigh = neighborsIdx[i];
      if (!neigh.length) continue;
      const avgNeighborDensity = neigh.reduce((s, j) => s + 1 / (kDist[j] || 1e-6), 0) / neigh.length;
      lofActive[i] = myDensity > 0 && avgNeighborDensity / myDensity > 1.5;
    }
  }

  const methodsPerRecord = records.map((_, i) => ({
    zscore: keys.some((_, ki) => zActive[i][ki]),
    iqr: keys.some((_, ki) => iqrActive[i][ki]),
    isoforest: isoActive[i],
    lof: lofActive[i],
  }));
  const votes = methodsPerRecord.map((m) => Object.values(m).filter(Boolean).length);
  const mask = votes.map((v) => v >= voteThreshold);

  const perMethodCount = { zscore: 0, iqr: 0, isoforest: 0, lof: 0 };
  methodsPerRecord.forEach((m, i) => { if (mask[i]) Object.keys(m).forEach((k) => { if (m[k]) perMethodCount[k]++; }); });

  return { mask, votes, methodsPerRecord, stats, keys, perMethodCount, total: n, anomalyCount: mask.filter(Boolean).length };
}

function alTopDifferingFeatures(records, keys, mask, topN) {
  topN = topN || 10;
  const anomRecords = records.filter((_, i) => mask[i]);
  const normRecords = records.filter((_, i) => !mask[i]);
  if (!anomRecords.length || !normRecords.length) return [];
  const diffs = keys.map((k) => {
    const meanAnom = alMeanStd(anomRecords.map((r) => r[k])).mean;
    const meanNorm = alMeanStd(normRecords.map((r) => r[k])).mean;
    return { feature: k, anomalyMean: meanAnom, normalMean: meanNorm, diff: meanAnom - meanNorm };
  });
  return diffs.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, topN);
}
