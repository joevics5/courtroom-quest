import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import SpeechToggle from './SpeechToggle';
import { isSpeechMuted, setSpeechMuted } from '../lib/speech';

describe('SpeechToggle', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setSpeechMuted(false);
  });

  it('mutes and unmutes, and says which it is', () => {
    render(<SpeechToggle />);
    const button = screen.getByRole('button', { name: 'Mute voice' });
    expect(button.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(button);
    expect(isSpeechMuted()).toBe(true);
    expect(screen.getByRole('button', { name: 'Turn voice on' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Turn voice on' }));
    expect(isSpeechMuted()).toBe(false);
  });

  it('two toggles (pre-trial and trial) stay in step', () => {
    render(
      <>
        <SpeechToggle />
        <SpeechToggle />
      </>
    );
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(screen.getAllByRole('button', { name: 'Turn voice on' })).toHaveLength(2);
  });
});
