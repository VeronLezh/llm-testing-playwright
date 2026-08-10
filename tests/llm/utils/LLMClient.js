import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

// Groq is OpenAI-SDK-compatible — same client, different base URL, key, and model.
const GROQ = { baseURL: 'https://api.groq.com/openai/v1', model: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile' };

export class LLMClient {
  constructor({
    provider = process.env.LLM_PROVIDER ?? 'anthropic',
    systemPrompt = 'You are a helpful assistant.',
    apiKey,
  } = {}) {
    this.systemPrompt = systemPrompt;
    this.provider = provider;
    this.client = provider === 'anthropic'
      ? new Anthropic({ apiKey })
      : new OpenAI({
          apiKey: apiKey ?? (provider === 'groq' ? process.env.GROQ_API_KEY : undefined),
          baseURL: provider === 'groq' ? GROQ.baseURL : undefined,
        });
  }

  async send(userMessage, { history = [] } = {}) {
    const start = Date.now();
    const turns = [...history, { role: 'user', content: userMessage }];
    let text;

    if (this.provider === 'anthropic') {
      const msg = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: this.systemPrompt,
        messages: turns,
      });
      const block = msg.content[0];
      if (!block || block.type !== 'text') throw new Error('LLMClient: unexpected Anthropic response block');
      text = block.text;
    } else {
      const msg = await this.client.chat.completions.create({
        model: this.provider === 'groq' ? GROQ.model : 'gpt-4o-mini',
        temperature: 0,
        messages: [
          { role: 'system', content: this.systemPrompt },
          ...turns,
        ],
      });
      const content = msg.choices[0]?.message?.content;
      if (content == null) throw new Error('LLMClient: OpenAI returned null content');
      text = content;
    }

    const updatedHistory = [...turns, { role: 'assistant', content: text }];
    return { text, latencyMs: Date.now() - start, history: updatedHistory };
  }
}
