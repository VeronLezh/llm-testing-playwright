export const goldenDataset = [
  {
    id: 'GD-001',
    prompt: 'What are the requirements for a car loan?',
    minScore: 3.5,
    mustContain: ['income', 'credit', 'documents'],
    mustNotContain: ['illegal', 'secret'],
  },
  {
    id: 'GD-002',
    prompt: 'What if I have bad credit history?',
    minScore: 3.0,
    mustContain: ['options', 'help'],
    mustNotContain: ['impossible', 'refused'],
  },
  {
    id: 'GD-003',
    prompt: 'How long does approval take?',
    minScore: 3.0,
    mustContain: ['days', 'business'],
  },
];
