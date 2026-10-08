import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import TranscriptMessage, { type TranscriptEvent } from './TranscriptMessage';
import { COUNSEL_AVATARS, JUDGE_AVATARS } from '../lib/avatars';

const avatars = { judge: JUDGE_AVATARS[0], prosecution: COUNSEL_AVATARS[0], defense: COUNSEL_AVATARS[1] };
const ev = (over: Partial<TranscriptEvent>): TranscriptEvent => ({ id: 'e1', speaker_role: 'judge', speaker_name: 'Justice Williams', content: 'Proceed.', ...over });

describe('TranscriptMessage', () => {
  it('shows the speaker, role and text with their face', () => {
    const { container } = render(<TranscriptMessage event={ev({})} avatars={avatars} />);
    expect(screen.getByText('Justice Williams')).toBeTruthy();
    expect(screen.getByText('JUDGE')).toBeTruthy();
    expect(screen.getByText('Proceed.')).toBeTruthy();
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('marks the player\'s own lines with YOU, and only theirs', () => {
    const { rerender } = render(
      <TranscriptMessage event={ev({ speaker_role: 'defense', speaker_name: 'Ada' })} avatars={avatars} playerRole="defense" />
    );
    expect(screen.getByText('YOU')).toBeTruthy();
    rerender(<TranscriptMessage event={ev({ speaker_role: 'prosecution', speaker_name: 'DA Harrison' })} avatars={avatars} playerRole="defense" />);
    expect(screen.queryByText('YOU')).toBeNull();
  });

  it('reads a generic "counsel" line as the prosecutor when the name matches', () => {
    render(<TranscriptMessage event={ev({ speaker_role: 'counsel', speaker_name: 'DA Harrison' })} avatars={avatars} prosecutorName="DA Harrison" playerRole="prosecution" />);
    expect(screen.getByText('YOU')).toBeTruthy();
  });

  it('flags an objection', () => {
    render(<TranscriptMessage event={ev({ speaker_role: 'defense', event_type: 'objection', content: 'Objection!' })} avatars={avatars} />);
    expect(screen.getByText('OBJECTION')).toBeTruthy();
  });

  it('gives a witness a face made from their name, and evidence an icon', () => {
    const { container, rerender } = render(<TranscriptMessage event={ev({ speaker_role: 'witness', speaker_name: 'Maria Lopez' })} avatars={avatars} />);
    expect(screen.getByText('WITNESS')).toBeTruthy();
    expect(container.querySelector('svg[role="img"]')).not.toBeNull();
    rerender(<TranscriptMessage event={ev({ speaker_role: 'defense', event_type: 'evidence_submission', content: 'Exhibit A' })} avatars={avatars} />);
    expect(screen.getByText('EVIDENCE')).toBeTruthy();
  });
});
