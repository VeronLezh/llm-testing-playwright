import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

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
      : new OpenAI({ apiKey });
  }

  async send(userMessage) {
    const start = Date.now();
    let text;

    if (this.provider === 'anthropic') {
      const msg = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: this.systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      });
      const block = msg.content[0];
      if (!block || block.type !== 'text') throw new Error('LLMClient: unexpected Anthropic response block');
      text = block.text;
    } else {
      const msg = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0,
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: userMessage },
        ],
      });
      const content = msg.choices[0]?.message?.content;
      if (content == null) throw new Error('LLMClient: OpenAI returned null content');
      text = content;
    }

    return { text, latencyMs: Date.now() - start };
  }
}
