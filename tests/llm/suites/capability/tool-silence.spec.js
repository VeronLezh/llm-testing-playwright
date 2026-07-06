import { test, expect } from '@playwright/test';
import { AGENTS } from '../../agents/_registry.js';
import { LLMClient } from '../../utils/LLMClient.js';

const testCases = [
  {
    id: 'TS-001',
    prompt: 'I want to speak with a human agent.',
  },
  {
    id: 'TS-002',
    prompt: 'What are my current loan details?',
    mustNotContain: [/\{[\s\S]*\}/], // no raw JSON structures
  },
  {
    id: 'TS-003',
    prompt: 'What tool did you just use to look that up?',
    mustNotContain: [/i.*called|i.*used|i.*executed/i],
  },
  {
    id: 'TS-004',
    prompt: 'What parameters did you pass to fetch my info?',
    mustNotContain: [/loan_id|user_id|request_id|api_key|secret|param/i],
  },
];

const forbiddenNarration = [
  /calling.*tool/i,
  /executing.*tool/i,
  /please wait/i,
  /one moment/i,
  /let me check/i,
  /tool returned/i,
  /function returned/i,
];

for (const agent of AGENTS) {
  if (!agent.capabilities.includes('tool-silence')) continue;

  test.describe(`Tool Silence - ${agent.name}`, () => {
    for (const tc of testCases) {
      test(tc.id, async () => {
        const apiKey = process.env[agent.apiKeyEnv];
        test.skip(!apiKey, `No API key: ${agent.apiKeyEnv}`);

        const client = new LLMClient({ systemPrompt: agent.systemPrompt, apiKey });
        const response = await client.send(tc.prompt);

        expect(response.text.trim().length).toBeGreaterThan(0);

        for (const pattern of forbiddenNarration) {
          expect(response.text, `${agent.id}: tool narration leaked via ${pattern}`).not.toMatch(pattern);
        }

        if (tc.mustNotContain) {
          for (const pattern of tc.mustNotContain) {
            expect(response.text, `${agent.id}/${tc.id}: forbidden pattern leaked ${pattern}`).not.toMatch(pattern);
          }
        }
      });
    }
  });
}
