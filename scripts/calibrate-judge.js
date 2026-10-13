// Calibrates the LLM judge against human labels.
//   1. fill tests/llm/fixtures/calibration/labels.json (see docs/judge-calibration.md)
//   2. npm run calibrate
// Runs the judge CALIBRATION_RUNS times per case and compares its median with the human score.
//   npm run calibrate         baseline judge, 3 runs/case (~90 small calls)
//   npm run calibrate:strict  strict rubric + agent rules, 1 run/case (~30 calls),
//                             compared against the baseline report
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JudgeClient } from '../tests/llm/utils/JudgeClient.js';
import { LOAN_AGENT_SYSTEM_PROMPT } from '../tests/llm/agents/loan-agent.js';
import { agreement, consistency, median } from '../tests/llm/utils/agreement.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../tests/llm/fixtures/calibration');
const cases = JSON.parse(fs.readFileSync(path.join(dir, 'cases.json'), 'utf8'));
const labels = JSON.parse(fs.readFileSync(path.join(dir, 'labels.json'), 'utf8'));

const bad = cases.filter(c => !Number.isInteger(labels[c.id]) || labels[c.id] < 1 || labels[c.id] > 5);
if (bad.length) {
  console.error(`labels.json: ${bad.length} case(s) without a 1-5 integer label (${bad.slice(0, 5).map(c => c.id).join(', ')}...).`);
  process.exit(1);
}

const provider = process.env.JUDGE_PROVIDER ?? process.env.LLM_PROVIDER ?? 'openai';
const strict = process.env.CALIBRATION_MODE === 'strict';
const runs = Number(process.env.CALIBRATION_RUNS ?? (strict ? 1 : 3));
const judge = new JudgeClient({ provider });
const evalOptions = strict ? { strict: true, context: LOAN_AGENT_SYSTEM_PROMPT } : {};

async function score(c) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await judge.evaluate(c.prompt, c.response, undefined, evalOptions);
      const overall = Number(r.overall);
      if (Number.isFinite(overall)) return overall;
      const vals = Object.values(r.scores ?? {}).map(Number).filter(Number.isFinite);
      if (vals.length) return vals.reduce((s, x) => s + x, 0) / vals.length;
    } catch (e) {
      if (attempt === 1) throw e;
    }
  }
  throw new Error(`no usable score for ${c.id}`);
}

const perCase = [];
const queue = [...cases];
await Promise.all(Array.from({ length: 4 }, async () => {
  while (queue.length) {
    const c = queue.shift();
    const scores = [];
    for (let i = 0; i < runs; i++) scores.push(await score(c));
    perCase.push({ id: c.id, human: labels[c.id], judgeRuns: scores, judge: median(scores) });
  }
}));
perCase.sort((a, b) => a.id.localeCompare(b.id));

const human = perCase.map(c => c.human);
const judgeScores = perCase.map(c => c.judge);
const a = agreement(human, judgeScores);
const cons = consistency(perCase.map(c => c.judgeRuns));
const disagreements = perCase.filter(c => Math.abs(c.judge - c.human) >= 2);

const report = {
  date: new Date().toISOString().slice(0, 10),
  judge: { provider, model: judge.model, mode: strict ? 'strict' : 'baseline', runsPerCase: runs },
  agreement: a,
  consistency: cons,
  disagreements,
  cases: perCase,
};
const outFile = strict ? 'report-strict.json' : 'report.json';
fs.writeFileSync(path.join(dir, outFile), JSON.stringify(report, null, 2));

const f = x => (Number.isFinite(x) ? x.toFixed(2) : 'n/a');
const pct = x => `${Math.round(x * 100)}%`;
console.log(`\nJudge: ${provider} / ${judge.model}   mode: ${strict ? 'strict' : 'baseline'}   cases: ${a.n}   runs/case: ${runs}`);
console.log(`Spearman ρ:           ${f(a.spearman)}`);
console.log(`Weighted kappa (QWK): ${f(a.weightedKappa)}`);
console.log(`Exact agreement:      ${pct(a.exact)}   within ±1: ${pct(a.within1)}`);
console.log(`Bias (judge-human):   ${a.bias >= 0 ? '+' : ''}${f(a.bias)}`);
const v = a.verdict;
console.log(`Verdict @${v.threshold}: true pass ${v.truePass}, true fail ${v.trueFail}, FALSE PASS ${v.falsePass}, false fail ${v.falseFail}`);
console.log(`Run-to-run: identical ${pct(cons.identicalRate)}, mean range ${f(cons.meanRange)}, max range ${f(cons.maxRange)}`);
if (disagreements.length) {
  console.log(`\nDisagreements >= 2 points:`);
  for (const d of disagreements) console.log(`  ${d.id}: human ${d.human}, judge ${d.judge} (runs ${d.judgeRuns.join(', ')})`);
}
console.log(`\nReport: tests/llm/fixtures/calibration/${outFile}`);

const baselineFile = path.join(dir, 'report.json');
if (strict && fs.existsSync(baselineFile)) {
  const b = JSON.parse(fs.readFileSync(baselineFile, 'utf8')).agreement;
  const row = (name, x, y) => console.log(`${name.padEnd(26)}${String(x).padStart(10)}${String(y).padStart(10)}`);
  console.log(`\n${''.padEnd(26)}${'baseline'.padStart(10)}${'strict'.padStart(10)}`);
  row('Spearman ρ', f(b.spearman), f(a.spearman));
  row('Weighted kappa', f(b.weightedKappa), f(a.weightedKappa));
  row('Exact agreement', pct(b.exact), pct(a.exact));
  row('Within ±1', pct(b.within1), pct(a.within1));
  row('Bias (judge-human)', f(b.bias), f(a.bias));
  row('False pass', b.verdict.falsePass, v.falsePass);
  row('False fail', b.verdict.falseFail, v.falseFail);
}
