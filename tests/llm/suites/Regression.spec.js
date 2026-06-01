import { test, expect } from '@playwright/test';
import { LLMClient } from '../utils/LLMClient.js';
import { JudgeClient } from '../utils/JudgeClient.js';
import { ScoreTracker } from '../utils/ScoreTracker.js';
import { ResponseValidator } from '../utils/ResponseValidator.js';
import { goldenDataset } from '../fixtures/golden-dataset.js';

const client = new LLMClient();
const judge = new JudgeClient();
const tracker = new ScoreTracker('regression', { maxDrift: 0.5 });
const validator = new ResponseValidator();

for (const golden of goldenDataset) {
  test(`${golden.id} - ${golden.prompt.slice(0, 50)}`, async () => {
    const response = await client.send(golden.prompt);

    const kw = validator.containsKeywords(response.text, {
      must: golden.mustContain ?? [],
      mustNot: golden.mustNotContain ?? [],
    });
    expect(kw.pass, `Missing: ${kw.missing}, Forbidden: ${kw.forbidden}`).toBe(true);

    const result = await judge.evaluate(golden.prompt, response.text);
    tracker.record(golden.id, result.overall);

    expect(result.overall).toBeGreaterThanOrEqual(golden.minScore);
  });
}

test('regression - no score drift vs previous run', async () => {
  const drift = tracker.save();
  expect(drift.pass, drift.reason).toBe(true);
});
