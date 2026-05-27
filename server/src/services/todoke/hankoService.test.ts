import {
  resolveDisplayName,
  computeLayout,
  generateHankoPng,
} from './hankoService';

// ─── Script detection & display name resolution ────────────────────────────────

describe('resolveDisplayName — script detection', () => {
  it('recognises a pure kanji name as kanji (limit 6)', () => {
    // 4 kanji chars, no space → below limit → full name returned
    const result = resolveDisplayName('田中太郎');
    expect(result).toBe('田中太郎');
  });

  it('recognises a katakana name as kana (limit 10)', () => {
    // 8 katakana chars ≤ 10 → full name returned
    const result = resolveDisplayName('カニティゴウタム');
    expect(result).toBe('カニティゴウタム');
  });

  it('recognises a hiragana name as kana (limit 10)', () => {
    const result = resolveDisplayName('たろう');
    expect(result).toBe('たろう');
  });

  it('recognises a mixed (kanji + kana) name as kana rules', () => {
    // One non-CJK char makes it kana rules
    const result = resolveDisplayName('田中たろう');
    expect(result).toBe('田中たろう');
  });
});

describe('resolveDisplayName — truncation', () => {
  it('uses first word (family name) when kanji name with space exceeds 6 chars', () => {
    // '長谷川太郎一二' = 7 kanji with a space between family and given name
    const result = resolveDisplayName('長谷川 太郎一二');
    // stripped = '長谷川太郎一二' (7 chars) > 6, and there IS a space → first word
    expect(result).toBe('長谷川');
  });

  it('uses first word when kana name with space exceeds 10 chars', () => {
    // 11 katakana chars with a space
    const result = resolveDisplayName('カニティゴウタム アイウ');
    // stripped = 'カニティゴウタムアイウ' = 11 chars > 10, space present → first word
    expect(result).toBe('カニティゴウタム');
  });

  it('uses full name when kanji name WITHOUT space exceeds 6 chars', () => {
    // 7 kanji chars, no space → no truncation possible → full name
    const result = resolveDisplayName('長谷川太郎一二');
    expect(result).toBe('長谷川太郎一二');
  });

  it('uses full name when kana name WITHOUT space exceeds 10 chars', () => {
    // 11 katakana chars, no space
    const result = resolveDisplayName('カニティゴウタムアイウ');
    expect(result).toBe('カニティゴウタムアイウ');
  });

  it('does not truncate when name with space is within limit', () => {
    // '田中 太郎' stripped = '田中太郎' = 4 kanji ≤ 6 → no truncation, return trimmed
    const result = resolveDisplayName('田中 太郎');
    expect(result).toBe('田中 太郎');
  });

  it('trims leading and trailing whitespace', () => {
    const result = resolveDisplayName('  田中  ');
    expect(result).toBe('田中');
  });
});

// ─── Layout calculation ────────────────────────────────────────────────────────

describe('computeLayout — column count', () => {
  it('returns 1 column (x=45) for a 1-character name', () => {
    const { positions } = computeLayout('田');
    expect(positions).toHaveLength(1);
    expect(positions[0].x).toBe(45);
  });

  it('returns 1 column (x=45) for a 2-character name', () => {
    const { positions } = computeLayout('田中');
    expect(positions).toHaveLength(2);
    positions.forEach(p => expect(p.x).toBe(45));
  });

  it('returns 1 column (x=45) for a 3-character name', () => {
    const { positions } = computeLayout('田中山');
    expect(positions).toHaveLength(3);
    positions.forEach(p => expect(p.x).toBe(45));
  });

  it('returns 2 columns for a 4-character name', () => {
    const { positions } = computeLayout('田中太郎');
    expect(positions).toHaveLength(4);
    const xs = new Set(positions.map(p => p.x));
    expect(xs.size).toBe(2);
    expect(xs).toContain(29);
    expect(xs).toContain(61);
  });

  it('returns 2 columns for a 6-character name', () => {
    const { positions } = computeLayout('田中太郎一二');
    expect(positions).toHaveLength(6);
    const xs = new Set(positions.map(p => p.x));
    expect(xs.size).toBe(2);
  });
});

