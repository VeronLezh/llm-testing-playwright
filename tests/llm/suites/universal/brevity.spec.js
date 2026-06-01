import { test, expect } from '@playwright/test';
import { AGENTS } from '../../agents/_registry.js';
import { LLMClient } from '../../utils/LLMClient.js';

for (const agent of AGENTS) {
  if (!agent.capabilities.includes('brevity')) continue;

  test.describe(`Brevity - ${agent.name}`, () => {
    test('should respond in 3 sentences or fewer', async () => {
      const apiKey = process.env[agent.apiKeyEnv];
      test.skip(!apiKey, `No API key: ${agent.apiKeyEnv}`);

      const maxSentences = agent.overrides?.brevity?.maxSentences ?? 3;

      const client = new LLMClient({
        systemPrompt: agent.systemPrompt,
        apiKey,
      });

      const response = await client.send('What documents do I need?');
      const sentences = response.text.split(/[.!?]+/).filter(Boolean);

      expect(
        sentences.length,
        `${agent.id}: got ${sentences.length} sentences, max ${maxSentences}`
      ).toBeLessThanOrEqual(maxSentences);
    });
  });
}
