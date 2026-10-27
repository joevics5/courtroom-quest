import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AppealPanel from './AppealPanel';
import type { Appeal } from '../lib/appeals';

const appeal = (over: Partial<Appeal> = {}): Appeal => ({
  id: 'a1', number: 1, status: 'denied', reason: 'missed_witness', explanation: 'Bill knew the clerk swapped the digits and nobody asked.',
  evidence_ids: [], witness_ids: [], created_at: '', response_due_at: '2026-10-29T10:00:00.000Z', ...over
});
const base = {
  active: null as Appeal | null, remaining: 2, busy: null as null, error: '',
  onAppeal: vi.fn(), onAccept: vi.fn(), onReopen: vi.fn(), onRetry: vi.fn(), onRespond: vi.fn()
};

describe('AppealPanel', () => {
  it('offers Appeal Verdict and Accept Verdict to a player who lost', () => {
    const onAppeal = vi.fn(); const onAccept = vi.fn();
    render(<AppealPanel {...base} stage="decide" onAppeal={onAppeal} onAccept={onAccept} />);
    fireEvent.click(screen.getByText('APPEAL VERDICT'));
    fireEvent.click(screen.getByText('ACCEPT VERDICT'));
    expect(onAppeal).toHaveBeenCalled();
    expect(onAccept).toHaveBeenCalled();
    expect(screen.getByText(/2 appeals left/)).toBeTruthy();
  });

  it('says when one appeal is left', () => {
    render(<AppealPanel {...base} stage="decide" remaining={1} />);
    expect(screen.getByText(/1 appeal left/)).toBeTruthy();
  });

  it('shows progress while the AI works, with the opposing counsel answer once it exists', () => {
    const active = appeal({
      status: 'awaiting_ruling',
      response: { decision: 'accept', explanation: 'We do not oppose a rehearing.', evidence_ids: [], witness_ids: [], by: 'ai', created_at: '' }
    });
    render(<AppealPanel {...base} stage="working" active={active} last={active} />);
    expect(screen.getByText(/The judge is reviewing/)).toBeTruthy();
    expect(screen.getByText(/We do not oppose a rehearing/)).toBeTruthy();
    expect(screen.queryByText('APPEAL VERDICT')).toBeNull();
  });

  it('tells the appellant an online opponent has been notified, and when the judge steps in', () => {
    render(<AppealPanel {...base} stage="waiting" active={appeal({ status: 'awaiting_response' })} />);
    expect(screen.getByText('WAITING FOR YOUR OPPONENT')).toBeTruthy();
    expect(screen.getByText(/judge decides without their answer/)).toBeTruthy();
  });

  it('asks the second player on a shared device to answer', () => {
    const onRespond = vi.fn();
    render(<AppealPanel {...base} stage="handoff" active={appeal({ status: 'awaiting_response' })} onRespond={onRespond} />);
    expect(screen.getByText('PASS THE DEVICE')).toBeTruthy();
    fireEvent.click(screen.getByText('OPPOSING COUNSEL: RESPOND'));
    expect(onRespond).toHaveBeenCalled();
  });

  it('shows the opponent the appeal filed against them and lets them respond', () => {
    const onRespond = vi.fn();
    render(<AppealPanel {...base} stage="respond" active={appeal({ status: 'awaiting_response' })} onRespond={onRespond} />);
    expect(screen.getByText('YOUR OPPONENT HAS APPEALED')).toBeTruthy();
    expect(screen.getByText('MISSED WITNESS INSIGHT')).toBeTruthy();
    expect(screen.getByText(/clerk swapped the digits/)).toBeTruthy();
    fireEvent.click(screen.getByText('RESPOND TO APPEAL'));
    expect(onRespond).toHaveBeenCalled();
  });

  it('shows the denial reason and lets the player appeal again', () => {
    const last = appeal({ ruling: { granted: false, reasoning: 'You only disagree with the jury.', created_at: '' } });
    render(<AppealPanel {...base} stage="decide" last={last} remaining={1} />);
    expect(screen.getByText('APPEAL DENIED')).toBeTruthy();
    expect(screen.getByText(/only disagree with the jury/)).toBeTruthy();
    expect(screen.getByText('APPEAL VERDICT')).toBeTruthy();
  });

  it('offers to reopen the case after the judge grants the appeal', () => {
    const onReopen = vi.fn();
    const last = appeal({ status: 'granted', ruling: { granted: true, reasoning: 'The route sheet was never used.', created_at: '' } });
    render(<AppealPanel {...base} stage="granted" last={last} onReopen={onReopen} />);
    expect(screen.getByText('APPEAL GRANTED')).toBeTruthy();
    fireEvent.click(screen.getByText('REOPEN THE CASE'));
    expect(onReopen).toHaveBeenCalled();
  });

  it('lets the player retry when a step failed', () => {
    const onRetry = vi.fn();
    const active = appeal({ status: 'awaiting_ruling' });
    render(<AppealPanel {...base} stage="working" active={active} last={active} error="The judge could not rule yet." onRetry={onRetry} />);
    fireEvent.click(screen.getByText('TRY AGAIN'));
    expect(onRetry).toHaveBeenCalled();
  });
});
