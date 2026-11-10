import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import PathTile from './PathTile';

describe('PathTile', () => {
  it('shows the title and icon only, with the icon as tall as the title text', () => {
    const onClick = vi.fn();
    render(<PathTile onClick={onClick} icon={<svg data-testid="icon" />} iconBg="bg-blue-600" title="CASE BOARD" />);
    const button = screen.getByRole('button', { name: /CASE BOARD/ });
    const title = screen.getByText('CASE BOARD');
    // The title is text-3xl with no extra line height (1.875rem); the icon box is the same height.
    expect(title.className).toContain('text-3xl');
    expect(title.className).toContain('leading-none');
    const iconBox = screen.getByTestId('icon').parentElement!;
    expect(iconBox.className).toContain('h-[1.875rem]');
    expect(iconBox.className).toContain('w-[1.875rem]');
    // Nothing but the icon box, the title and the chevron: no description line.
    expect(button.querySelectorAll('p').length).toBe(0);
    expect(button.textContent).toBe('CASE BOARD');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('keeps the badge', () => {
    render(<PathTile onClick={() => undefined} icon={<svg />} iconBg="bg-red-600" title="CHALLENGE" badge="LIVE 1V1" />);
    expect(screen.getByText('LIVE 1V1')).toBeTruthy();
  });
});
