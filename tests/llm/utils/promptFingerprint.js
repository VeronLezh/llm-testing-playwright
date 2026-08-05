import { createHash } from 'node:crypto';

/**
 * Fingerprints a system prompt so score-history entries can be tied to the
 * exact prompt version that produced them, not just the run's timestamp.
 * A short hex slice is plenty — collisions only matter within one agent's history.
 */
export function hashPrompt(systemPrompt) {
  return createHash('sha256').update(systemPrompt).digest('hex').slice(0, 12);
}
