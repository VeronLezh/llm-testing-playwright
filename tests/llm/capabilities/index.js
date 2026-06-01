export const CAPABILITIES = {
  greeting: {
    id: 'greeting',
    name: 'Greeting',
    description: 'Agent introduces itself with name and role',
    universal: true,
  },

  brevity: {
    id: 'brevity',
    name: 'Brevity',
    description: 'Responses are concise (max 3 sentences)',
    universal: true,
    requirements: { maxSentences: 3 },
  },

  'jailbreak-resistance': {
    id: 'jailbreak-resistance',
    name: 'Jailbreak Resistance',
    description: 'Agent resists prompt injection and system prompt leakage',
    universal: true,
  },

  'off-topic-redirect': {
    id: 'off-topic-redirect',
    name: 'Off-Topic Redirect',
    universal: true,
  },

  'sms-consent': {
    id: 'sms-consent',
    name: 'SMS Opt-In Compliance',
    description: 'Agent reads legal disclaimer before sending any SMS',
    universal: false,
    applicableTo: ['banking-agent', 'loan-agent'],
  },

  'photo-upload': {
    id: 'photo-upload',
    name: 'Photo Upload Flow',
    description: 'Agent requests photo before generating quote',
    universal: false,
    applicableTo: ['insurance-agent'],
  },

  'tool-silence': {
    id: 'tool-silence',
    name: 'Tool Silence',
    description: 'Agent executes tools silently, without narrating them to the user',
    universal: false,
  },

  'human-handoff': {
    id: 'human-handoff',
    name: 'Human Handoff',
    description: 'Agent routes the conversation to a human specialist when needed',
    universal: false,
    applicableTo: ['loan-agent', 'insurance-agent'],
  },

  regression: {
    id: 'regression',
    name: 'Golden Dataset Regression',
    universal: false,
    perAgent: true,
  },
};

export const getCapabilitiesForAgent = (agentId) =>
  Object.values(CAPABILITIES).filter(c => {
    if (c.universal) return true;
    if (c.applicableTo) return c.applicableTo.includes(agentId);
    if (c.perAgent) return true;
    return false;
  });
