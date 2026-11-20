import { afterEach, describe, expect, it, vi } from 'vitest';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn(async () => ({ data: { text: 'ok' }, error: null })) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke } } }));

import { getAiUsageContext, setAiUsageContext } from './usageContext';
import { SupabaseEdgeProvider } from './providers/supabaseEdge';

afterEach(() => { setAiUsageContext(null); invoke.mockClear(); });

describe('AI usage context', () => {
  it('starts empty and can be set and cleared', () => {
    expect(getAiUsageContext()).toBeNull();
    setAiUsageContext({ sessionId: 's1', trialDuration: 15 });
    expect(getAiUsageContext()).toEqual({ sessionId: 's1', trialDuration: 15 });
    setAiUsageContext(null);
    expect(getAiUsageContext()).toBeNull();
  });

  it('tags AI calls with the open game and its trial length so the server can add up a trial', async () => {
    setAiUsageContext({ sessionId: '5b0d7c0e-2d52-4d7c-9a54-5f3a1b1c2d3e', trialDuration: 30 });
    await new SupabaseEdgeProvider({}).generate({ system: 'You are a witness', user: 'Hello' });
    const body = (invoke.mock.calls[0] as unknown as [string, { body: Record<string, unknown> }])[1].body;
    expect(body.sessionId).toBe('5b0d7c0e-2d52-4d7c-9a54-5f3a1b1c2d3e');
    expect(body.trialDuration).toBe(30);
    expect(body.system).toBe('You are a witness');
  });

  it('sends no tag when no game is open', async () => {
    await new SupabaseEdgeProvider({}).generate({ system: 'You are a witness', user: 'Hello' });
    const body = (invoke.mock.calls[0] as unknown as [string, { body: Record<string, unknown> }])[1].body;
    expect(body.sessionId).toBeUndefined();
    expect(body.trialDuration).toBeUndefined();
  });
});
