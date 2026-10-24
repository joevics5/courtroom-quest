import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

import { reportError, describeError, _resetErrorReportingForTests } from './errorReporting';

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ error: null });
  _resetErrorReportingForTests();
});

describe('errorReporting', () => {
  it('describes errors, strings and odd values', () => {
    expect(describeError(new Error('boom')).message).toBe('boom');
    expect(describeError('plain').message).toBe('plain');
    expect(describeError({ a: 1 }).message).toBe('{"a":1}');
  });

  it('sends the error to the log with its context', async () => {
    expect(await reportError(new Error('boom'), 'screen-crash')).toBe(true);
    expect(rpc).toHaveBeenCalledWith('report_client_error', expect.objectContaining({ p_message: 'boom', p_context: 'screen-crash' }));
  });

  it('de-duplicates the same error', async () => {
    await reportError(new Error('same'));
    expect(await reportError(new Error('same'))).toBe(false);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('caps reports per session', async () => {
    for (let i = 0; i < 15; i++) await reportError(new Error(`e${i}`));
    expect(rpc).toHaveBeenCalledTimes(10);
  });

  it('never throws when logging itself fails', async () => {
    rpc.mockRejectedValue(new Error('network'));
    await expect(reportError(new Error('x'))).resolves.toBe(false);
  });
});
