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

  // tools: [{ name, description, inputSchema, handler(args) }]. `handler` runs locally —
  // it stands in for whatever a real MCP/function-calling server would do, so tests can
  // control its behavior (and a poisoned `description` can be tested without standing up
  // any actual tool infrastructure). Recorded in the returned `callLog` regardless of
  // whether the model's request to call it was legitimate.
  async send(userMessage, { history = [], tools = [] } = {}) {
    const start = Date.now();
    const turns = [...history, { role: 'user', content: userMessage }];
    const callLog = [];
    let text;

    if (this.provider === 'anthropic') {
      text = await this.#sendAnthropic(turns, tools, callLog);
    } else {
      text = await this.#sendOpenAICompatible(turns, tools, callLog);
    }

    const updatedHistory = [...turns, { role: 'assistant', content: text }];
    return { text, latencyMs: Date.now() - start, history: updatedHistory, callLog };
  }

  async #sendAnthropic(turns, tools, callLog, maxRounds = 4) {
    const anthropicTools = tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema ?? { type: 'object', properties: {} },
    }));

    for (let round = 0; round < maxRounds; round++) {
      const msg = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: this.systemPrompt,
        messages: turns,
        ...(anthropicTools.length ? { tools: anthropicTools } : {}),
      });

      const toolUses = msg.content.filter(b => b.type === 'tool_use');
      if (msg.stop_reason !== 'tool_use' || toolUses.length === 0) {
        const block = msg.content.find(b => b.type === 'text');
        if (!block) throw new Error('LLMClient: unexpected Anthropic response block');
        return block.text;
      }

      turns.push({ role: 'assistant', content: msg.content });
      const toolResults = toolUses.map(tu => ({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: JSON.stringify(this.#runTool(tools, tu.name, tu.input, callLog)),
      }));
      turns.push({ role: 'user', content: toolResults });
    }
    throw new Error('LLMClient: exceeded max tool-call rounds (possible tool-call loop)');
  }

  async #sendOpenAICompatible(turns, tools, callLog, maxRounds = 4) {
    const openaiTools = tools.map(t => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.inputSchema ?? { type: 'object', properties: {} } },
    }));
    const model = this.provider === 'groq' ? GROQ.model : 'gpt-4o-mini';
    const messages = [{ role: 'system', content: this.systemPrompt }, ...turns];

    for (let round = 0; round < maxRounds; round++) {
      const msg = await this.client.chat.completions.create({
        model,
        temperature: 0,
        messages,
        ...(openaiTools.length ? { tools: openaiTools } : {}),
      });
      const choice = msg.choices[0]?.message;
      if (!choice) throw new Error('LLMClient: OpenAI-compatible API returned no message');

      if (!choice.tool_calls?.length) {
        if (choice.content == null) throw new Error('LLMClient: OpenAI-compatible API returned null content');
        // Sync turns (excludes the leading system message) with what actually happened.
        turns.length = 0;
        turns.push(...messages.slice(1));
        return choice.content;
      }

      messages.push(choice);
      for (const call of choice.tool_calls) {
        const args = JSON.parse(call.function.arguments || '{}');
        const result = this.#runTool(tools, call.function.name, args, callLog);
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
      }
    }
    throw new Error('LLMClient: exceeded max tool-call rounds (possible tool-call loop)');
  }

  #runTool(tools, name, args, callLog) {
    callLog.push({ toolName: name, args });
    const tool = tools.find(t => t.name === name);
    if (!tool) return { error: `unknown tool: ${name}` };
    return tool.handler ? tool.handler(args) : { ok: true };
  }
}
