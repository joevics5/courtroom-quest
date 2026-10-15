import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ModalSheet from './ModalSheet';
import WitnessSelector from './WitnessSelector';
import EvidenceSelector from './EvidenceSelector';
import ObjectionSelector from './ObjectionSelector';
import TranscriptViewer from './TranscriptViewer';
import Tutorial from './Tutorial';
import type { Evidence, TrialEvent, Witness } from '../types';

describe('ModalSheet', () => {
  it('closes with the X, with Escape, and by tapping outside - but not by tapping inside', () => {
    const onClose = vi.fn();
    render(<ModalSheet title="Select" onClose={onClose}><p>inside</p></ModalSheet>);
    fireEvent.click(screen.getByText('inside'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('dialog').parentElement!);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('is drawn in <body> and stops the page behind it from scrolling', () => {
    const { unmount } = render(<div id="page"><ModalSheet title="Select"><p>x</p></ModalSheet></div>);
    expect(document.body.querySelector(':scope > div [role="dialog"]')).not.toBeNull();
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('has no close button when it cannot be dismissed', () => {
    render(<ModalSheet title="Locked"><p>x</p></ModalSheet>);
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  });
});

const witness = (id: string, name: string): Witness => ({ id, name, role: 'Neighbor', background: 'Lives next door' } as Witness);
const exhibit = (id: string, title: string): Evidence => ({ id, title, exhibit_label: 'Exhibit A', description: 'A photo', evidence_type: 'photographs' } as Evidence);

describe('selector popups', () => {
  it('WitnessSelector lists only uncalled witnesses, selects one, skips, closes', () => {
    const onSelect = vi.fn(); const onSkip = vi.fn(); const onClose = vi.fn();
    render(<WitnessSelector witnesses={[witness('1', 'Maria Lopez'), witness('2', 'Tom Reed')]} witnessesCalled={['2']} onSelect={onSelect} onSkip={onSkip} onClose={onClose} />);
    expect(screen.queryByText('Tom Reed')).toBeNull();
    fireEvent.click(screen.getByText('Maria Lopez'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
    fireEvent.click(screen.getByText('Skip Calling Witness'));
    expect(onSkip).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('WitnessSelector says when everyone has been called', () => {
    render(<WitnessSelector witnesses={[witness('1', 'Maria')]} witnessesCalled={['1']} onSelect={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.getByText('All witnesses have been called.')).toBeTruthy();
  });

  it('EvidenceSelector hides submitted exhibits, selects and closes', () => {
    const onSelect = vi.fn(); const onClose = vi.fn();
    render(<EvidenceSelector evidence={[exhibit('1', 'Photo'), exhibit('2', 'Receipt')]} evidenceSubmitted={['2']} onSelect={onSelect} onClose={onClose} />);
    expect(screen.queryByText(/Receipt/)).toBeNull();
    fireEvent.click(screen.getByText(/Photo/));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('ObjectionSelector offers every reason and reports the choice', () => {
    const onSelect = vi.fn();
    render(<ObjectionSelector onSelect={onSelect} onClose={vi.fn()} />);
    expect(screen.getByText('OBJECTION!')).toBeTruthy();
    fireEvent.click(screen.getByText('Hearsay'));
    expect(onSelect).toHaveBeenCalledWith('hearsay');
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(9);
  });
});

describe('TranscriptViewer', () => {
  const ev = (id: string, role: string, content: string) => ({ id, speaker_role: role, speaker_name: null, content, event_type: 'witness_examination', timestamp: '2026-10-15T10:00:00Z' } as unknown as TrialEvent);
  it('shows each entry with its speaker, the count, and closes', () => {
    const onClose = vi.fn();
    render(<TranscriptViewer events={[ev('1', 'judge', 'Order in the court'), ev('2', 'witness', 'I saw smoke')]} caseTitle="The Conspiracy" onClose={onClose} />);
    expect(screen.getByText('The Conspiracy')).toBeTruthy();
    expect(screen.getByText('Order in the court')).toBeTruthy();
    expect(screen.getByText('Judge')).toBeTruthy();
    expect(screen.getByText('Total entries: 2')).toBeTruthy();
    // both the X and the footer button close it
    const closers = screen.getAllByRole('button', { name: 'Close' });
    expect(closers).toHaveLength(2);
    closers.forEach(b => fireEvent.click(b));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
  it('says when there is nothing to show', () => {
    render(<TranscriptViewer events={[]} caseTitle="X" onClose={vi.fn()} />);
    expect(screen.getByText('No transcript entries found.')).toBeTruthy();
  });
});

describe('Tutorial', () => {
  it('walks through the steps and finishes', () => {
    const onComplete = vi.fn(); const onSkip = vi.fn();
    render(<Tutorial onComplete={onComplete} onSkip={onSkip} />);
    expect(screen.getByText('Welcome to the Courtroom')).toBeTruthy();
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Turns & the Clock')).toBeTruthy();
    fireEvent.click(screen.getByText('Back'));
    expect(screen.getByText('Welcome to the Courtroom')).toBeTruthy();
    for (let i = 0; i < 5; i++) fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText("You're Ready")).toBeTruthy();
    fireEvent.click(screen.getByText("Let's Go"));
    expect(onComplete).toHaveBeenCalled();
  });
  it('can be skipped', () => {
    const onSkip = vi.fn();
    render(<Tutorial onComplete={vi.fn()} onSkip={onSkip} />);
    fireEvent.click(screen.getByText('Skip'));
    expect(onSkip).toHaveBeenCalled();
  });
});
