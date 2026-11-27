import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const { startProCheckout } = vi.hoisted(() => ({ startProCheckout: vi.fn() }));
vi.mock('../lib/credits', () => ({ startProCheckout }));

import UpgradePrompt from './UpgradePrompt';

const setup = (over: Partial<React.ComponentProps<typeof UpgradePrompt>> = {}) => {
  const props = { title: 'OUT OF CREDITS', message: 'Come back tomorrow.', canUpgrade: true, needsAccount: false, onCreateAccount: vi.fn(), onClose: vi.fn(), openCheckout: vi.fn(), ...over };
  render(<UpgradePrompt {...props} />);
  return props;
};

describe('UpgradePrompt', () => {
  it('lists what Pro includes and opens Paystack\'s page for Go Pro', async () => {
    startProCheckout.mockResolvedValue({ url: 'https://checkout.paystack.com/abc' });
    const props = setup();
    expect(screen.getByRole('list', { name: 'What Pro includes' })).toHaveTextContent('100 credits every month');
    fireEvent.click(screen.getByRole('button', { name: 'GO PRO' }));
    await waitFor(() => expect(props.openCheckout).toHaveBeenCalledWith('https://checkout.paystack.com/abc'));
  });

  it('sends a guest to make an account, even if the server says an account is needed', async () => {
    startProCheckout.mockResolvedValue({ error: 'account_required' });
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: 'GO PRO' }));
    await waitFor(() => expect(props.onCreateAccount).toHaveBeenCalled());
  });

  it('says so when payments are not open yet or something went wrong, and lets the player try again', async () => {
    startProCheckout.mockResolvedValueOnce({ error: 'not_ready' });
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'GO PRO' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Payments are not open yet');
    startProCheckout.mockResolvedValueOnce({ error: 'failed' });
    fireEvent.click(screen.getByRole('button', { name: 'GO PRO' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent("couldn't open the payment page"));
  });

  it('shows only the account button for a guest and no Pro perks', () => {
    setup({ canUpgrade: false, needsAccount: true });
    expect(screen.getByRole('button', { name: 'CREATE A FREE ACCOUNT' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'GO PRO' })).toBeNull();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('closes from Maybe later, the X and Escape', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Maybe later' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalledTimes(3);
  });
});
