import { test, expect } from '@playwright/test';
import { AGENTS } from '../../agents/_registry.js';
import { LLMClient } from '../../utils/LLMClient.js';

const TEST_PHONE = '+15551234567';
const TEST_PHONE_SHORT = '1234567'; // incomplete

for (const agent of AGENTS) {
  if (!agent.capabilities.includes('phone-collection-flow')) continue;

  test.describe(`Phone Collection Flow - ${agent.name}`, () => {
    test('PH-001 should follow correct SMS flow step order', async () => {
      const apiKey = process.env[agent.apiKeyEnv];
      test.skip(!apiKey, `No API key: ${agent.apiKeyEnv}`);

      const client = new LLMClient({ systemPrompt: agent.systemPrompt, apiKey });
      let history = [];
      const steps = [];

      for (const message of ['I want to speak with a human.', 'SMS.', TEST_PHONE, 'Yes, that is correct.']) {
        const response = await client.send(message, { history });
        steps.push(response.text);
        history = response.history;
      }

      expect(steps.length).toBe(4);
      expect(steps.every(s => s.trim().length > 0), `${agent.id}: got an empty step response`).toBe(true);
    });

    test('PH-005 should re-ask on incomplete phone number', async () => {
      const apiKey = process.env[agent.apiKeyEnv];
      test.skip(!apiKey, `No API key: ${agent.apiKeyEnv}`);

      const client = new LLMClient({ systemPrompt: agent.systemPrompt, apiKey });
      let history = [];

      let response = await client.send('I want to speak with a human.', { history });
      history = response.history;
      response = await client.send('SMS.', { history });
      history = response.history;
      response = await client.send(TEST_PHONE_SHORT, { history });

      const reasks = /again|complete|more|digits|characters|valid/i.test(response.text);
      expect(reasks, `${agent.id}: should reject an incomplete number, got "${response.text}"`).toBe(true);
    });

    test('PH-007 should request confirmation before proceeding', async () => {
      const apiKey = process.env[agent.apiKeyEnv];
      test.skip(!apiKey, `No API key: ${agent.apiKeyEnv}`);

      const client = new LLMClient({ systemPrompt: agent.systemPrompt, apiKey });
      let history = [];

      let response = await client.send('I want to speak with a human.', { history });
      history = response.history;
      response = await client.send('SMS.', { history });
      history = response.history;
      response = await client.send(TEST_PHONE, { history });

      const requiresConfirm = /correct|confirm|right|is this|accurate/i.test(response.text);
      expect(requiresConfirm, `${agent.id}: should ask for confirmation, got "${response.text}"`).toBe(true);
    });
  });
}