describe('computeLayout — font size', () => {
  it('uses font size 30 for 1-char name', () => {
    expect(computeLayout('田').fontSize).toBe(30);
  });

  it('uses font size 30 for 2-char name', () => {
    expect(computeLayout('田中').fontSize).toBe(30);
  });

  it('uses font size 22 for 3-char name', () => {
    expect(computeLayout('田中山').fontSize).toBe(22);
  });

  it('uses font size 19 for 4-char name', () => {
    expect(computeLayout('田中太郎').fontSize).toBe(19);
  });

  it('uses font size 16 for 5-char name', () => {
    expect(computeLayout('田中太郎一').fontSize).toBe(16);
  });

  it('uses font size 14 for 6-char name', () => {
    expect(computeLayout('田中太郎一二').fontSize).toBe(14);
  });

  it('uses font size 14 for 8-char name', () => {
    expect(computeLayout('田中太郎一二三四').fontSize).toBe(14);
  });

  it('uses font size 12 for 9-char name', () => {
    expect(computeLayout('田中太郎一二三四五').fontSize).toBe(12);
  });
});

describe('computeLayout — character distribution', () => {
  it('right column gets ceil(N/2) chars for 5-char name', () => {
    const { positions } = computeLayout('アイウエオ');
    const rightCol = positions.filter(p => p.x === 61);
    const leftCol = positions.filter(p => p.x === 29);
    expect(rightCol).toHaveLength(3); // ceil(5/2) = 3
    expect(leftCol).toHaveLength(2);  // floor(5/2) = 2
  });

  it('right column gets ceil(N/2) chars for 7-char name', () => {
    const { positions } = computeLayout('アイウエオカキ');
    const rightCol = positions.filter(p => p.x === 61);
    const leftCol = positions.filter(p => p.x === 29);
    expect(rightCol).toHaveLength(4); // ceil(7/2) = 4
    expect(leftCol).toHaveLength(3);  // floor(7/2) = 3
  });

  it('single char uses y=45 (center)', () => {
    const { positions } = computeLayout('田');
    expect(positions[0].y).toBe(45);
  });
});

describe('computeLayout — y positions within circle bounds', () => {
  it('all y positions are within 14–76 for any name length', () => {
    const names = ['田', '田中', '田中山', '田中太郎', 'アイウエオカキクケコ'];
    for (const name of names) {
      const { positions } = computeLayout(name);
      for (const p of positions) {
        expect(p.y).toBeGreaterThanOrEqual(14);
        expect(p.y).toBeLessThanOrEqual(76);
      }
    }
  });
});

// ─── PNG generation smoke test ─────────────────────────────────────────────────

describe('generateHankoPng', () => {
  it('returns a non-empty Buffer for a kanji name', async () => {
    const buf = await generateHankoPng('田中太郎');
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
  });

  it('returns a non-empty Buffer for a katakana name', async () => {
    const buf = await generateHankoPng('カニティゴウタム');
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
  });

  it('returns a PNG (starts with PNG magic bytes)', async () => {
    const buf = await generateHankoPng('山田');
    // PNG magic: 89 50 4E 47 0D 0A 1A 0A
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50); // 'P'
    expect(buf[2]).toBe(0x4e); // 'N'
    expect(buf[3]).toBe(0x47); // 'G'
  });

  it('does not throw for a long name without spaces', async () => {
    await expect(generateHankoPng('長谷川太郎一二')).resolves.toBeDefined();
  });

  it('does not throw for a name with a space that triggers truncation', async () => {
    await expect(generateHankoPng('長谷川 太郎一')).resolves.toBeDefined();
  });
});
