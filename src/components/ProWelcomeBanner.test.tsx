import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';

const { getStatus } = vi.hoisted(() => ({ getStatus: vi.fn() }));
vi.mock('../lib/database', () => ({ db: { credits: { getStatus } } }));

import ProWelcomeBanner from './ProWelcomeBanner';

const setUrl = (path: string) => window.history.replaceState({}, '', path);

beforeEach(() => { vi.useFakeTimers(); getStatus.mockReset(); });
afterEach(() => { vi.useRealTimers(); setUrl('/'); });

describe('ProWelcomeBanner', () => {
  it('shows nothing on a normal visit', () => {
    setUrl('/');
    render(<ProWelcomeBanner />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(getStatus).not.toHaveBeenCalled();
  });

  it('watches for Pro after returning from payment, then welcomes the player and tidies the address', async () => {
    setUrl('/?upgrade=success&x=1');
    getStatus.mockResolvedValueOnce({ tier: 'free' }).mockResolvedValue({ tier: 'pro' });
    render(<ProWelcomeBanner />);
    expect(screen.getByRole('status')).toHaveTextContent('Switching on Pro');
    expect(window.location.search).toBe('?x=1');
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(screen.getByRole('status')).toHaveTextContent('Switching on Pro');
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(screen.getByRole('status')).toHaveTextContent("You're Pro");
    await act(async () => { await vi.advanceTimersByTimeAsync(7100); });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('is honest when Pro has not switched on yet after about 20 seconds', async () => {
    setUrl('/?upgrade=success');
    getStatus.mockResolvedValue({ tier: 'free' });
    render(<ProWelcomeBanner />);
    await act(async () => { await vi.advanceTimersByTimeAsync(21000); });
    expect(screen.getByRole('status')).toHaveTextContent('Pro switches on within a minute');
  });
});
