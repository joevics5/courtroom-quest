import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AppealPanel from './AppealPanel';
import type { Appeal } from '../lib/appeals';

const appeal = (over: Partial<Appeal> = {}): Appeal => ({
  id: 'a1', number: 1, status: 'denied', reason: 'other', explanation: 'x'.repeat(40), evidence_ids: [], witness_ids: [],
  created_at: '', response_due_at: '', ...over
});
const base = {
  active: null, grantedPending: false, canStartAppeal: false, remaining: 2, busy: null as null, error: '',
  onAppeal: vi.fn(), onAccept: vi.fn(), onReopen: vi.fn(), onRetry: vi.fn()
};

describe('AppealPanel', () => {
  it('offers Appeal Verdict and Accept Verdict to a player who lost', () => {
    const onAppeal = vi.fn(); const onAccept = vi.fn();
    render(<AppealPanel {...base} canStartAppeal onAppeal={onAppeal} onAccept={onAccept} />);
    fireEvent.click(screen.getByText('APPEAL VERDICT'));
    fireEvent.click(screen.getByText('ACCEPT VERDICT'));
    expect(onAppeal).toHaveBeenCalled();
    expect(onAccept).toHaveBeenCalled();
    expect(screen.getByText(/2 appeals left/)).toBeTruthy();
  });

  it('says how many appeals are left', () => {
    render(<AppealPanel {...base} canStartAppeal remaining={1} />);
    expect(screen.getByText(/1 appeal left/)).toBeTruthy();
  });

  it('shows progress while the AI works, with opposing counsel\'s answer once it exists', () => {
    const active = appeal({
      status: 'awaiting_ruling',
      response: { decision: 'oppose', explanation: 'The jury heard it all.', evidence_ids: [], witness_ids: [], by: 'ai', created_at: '' }
    });
    render(<AppealPanel {...base} active={active} last={active} />);
    expect(screen.getByText(/The judge is reviewing/)).toBeTruthy();
    expect(screen.getByText(/The jury heard it all/)).toBeTruthy();
    expect(screen.queryByText('APPEAL VERDICT')).toBeNull();
  });

  it('shows the denial reason and lets the player appeal again', () => {
    const last = appeal({ ruling: { granted: false, reasoning: 'You only disagree with the jury.', created_at: '' } });
    render(<AppealPanel {...base} last={last} canStartAppeal remaining={1} />);
    expect(screen.getByText('APPEAL DENIED')).toBeTruthy();
    expect(screen.getByText(/only disagree with the jury/)).toBeTruthy();
    expect(screen.getByText('APPEAL VERDICT')).toBeTruthy();
  });

  it('offers to reopen the case after the judge grants the appeal', () => {
    const onReopen = vi.fn();
    const last = appeal({ status: 'granted', ruling: { granted: true, reasoning: 'The route sheet was never used.', created_at: '' } });
    render(<AppealPanel {...base} last={last} grantedPending onReopen={onReopen} />);
    expect(screen.getByText('APPEAL GRANTED')).toBeTruthy();
    fireEvent.click(screen.getByText('REOPEN THE CASE'));
    expect(onReopen).toHaveBeenCalled();
  });

  it('lets the player retry when the AI step failed', () => {
    const onRetry = vi.fn();
    const active = appeal({ status: 'awaiting_ruling' });
    render(<AppealPanel {...base} active={active} last={active} error="The judge could not rule yet." onRetry={onRetry} />);
    fireEvent.click(screen.getByText('TRY AGAIN'));
    expect(onRetry).toHaveBeenCalled();
  });
});
