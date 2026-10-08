import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import AvatarFace from './AvatarFace';
import { COUNSEL_AVATARS, JUDGE_AVATARS } from '../lib/avatars';

const html = (rank: number, config = COUNSEL_AVATARS[0]) => renderToStaticMarkup(<AvatarFace config={config} rank={rank} />);
const has = (markup: string, gear: string) => markup.includes(`data-gear="${gear}"`);

describe('rank outfits', () => {
  it('rank 1 is plain', () => {
    const m = html(1);
    for (const g of ['pocket-square', 'pin', 'waistcoat', 'piping', 'gold-lapels', 'medals', 'epaulettes', 'mantle', 'chain', 'cape', 'aura']) {
      expect(has(m, g)).toBe(false);
    }
  });

  it('adds the agreed upgrade at each rank and keeps the earlier ones', () => {
    const unlockedAt: Record<string, number> = {
      'pocket-square': 2,
      pin: 3,
      waistcoat: 4,
      piping: 5,
      'gold-lapels': 6,
      medals: 7,
      epaulettes: 7,
      mantle: 8,
      chain: 9,
      cape: 10,
      aura: 10
    };
    for (let rank = 1; rank <= 10; rank++) {
      const m = html(rank);
      for (const [gear, at] of Object.entries(unlockedAt)) expect(has(m, gear)).toBe(rank >= at);
    }
  });

  it('defaults to the plain look and clamps odd ranks', () => {
    expect(renderToStaticMarkup(<AvatarFace config={COUNSEL_AVATARS[0]} />)).toBe(html(1));
    expect(html(99)).toBe(html(10));
    expect(html(-3)).toBe(html(1));
  });

  it('works on robes and for both versions at every rank', () => {
    for (let rank = 1; rank <= 10; rank++) {
      for (const config of [JUDGE_AVATARS[0], JUDGE_AVATARS[2], COUNSEL_AVATARS[2]]) {
        expect(html(rank, config)).toContain('<svg');
      }
    }
  });
});
