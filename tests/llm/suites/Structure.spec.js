import { test, expect } from '@playwright/test';
import { z } from 'zod';
import { LLMClient } from '../utils/LLMClient.js';
import { ResponseValidator } from '../utils/ResponseValidator.js';

const client = new LLMClient();
const validator = new ResponseValidator();

const TestCaseSchema = z.object({
  name: z.string().min(1),
  steps: z.array(z.string()).min(1),
  expected: z.string(),
});

const BugReportSchema = z.object({
  title: z.string(),
  severity: z.enum(['blocker', 'critical', 'major', 'minor', 'trivial']),
  stepsToReproduce: z.array(z.string()).min(1),
  expectedResult: z.string(),
  actualResult: z.string(),
});

test('should generate valid test case JSON', async () => {
  const response = await client.send(
    'Generate a test case for POST /login. ' +
    'Return JSON: {"name":"...","steps":["..."],"expected":"..."}'
  );
  const check = validator.validateJsonSchema(response.text, TestCaseSchema);
  expect(check.pass, `Schema errors: ${JSON.stringify(check.errors)}`).toBe(true);
});

test('should generate valid bug report', async () => {
  const response = await client.send(
    'Generate a bug report: login button does nothing when email is empty. ' +
    'Return JSON with fields: title, severity (blocker/critical/major/minor/trivial), ' +
    'stepsToReproduce, expectedResult, actualResult'
  );
  const check = validator.validateJsonSchema(response.text, BugReportSchema);
  expect(check.pass, `Schema errors: ${JSON.stringify(check.errors)}`).toBe(true);
});

test('should not hallucinate API endpoint', async () => {
  const spec = 'POST /api/v2/auth/login -> 200 {"token":string} | 401 {"error":string}';
  const response = await client.send(
    `Given this API spec:\n${spec}\n\nGenerate a test. ` +
    'Use ONLY data from the spec. Return JSON: {"endpoint":"...","method":"...","expectedStatus":number}'
  );
  const match = response.text.match(/\{[\s\S]*\}/);
  expect(match, 'No JSON found in response').not.toBeNull();
  const data = JSON.parse(match[0]);
  expect(data.endpoint).toBe('/api/v2/auth/login');
  expect(data.method.toUpperCase()).toBe('POST');
  expect([200, 401]).toContain(data.expectedStatus);
});
