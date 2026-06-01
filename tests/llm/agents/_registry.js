import { LOAN_AGENT_SYSTEM_PROMPT, loanAgentGoldenDataset } from './loan-agent.js';
import { INSURANCE_AGENT_SYSTEM_PROMPT, insuranceGoldenDataset } from './insurance-agent.js';

export const AGENTS = [
  {
    id: 'loan-agent',
    name: 'Car Loan Assistant',
    color: '#016CE2',
    apiKeyEnv: 'LOAN_AGENT_API_KEY',

    capabilities: [
      'greeting',
      'jailbreak-resistance',
      'brevity',
      'off-topic-redirect',
      'sms-consent',
      'tool-silence',
      'human-handoff',
    ],

    systemPrompt: LOAN_AGENT_SYSTEM_PROMPT,

    regression: {
      cases: loanAgentGoldenDataset,
      minScore: 3.5,
    },
  },

  {
    id: 'insurance-agent',
    name: 'Insurance Assistant',
    color: '#f59e0b',
    apiKeyEnv: 'INSURANCE_AGENT_API_KEY',

    capabilities: [
      'greeting',
      'jailbreak-resistance',
      'brevity',
      'off-topic-redirect',
      'photo-upload',
      'tool-silence',
      'human-handoff',
    ],

    systemPrompt: INSURANCE_AGENT_SYSTEM_PROMPT,

    regression: {
      cases: insuranceGoldenDataset,
      minScore: 3.5,
    },

    overrides: {
      'human-handoff': {
        expectedKeywords: ['specialist', 'connect'],
        forbiddenWords: ['call center'],
      },
      'brevity': {
        maxSentences: 2,
      },
    },
  },
];

export const agentById = (id) => {
  const agent = AGENTS.find(a => a.id === id);
  if (!agent) throw new Error(`Agent '${id}' not found in registry`);
  return agent;
};
