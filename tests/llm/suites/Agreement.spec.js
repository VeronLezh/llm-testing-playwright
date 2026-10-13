import { test, expect } from '@playwright/test';
import { ranks, spearman, weightedKappa, agreement, consistency, median } from '../utils/agreement.js';

// Offline sanity checks for the calibration maths — no API calls.

test('AGR-001 - ranks average ties', () => {
  expect(ranks([10, 20, 20, 30])).toEqual([1, 2.5, 2.5, 4]);
});

test('AGR-002 - spearman: perfect, inverse, and monotone-nonlinear', () => {
  expect(spearman([1, 2, 3, 4, 5], [1, 2, 3, 4, 5])).toBeCloseTo(1, 10);
  expect(spearman([1, 2, 3, 4, 5], [5, 4, 3, 2, 1])).toBeCloseTo(-1, 10);
  expect(spearman([1, 2, 3, 4, 5], [1, 4, 9, 16, 25])).toBeCloseTo(1, 10);
});

test('AGR-003 - weighted kappa: identical = 1, a systematic +1 shift is penalised', () => {
  const h = [1, 2, 3, 4, 5, 3, 2, 4];
  expect(weightedKappa(h, h)).toBeCloseTo(1, 10);
  const shifted = h.map(x => Math.min(5, x + 1));
  expect(weightedKappa(h, shifted)).toBeLessThan(0.9);
});

test('AGR-004 - agreement: false pass is counted when the judge accepts what a human rejects', () => {
  const human = [1, 2, 4, 5];
  const judge = [4, 2, 4, 2]; // case 0: judge too lenient; case 3: judge too strict
  const a = agreement(human, judge);
  expect(a.verdict).toMatchObject({ truePass: 1, trueFail: 1, falsePass: 1, falseFail: 1 });
  expect(a.exact).toBe(0.5);
  expect(a.within1).toBe(0.5);
  expect(a.bias).toBeCloseTo(0, 10);
});

test('AGR-005 - consistency and median', () => {
  const c = consistency([[4, 4, 4], [3, 4, 5], [2, 2, 3]]);
  expect(c.identicalRate).toBeCloseTo(1 / 3, 10);
  expect(c.meanRange).toBeCloseTo(1, 10);
  expect(c.maxRange).toBe(2);
  expect(median([3, 5, 4])).toBe(4);
  expect(median([3, 4])).toBe(3.5);
});
