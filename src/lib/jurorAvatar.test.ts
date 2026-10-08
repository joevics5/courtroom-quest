import { describe, it, expect } from 'vitest';
import { resolveJurorAvatar } from './avatars/jurorAvatar';

describe('resolveJurorAvatar', () => {
  it('always gives the same portrait for the same juror id', () => {
    const id = '3f2b8c1e-aaaa-4bbb-8ccc-123456789abc';
    expect(resolveJurorAvatar(id)).toEqual(resolveJurorAvatar(id));
    expect(resolveJurorAvatar(7)).toEqual(resolveJurorAvatar('7'));
  });

  it('gives a varied pool: 50 ids produce many distinct portraits', () => {
    const looks = new Set(
      Array.from({ length: 50 }, (_, i) => JSON.stringify(resolveJurorAvatar(`juror-${i}-uuid`))),
    );
    expect(looks.size).toBeGreaterThan(45);
  });
});
