/** Exhibit A..Z, then Exhibit 27, 28... so cases with more than 26 evidence items still get sane labels. */
export const exhibitLabel = (index: number): string =>
  `Exhibit ${index < 26 ? String.fromCharCode(65 + index) : index + 1}`;
