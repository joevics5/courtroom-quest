import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AppDialogHost from './AppDialogHost';
import AppErrorBoundary from './AppErrorBoundary';
import { appAlert, appConfirm } from '../lib/appDialog';

describe('in-app dialogs', () => {
  it('a confirm resolves true when confirmed and false when cancelled', async () => {
    render(<AppDialogHost />);
    let answer: Promise<boolean>;
    act(() => { answer = appConfirm({ title: 'END THE TRIAL?', message: 'This will conclude the case.', confirmLabel: 'END TRIAL', cancelLabel: 'KEEP GOING', tone: 'danger' }); });
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(screen.getByText('END THE TRIAL?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'END TRIAL' }));
    await expect(answer!).resolves.toBe(true);
    expect(screen.queryByRole('alertdialog')).toBeNull();

    act(() => { answer = appConfirm('Sure?'); });
    fireEvent.click(screen.getByRole('button', { name: 'CANCEL' }));
    await expect(answer!).resolves.toBe(false);
  });

  it('a dangerous question starts with the safe button focused, and Escape cancels it', async () => {
    render(<AppDialogHost />);
    let answer: Promise<boolean>;
    act(() => { answer = appConfirm({ message: 'Delete?', confirmLabel: 'DELETE', cancelLabel: 'KEEP IT', tone: 'danger' }); });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'KEEP IT' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    await expect(answer!).resolves.toBe(false);
  });

  it('an alert shows its message and closes with OK', async () => {
    render(<AppDialogHost />);
    let done = false;
    act(() => { appAlert({ title: 'CASE NOT FOUND', message: 'That case could not be found.', tone: 'error' }).then(() => { done = true; }); });
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('That case could not be found.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(done).toBe(true));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows queued dialogs one after the other', async () => {
    render(<AppDialogHost />);
    act(() => { void appAlert('First'); void appAlert('Second'); });
    expect(screen.getByText('First')).toBeTruthy();
    expect(screen.queryByText('Second')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(screen.getByText('Second')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
  });

  it('never leaves a caller hanging when no host is mounted: falls back to the browser box', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    await expect(appConfirm('Fine?')).resolves.toBe(true);
    await appAlert('Heads up');
    expect(confirmSpy).toHaveBeenCalledWith('Fine?');
    expect(alertSpy).toHaveBeenCalledWith('Heads up');
    confirmSpy.mockRestore();
    alertSpy.mockRestore();
  });
});

describe('AppErrorBoundary', () => {
  it('shows an in-game screen instead of a blank page when a screen crashes', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const Boom = () => { throw new Error('boom'); };
    render(<AppErrorBoundary><Boom /></AppErrorBoundary>);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('MISTRIAL')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'RELOAD' })).toBeTruthy();
    errSpy.mockRestore();
  });
  it('renders the app normally when nothing is wrong', () => {
    render(<AppErrorBoundary><p>fine</p></AppErrorBoundary>);
    expect(screen.getByText('fine')).toBeTruthy();
  });
});
