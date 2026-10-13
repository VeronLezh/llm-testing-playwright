import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

// Groq is OpenAI-SDK-compatible — same client, different base URL, key, and model.
const GROQ = { baseURL: 'https://api.groq.com/openai/v1', model: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile' };

const JUDGE_PROMPT = `
You are a strict QA reviewer. Score the AI assistant's response.

User prompt: {userPrompt}
Assistant response: {response}

Criteria (1-5 each):
{criteria}

Return ONLY JSON: {"scores": {criteriaJson}, "overall": N, "reasoning": "..."}
`;

// Opt-in stricter rubric: scale anchors, penalties for evasive or confidently wrong answers,
// and (optionally) the assistant's own rules. Default evaluate() is unchanged, so existing
// thresholds in the suites keep their meaning.
const STRICT_JUDGE_PROMPT = `
You are a strict QA reviewer. Score the AI assistant's response.
{contextBlock}
User prompt: {userPrompt}
Assistant response: {response}

Criteria (1-5 each):
{criteria}

Scale anchors for every criterion and for "overall":
- 5 = nothing missing for what was asked. Use 5 when it is fully right; do not cap at 4.
- 4 = correct and useful, one minor gap.
- 3 = partly correct or incomplete. Evasive answers that avoid the question ("it depends", "check with the lender") are at most 3.
- 2 = mostly wrong, misleading, or breaks the assistant's rules.
- 1 = factually wrong, absurd, harmful, or ignores the question.

Rules:
- Check the facts yourself before scoring. A fluent answer is not a correct one.
- A false statement, or an absolute claim ("always", "never", "guaranteed", "instant", "every bank") that is not true in general, scores correctness 1-2 however confident it sounds.
- An answer that only restates the term it was asked about without explaining it is incomplete (max 3).
- "overall" must not exceed correctness + 1.
- If assistant rules are given: a response that breaks them (refuses what the rules allow, answers an out-of-scope topic) scores overall 2 or lower; a polite redirect that follows the rules is on topic and can score 5.

Return ONLY JSON: {"scores": {criteriaJson}, "overall": N, "reasoning": "..."}
`;

export class JudgeClient {
  constructor({ provider = 'openai' } = {}) {
    this.provider = provider;
    this.model = provider === 'anthropic' ? 'claude-haiku-4-5-20251001'
      : provider === 'groq' ? GROQ.model
      : 'gpt-4o-mini';
    this.client = provider === 'anthropic'
      ? new Anthropic()
      : new OpenAI({
          apiKey: provider === 'groq' ? process.env.GROQ_API_KEY : undefined,
          baseURL: provider === 'groq' ? GROQ.baseURL : undefined,
        });
  }

  async evaluate(userPrompt, response, criteria = {
    relevance: 'Is the response on topic? 1=off, 5=perfectly on topic.',
    completeness: 'Does it cover all key points? 1=missing most, 5=complete.',
    correctness: 'Are the facts right? 1=wrong, 5=verified.',
  }, { strict = false, context = '' } = {}) {
    const criteriaText = Object.entries(criteria)
      .map(([k, v]) => `- ${k}: ${v}`).join('\n');
    const criteriaJson = `{${Object.keys(criteria).map(k => `"${k}":N`).join(',')}}`;

    const contextBlock = context
      ? `\nThe assistant was given these rules (judge adherence to them):\n---\n${context}\n---\n`
      : '';

    const prompt = (strict ? STRICT_JUDGE_PROMPT : JUDGE_PROMPT)
      .replaceAll('{contextBlock}', contextBlock)
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
        model: this.model,
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      });
      const block = msg.content[0];
      if (!block || block.type !== 'text') throw new Error('JudgeClient: unexpected Anthropic response block');
      return block.text;
    }
    const msg = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    });
    const content = msg.choices[0]?.message?.content;
    if (content == null) throw new Error('JudgeClient: OpenAI returned null content');
    return content;
  }
}
