import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

const JUDGE_PROMPT = `
You are a strict QA reviewer. Score the AI assistant's response.

User prompt: {userPrompt}
Assistant response: {response}

Criteria (1-5 each):
{criteria}

Return ONLY JSON: {"scores": {criteriaJson}, "overall": N, "reasoning": "..."}
`;

export class JudgeClient {
  constructor({ provider = 'openai' } = {}) {
    this.provider = provider;
    this.client = provider === 'anthropic'
      ? new Anthropic()
      : new OpenAI();
  }

  async evaluate(userPrompt, response, criteria = {
    relevance: 'Is the response on topic? 1=off, 5=perfectly on topic.',
    completeness: 'Does it cover all key points? 1=missing most, 5=complete.',
    correctness: 'Are the facts right? 1=wrong, 5=verified.',
  }) {
    const criteriaText = Object.entries(criteria)
      .map(([k, v]) => `- ${k}: ${v}`).join('\n');
    const criteriaJson = `{${Object.keys(criteria).map(k => `"${k}":N`).join(',')}}`;

    const prompt = JUDGE_PROMPT
      .replaceAll('{userPrompt}', userPrompt)
      .replaceAll('{response}', response)
      .replaceAll('{criteria}', criteriaText)
      .replaceAll('{criteriaJson}', criteriaJson);

    const text = await this._call(prompt);
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`JudgeClient: no JSON in response:\n${text}`);
    return JSON.parse(match[0]);
  }

  verdict(result, { threshold = 3.0 } = {}) {
    const pass = result.overall >= threshold;
    return { pass, reason: result.reasoning, overall: result.overall };
  }

  async _call(prompt) {
    if (this.provider === 'anthropic') {
      const msg = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      });
      return msg.content[0].text;
    }
    const msg = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    });
    return msg.choices[0].message.content;
  }
}
