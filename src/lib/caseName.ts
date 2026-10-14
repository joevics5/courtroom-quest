/** "The Conspiracy" -> "The Conspiracy case" (left alone if the title already ends in "case"). */
export function withCaseSuffix(title: string): string {
  const t = (title || '').trim();
  if (!t) return 'the case';
  return /\bcase$/i.test(t) ? t : `${t} case`;
}
