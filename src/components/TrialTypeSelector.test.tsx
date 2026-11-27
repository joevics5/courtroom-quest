import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

const { getStatus } = vi.hoisted(() => ({ getStatus: vi.fn() }));
vi.mock('../lib/database', () => ({ db: { credits: { getStatus } } }));

import TrialTypeSelector from './TrialTypeSelector';
import type { CreditStatus } from '../lib/credits';

beforeEach(() => { getStatus.mockReset(); getStatus.mockResolvedValue(null); });

const freeStatus: CreditStatus = {
  enforced: true, tier: 'free', allowance: 2, allowance_used: 0.5, allowance_left: 1.5, bonus: 0, remaining: 1.5, resets_at: null,
  allowed_minutes: [5, 10], jury_allowed: false, all_cases_allowed: false, costs: { '5': 1, '10': 1.5, '20': 3, '30': 5 }
};
const proStatus: CreditStatus = { ...freeStatus, tier: 'pro', allowance: 100, allowance_left: 80, remaining: 80, allowed_minutes: [5, 10, 20, 30], jury_allowed: true, all_cases_allowed: true };

const setup = () => {
  const onSelect = vi.fn();
  const onCancel = vi.fn();
  const utils = render(<TrialTypeSelector onSelect={onSelect} onCancel={onCancel} />);
  return { onSelect, onCancel, ...utils };
};

