// Jurors' personality_traits and biases are stored as jsonb and exist in two
// shapes: a plain list of strings (["methodical", "by-the-book"]) and the
// object form the live pool uses ({"patient": true, "system_skepticism": "medium"}).
// This turns either shape into readable phrases for prompts and UI.

function humanize(key: string): string {
  return key.replace(/[_-]+/g, ' ').trim();
}

export function describeJurorTraits(value: unknown): string[] {
  if (value == null) return [];

  if (Array.isArray(value)) {
    return value
      .filter((v): v is string | number => typeof v === 'string' || typeof v === 'number')
      .map(v => String(v).trim())
      .filter(Boolean);
  }

  if (typeof value === 'object') {
    const out: string[] = [];
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === false || v == null || v === '') continue;
      const label = humanize(key);
      if (!label) continue;
      out.push(typeof v === 'string' || typeof v === 'number' ? `${label} (${v})` : label);
    }
    return out;
  }

  if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
  return [];
}
