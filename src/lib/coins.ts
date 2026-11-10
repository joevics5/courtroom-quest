/** Coins are virtual: a fee per case and side, paid on a win (see the coins_and_case_fees migration). */

export interface CaseFee {
  prosecution: number;
  defense: number;
  /** The player has already won this case, so the fee shown is the reduced repeat-win payment. */
  repeat: boolean;
}

export type FeeBoard = Record<string, CaseFee>;

interface FeeRow {
  case_id: string;
  prosecution_fee: number | null;
  defense_fee: number | null;
  repeat_win: boolean | null;
}

/** Turns the case_fee_board() rows into a lookup by case id. Anything malformed is skipped. */
export function parseFeeBoard(rows: unknown): FeeBoard {
  const board: FeeBoard = {};
  if (!Array.isArray(rows)) return board;
  for (const row of rows as FeeRow[]) {
    if (!row || typeof row.case_id !== 'string') continue;
    board[row.case_id] = {
      prosecution: Math.max(0, Number(row.prosecution_fee) || 0),
      defense: Math.max(0, Number(row.defense_fee) || 0),
      repeat: !!row.repeat_win
    };
  }
  return board;
}

/** True when there is a payment worth showing on either side. */
export function hasFee(fee: CaseFee | undefined): fee is CaseFee {
  return !!fee && (fee.prosecution > 0 || fee.defense > 0);
}