describe('TrialTypeSelector', () => {
  it('shows both courts, all four lengths and the confirm button together on one screen', () => {
    const { container } = setup();
    expect(screen.getByText('BENCH TRIAL')).toBeInTheDocument();
    expect(screen.getByText('JURY TRIAL')).toBeInTheDocument();
    expect(screen.getByText('Lightning')).toBeInTheDocument();
    expect(screen.getByText('Quick Play')).toBeInTheDocument();
    expect(screen.getByText('Short')).toBeInTheDocument();
    expect(screen.getByText('Standard')).toBeInTheDocument();
    expect(screen.queryByText('Full trial')).toBeNull();
    expect(screen.getByRole('button', { name: /PICK A COURT/ })).toBeInTheDocument();
    // the page itself never scrolls: it is exactly one viewport tall and clips overflow
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('h-[100dvh]');
    expect(root.className).toContain('overflow-hidden');
  });

  it('cannot be confirmed until a court is chosen', () => {
    const { onSelect } = setup();
    const confirm = screen.getByRole('button', { name: /PICK A COURT/ });
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('defaults to 30 minutes and sends the chosen court', () => {
    const { onSelect } = setup();
    fireEvent.click(screen.getByText('BENCH TRIAL'));
    fireEvent.click(screen.getByRole('button', { name: /TO THE COURTROOM/ }));
    expect(onSelect).toHaveBeenCalledWith('judge', 30);
  });

  it('sends a jury trial with the chosen length', () => {
    const { onSelect } = setup();
    fireEvent.click(screen.getByText('JURY TRIAL'));
    fireEvent.click(screen.getByText('Short'));
    fireEvent.click(screen.getByRole('button', { name: /PICK YOUR JURY/ }));
    expect(onSelect).toHaveBeenCalledWith('jury', 20);
  });

  it('marks the chosen court and length as pressed, and back cancels', () => {
    const { onCancel } = setup();
    fireEvent.click(screen.getByText('JURY TRIAL'));
    fireEvent.click(screen.getByText('Short'));
    expect(screen.getByText('JURY TRIAL').closest('button')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('BENCH TRIAL').closest('button')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Short').closest('button')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('offers 5, 10, 20 and 30 minutes in one row, with no 15 or 60', async () => {
    const { onSelect } = setup();
    const row = screen.getByText('Quick Play').closest('button')!.parentElement as HTMLElement;
    expect(row.className).toContain('grid-cols-4');
    expect(row.querySelectorAll('button')).toHaveLength(4);
    const labels = Array.from(row.querySelectorAll('button')).map(b => b.textContent);
    expect(labels).toEqual(['5MINLightning', '10MINQuick Play', '20MINShort', '30MINStandard']);
    expect(screen.queryByText('60')).toBeNull();
    expect(screen.queryByText('15')).toBeNull();
    fireEvent.click(screen.getByText('BENCH TRIAL'));
    fireEvent.click(screen.getByText('Quick Play'));
    fireEvent.click(screen.getByRole('button', { name: /TO THE COURTROOM/ }));
    expect(onSelect).toHaveBeenCalledWith('judge', 10);
    // The button is busy while a start is being checked; once it is free again a different length can be sent.
    await waitFor(() => expect(screen.getByRole('button', { name: /TO THE COURTROOM/ })).not.toBeDisabled());
    fireEvent.click(screen.getByText('Lightning'));
    fireEvent.click(screen.getByRole('button', { name: /TO THE COURTROOM/ }));
    expect(onSelect).toHaveBeenLastCalledWith('judge', 5);
  });

  describe('credits and plan limits', () => {
    it('shows what each length costs once the plan is known', async () => {
      getStatus.mockResolvedValue(freeStatus);
      setup();
      await screen.findByTestId('credits-left');
      const row = screen.getByText('Quick Play').closest('button')!.parentElement as HTMLElement;
      const labels = Array.from(row.querySelectorAll('button')).map(b => b.textContent);
      expect(labels).toEqual(['5MINLightning1 credit', '10MINQuick Play1.5 credits', 'PRO20MINShort3 credits', 'PRO30MINStandard5 credits']);
    });

    it('shows no costs, balances or locks while the credit rules are switched off', async () => {
      getStatus.mockResolvedValue({ ...freeStatus, enforced: false });
      setup();
      await waitFor(() => expect(getStatus).toHaveBeenCalled());
      expect(screen.queryByTestId('credits-left')).toBeNull();
      expect(screen.queryByText('PRO')).toBeNull();
      const row = screen.getByText('Quick Play').closest('button')!.parentElement as HTMLElement;
      expect(row.textContent).not.toMatch(/credit/);
      fireEvent.click(screen.getByTestId('length-30'));
      expect(screen.getByTestId('length-30')).toHaveAttribute('aria-pressed', 'true');
    });

    it('shows what is left and leaves everything open for Pro', async () => {
      getStatus.mockResolvedValue(proStatus);
      setup();
      expect(await screen.findByTestId('credits-left')).toHaveTextContent('80 credits left this month');
      expect(screen.queryByText('PRO')).toBeNull();
      fireEvent.click(screen.getByText('JURY TRIAL'));
      fireEvent.click(screen.getByText('Standard'));
      expect(screen.getByTestId('length-30')).toHaveAttribute('aria-pressed', 'true');
    });

    it('marks the 20 and 30 minute trials and jury as Pro for a free player, and starts on 10 minutes', async () => {
      getStatus.mockResolvedValue(freeStatus);
      setup();
      expect(await screen.findByTestId('credits-left')).toHaveTextContent('1.5 credits left today');
      expect(screen.getAllByText('PRO')).toHaveLength(3); // 20, 30 and jury
      await waitFor(() => expect(screen.getByTestId('length-10')).toHaveAttribute('aria-pressed', 'true'));
    });

    it('opens the Pro prompt instead of selecting a locked length or the jury', async () => {
      getStatus.mockResolvedValue(freeStatus);
      const { onSelect } = setup();
      await screen.findByTestId('credits-left');
      fireEvent.click(screen.getByTestId('length-30'));
      expect(screen.getByRole('dialog', { name: 'PRO TRIALS' })).toBeInTheDocument();
      expect(screen.getByTestId('length-30')).toHaveAttribute('aria-pressed', 'false');
      fireEvent.click(screen.getByRole('button', { name: 'Maybe later' }));
      expect(screen.queryByRole('dialog')).toBeNull();
      fireEvent.click(screen.getByText('JURY TRIAL'));
      expect(screen.getByRole('dialog', { name: 'JURY TRIALS ARE PRO' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'GO PRO' })).toBeInTheDocument();
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('asks a guest to make a free account instead of offering Pro', async () => {
      getStatus.mockResolvedValue({ ...freeStatus, tier: 'guest', allowance: 3, remaining: 3 });
      const onCreateAccount = vi.fn();
      render(<TrialTypeSelector onSelect={vi.fn()} onCancel={vi.fn()} onCreateAccount={onCreateAccount} />);
      await screen.findByTestId('credits-left');
      fireEvent.click(screen.getByTestId('length-20'));
      expect(screen.queryByRole('button', { name: 'GO PRO' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'CREATE A FREE ACCOUNT' }));
      expect(onCreateAccount).toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('explains a refusal from the server (out of credits) instead of moving on', async () => {
      getStatus.mockResolvedValue(freeStatus);
      const onSelect = vi.fn().mockResolvedValue({ ok: false, error: 'no_credits', tier: 'free', cost: 1.5, remaining: 0.5, resets_at: null });
      render(<TrialTypeSelector onSelect={onSelect} onCancel={vi.fn()} />);
      await screen.findByTestId('credits-left');
      fireEvent.click(screen.getByText('BENCH TRIAL'));
      fireEvent.click(screen.getByTestId('length-10'));
      fireEvent.click(screen.getByRole('button', { name: /TO THE COURTROOM/ }));
      expect(onSelect).toHaveBeenCalledWith('judge', 10);
      const dialog = await screen.findByRole('dialog', { name: 'OUT OF CREDITS' });
      expect(dialog).toHaveTextContent('needs 1.5');
      expect(dialog).toHaveTextContent('you have 0.5');
    });

    it('shows nothing extra when the trial starts', async () => {
      getStatus.mockResolvedValue(freeStatus);
      const onSelect = vi.fn().mockResolvedValue({ ok: true, charged: 1.5, remaining: 0, tier: 'free', already_charged: false });
      render(<TrialTypeSelector onSelect={onSelect} onCancel={vi.fn()} />);
      await screen.findByTestId('credits-left');
      fireEvent.click(screen.getByText('BENCH TRIAL'));
      fireEvent.click(screen.getByRole('button', { name: /TO THE COURTROOM/ }));
      await waitFor(() => expect(onSelect).toHaveBeenCalled());
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});
