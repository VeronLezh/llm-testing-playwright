import { test, expect } from '@playwright/test';
import { LLMClient } from '../utils/LLMClient.js';
import { JudgeClient } from '../utils/JudgeClient.js';
import { SemanticScorer } from '../utils/SemanticScorer.js';

const client = new LLMClient();
const judge = new JudgeClient({ provider: process.env.LLM_PROVIDER ?? 'openai' });
const semantic = new SemanticScorer();

test('IMP-002 - tone and brevity', async () => {
  const prompt = 'What documents do I need for a car loan?';
  const response = await client.send(prompt);

  const result = await judge.evaluate(prompt, response.text, {
    tone: 'Is it professional and friendly? 1=rude, 5=warm.',
    brevity: 'Under 80 words? 1=wall of text, 5=concise.',
  });

  console.log(`Tone: ${result.scores.tone}/5, Brevity: ${result.scores.brevity}/5`);
  console.log(`Reasoning: ${result.reasoning}`);

  expect(result.scores.tone).toBeGreaterThanOrEqual(4);
  expect(result.scores.brevity).toBeGreaterThanOrEqual(3);
});

test('IMP-003 - consistency across 3 runs', async () => {
  const prompt = 'What is your main purpose?';
  const scores = [];

  for (let i = 0; i < 3; i++) {
    const response = await client.send(prompt);
    const result = await judge.evaluate(prompt, response.text);
    scores.push(result.overall);
  }

  const variance = Math.max(...scores) - Math.min(...scores);
  console.log(`Scores: ${scores.join(', ')}, variance: ${variance}`);
  expect(variance).toBeLessThanOrEqual(1.5);
});

test('IMP-005 - semantic similarity to reference answer', async () => {
  const reference = 'To apply for a loan you need income proof, valid ID, and credit history';
  const response = await client.send('What documents do I need for a loan application?');

  const result = semantic.semanticSimilarity(reference, response.text);
  console.log(`Semantic similarity: ${result.normalized.toFixed(2)}`);
  expect(result.normalized).toBeGreaterThan(0.2);
});

test('IMP-006 - content coverage (ROUGE + completeness)', async () => {
  const reference = 'income proof, government ID, insurance, bank statements';
  const response = await client.send('List the documents needed for a car loan');

  const scores = semantic.rougeScore(reference, response.text);
  const cov = semantic.completeness(reference, response.text);

  console.log(`ROUGE-1: ${scores.rouge1.toFixed(2)}, ROUGE-L: ${scores.rougeL.toFixed(2)}`);
  console.log(`Completeness: ${(cov.completeness * 100).toFixed(0)}%`);

  expect(scores.rougeL).toBeGreaterThan(0.3);
  expect(cov.completeness).toBeGreaterThan(0.4);
});
