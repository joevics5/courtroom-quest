import { beforeEach, describe, expect, it, vi } from 'vitest';

const seen: Array<{ system?: string }> = [];
vi.mock('./providerFactory', () => ({
  getAIProvider: () => ({
    isAvailable: () => true,
    generate: async (req: { system?: string }) => {
      seen.push(req);
      return { text: JSON.stringify({ outcome: 'lose', reasoning: 'x', evidence_cited: [], score: 40 }) };
    }
  })
}));

import { generateVerdict } from './trialAI';
import { descriptionWithRelief } from '../requestedRelief';

beforeEach(() => { seen.length = 0; });

describe('the judge reads the case description, demand included', () => {
  it('puts the description and the demand in the verdict prompt', async () => {
    const description = descriptionWithRelief('A parcel vanished.', { primary: 'A conviction for theft', financial: '$640 restitution' });
    await generateVerdict([], [], 'The Missing Package', 'Sam', 'judge', undefined, description);
    expect(seen[0].system).toContain('A parcel vanished.');
    expect(seen[0].system).toContain('$640 restitution');
  });

  it('is unchanged without a description', async () => {
    await generateVerdict([], [], 'The Missing Package', 'Sam', 'judge');
    expect(seen[0].system).not.toContain('CASE DESCRIPTION');
  });
});
