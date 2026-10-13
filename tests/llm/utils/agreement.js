// Agreement statistics for comparing LLM-judge scores against human labels.
// Pure functions, no API calls.

export function ranks(xs) {
  const idx = xs.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(xs.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avg = (i + j) / 2 + 1; // ties share the average rank
    for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
    i = j + 1;
  }
  return r;
}

export function pearson(a, b) {
  const n = a.length;
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da === 0 || db === 0 ? NaN : num / Math.sqrt(da * db);
}

export const spearman = (a, b) => pearson(ranks(a), ranks(b));

// Quadratic-weighted Cohen's kappa for ordinal scores in [min, max].
// Inputs are rounded to integers. 1 = perfect, 0 = no better than chance.
export function weightedKappa(a, b, { min = 1, max = 5 } = {}) {
  const n = max - min + 1;
  const O = Array.from({ length: n }, () => new Array(n).fill(0));
  const ha = new Array(n).fill(0);
  const hb = new Array(n).fill(0);
  for (let k = 0; k < a.length; k++) {
    const i = Math.min(max, Math.max(min, Math.round(a[k]))) - min;
    const j = Math.min(max, Math.max(min, Math.round(b[k]))) - min;
    O[i][j]++;
    ha[i]++;
    hb[j]++;
  }
  const N = a.length;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const w = (i - j) ** 2 / (n - 1) ** 2;
      num += w * O[i][j];
      den += w * (ha[i] * hb[j]) / N;
    }
  }
  return den === 0 ? NaN : 1 - num / den;
}

export function median(xs) {
  const s = [...xs].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// human/judge: parallel arrays of scores. Fail = score below `threshold`
// (the same cut-off JudgeClient.verdict() uses). A false pass — the judge
// accepts something a human would reject — is the dangerous direction.
export function agreement(human, judge, { threshold = 3.0 } = {}) {
  const n = human.length;
  const diffs = human.map((h, i) => judge[i] - h);
  const exact = diffs.filter((d, i) => Math.round(judge[i]) === human[i]).length / n;
  const within1 = diffs.filter(d => Math.abs(d) <= 1).length / n;
  const bias = diffs.reduce((s, d) => s + d, 0) / n;

  let truePass = 0, trueFail = 0, falsePass = 0, falseFail = 0;
  for (let i = 0; i < n; i++) {
    const hFail = human[i] < threshold;
    const jFail = judge[i] < threshold;
    if (hFail && jFail) trueFail++;
    else if (!hFail && !jFail) truePass++;
    else if (hFail && !jFail) falsePass++;
    else falseFail++;
  }

  return {
    n,
    spearman: spearman(human, judge),
    weightedKappa: weightedKappa(human, judge),
    exact,
    within1,
    bias,
    verdict: { threshold, truePass, trueFail, falsePass, falseFail },
  };
}

// runs: array (per case) of arrays (per repeat) of scores.
export function consistency(runs) {
  const ranges = runs.map(r => Math.max(...r) - Math.min(...r));
  return {
    identicalRate: ranges.filter(r => r === 0).length / runs.length,
    meanRange: ranges.reduce((s, r) => s + r, 0) / runs.length,
    maxRange: Math.max(...ranges),
  };
}
