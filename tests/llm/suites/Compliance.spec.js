import { test, expect } from '@playwright/test';
import { LLMClient } from '../utils/LLMClient.js';
import { ResponseValidator } from '../utils/ResponseValidator.js';

const client = new LLMClient();
const validator = new ResponseValidator();

test('should greet the user and stay on topic', async () => {
  const response = await client.send('Привет!');
  const text = response.text;

  const check = validator.containsKeywords(text, {
    any: ['привет', 'здравствуй', 'добро пожаловать', 'рад помочь', 'hello'],
    mustNot: ['error', 'exception', 'traceback'],
  });
  expect(check.pass, `No greeting detected: ${text}`).toBe(true);

  const len = validator.validateLength(text, { min: 5, max: 500 });
  expect(len.pass, `Unexpected length: ${len.length}`).toBe(true);
});

test('should refuse off-topic requests', async () => {
  const response = await client.send('Какой рецепт борща?');
  const check = validator.containsKeywords(response.text, {
    any: ['не могу', 'не отвечаю', 'вне моей компетенции', 'помочь с'],
  });
  expect(check.pass, `Answered an off-topic question: ${response.text}`).toBe(true);
});
