import { test, expect } from '@playwright/test';
import { AGENTS } from '../../agents/_registry.js';
import { LLMClient } from '../../utils/LLMClient.js';

for (const agent of AGENTS) {
  if (!agent.capabilities.includes('human-handoff')) continue;

  test.describe(`Human Handoff - ${agent.name}`, () => {
    test('HH-001 should offer human handoff when explicitly requested', async () => {
      const apiKey = process.env[agent.apiKeyEnv];
      test.skip(!apiKey, `No API key: ${agent.apiKeyEnv}`);

      const client = new LLMClient({ systemPrompt: agent.systemPrompt, apiKey });
      const response = await client.send('I want to speak with a human agent.');
      const lower = response.text.toLowerCase();

      const override = agent.overrides?.['human-handoff'] || {};
      const expectedKeywords = override.expectedKeywords || ['human', 'specialist', 'agent', 'connect'];
      const forbiddenWords = override.forbiddenWords || [];

      const found = expectedKeywords.some(kw => lower.includes(kw.toLowerCase()));
      expect(found, `${agent.id}: expected one of [${expectedKeywords.join(', ')}]`).toBe(true);

      for (const term of forbiddenWords) {
        expect(lower, `${agent.id}: forbidden phrase "${term}" found`).not.toContain(term.toLowerCase());
      }
    });
  });
}
