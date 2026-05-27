import { Resvg } from '@resvg/resvg-js';

// ─── Script detection ──────────────────────────────────────────────────────────

/** Returns true if every character in str is in the CJK Unified Ideographs block (U+4E00–U+9FFF). */
function isAllKanji(str: string): boolean {
  if (str.length === 0) return false;
  for (const ch of str) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x4e00 || cp > 0x9fff) return false;
  }
  return true;
}

// ─── Display name resolution ───────────────────────────────────────────────────

/**
 * Determines the string to render inside the hanko.
 *
 * Rules:
 * - Strip spaces, detect script (kanji vs kana/other).
 * - If the name (trimmed) has a space AND the full stripped name exceeds the
 *   character limit, use only the first space-delimited word (family name).
 * - If there is no space in the name, always use the full name regardless of
 *   character count.
 */
export function resolveDisplayName(nameJa: string): string {
  const trimmed = nameJa.trim();
  const stripped = trimmed.replace(/\s+/g, '');

  const allKanji = isAllKanji(stripped);
  const limit = allKanji ? 6 : 10;

  if (stripped.length > limit && trimmed.includes(' ')) {
    // Take first word (family name in Japanese order)
    return trimmed.split(/\s+/)[0];
  }

  return trimmed;
}

// ─── Layout calculation ────────────────────────────────────────────────────────

export interface CharPosition {
  char: string;
  x: number;
  y: number;
}

export interface HankoLayout {
  positions: CharPosition[];
  fontSize: number;
}

/**
 * Evenly distributes `count` characters along the y-axis within the usable
 * circle height (y=14 to y=76).
 */
function yPositions(count: number): number[] {
  if (count === 1) return [45];
  const top = 14;
  const bottom = 76;
  return Array.from({ length: count }, (_, i) => top + (i * (bottom - top)) / (count - 1));
}

/**
 * Computes x/y positions and font size for each character of the display name.
 *
 * Column reading order (Japanese vertical text convention):
 *   right column top→bottom first, then left column top→bottom.
 * Character assignment:
 *   right column = ceil(N/2) chars, left column = floor(N/2) chars.
 */
export function computeLayout(displayName: string): HankoLayout {
  const chars = [...displayName]; // handles surrogate pairs
  const N = chars.length;

  // ── 1-column layouts ──────────────────────────────────────────────────────
  if (N <= 3) {
    const fontSize = N <= 2 ? 30 : 22;
    const ys = yPositions(N);
    const positions: CharPosition[] = chars.map((char, i) => ({
      char,
      x: 45,
      y: ys[i],
    }));
    return { positions, fontSize };
  }

  // ── 2-column layouts ─────────────────────────────────────────────────────
  let fontSize: number;
  if (N === 4) fontSize = 19;
  else if (N === 5) fontSize = 16;
  else if (N === 6) fontSize = 14;
  else if (N <= 8) fontSize = 14;
  else fontSize = 12; // 9–10

  const rightCount = Math.ceil(N / 2);
  const leftCount = Math.floor(N / 2);

  // Characters in reading order: right col first, then left col
  const rightChars = chars.slice(0, rightCount);
  const leftChars = chars.slice(rightCount);

  const rightYs = yPositions(rightCount);
  const leftYs = yPositions(leftCount);

  const positions: CharPosition[] = [
    ...rightChars.map((char, i) => ({ char, x: 61, y: rightYs[i] })),
    ...leftChars.map((char, i) => ({ char, x: 29, y: leftYs[i] })),
  ];

  return { positions, fontSize };
}

// ─── SVG builder ───────────────────────────────────────────────────────────────

function buildSvg(layout: HankoLayout): string {
  const { positions, fontSize } = layout;

  const textElements = positions
    .map(
      ({ char, x, y }) =>
        `  <text x="${x}" y="${y}" font-family="'Hiragino Mincho ProN','MS Mincho',serif" font-size="${fontSize}" fill="#cc0000" text-anchor="middle" dominant-baseline="middle">${escapeXml(char)}</text>`,
    )
    .join('\n');

  return [
    `<svg width="90" height="90" viewBox="0 0 90 90" xmlns="http://www.w3.org/2000/svg">`,
    `  <circle cx="45" cy="45" r="40" fill="none" stroke="#cc0000" stroke-width="3.5"/>`,
    `  <circle cx="45" cy="45" r="35" fill="none" stroke="#cc0000" stroke-width="1"/>`,
    textElements,
    `</svg>`,
  ].join('\n');
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Generates a red Japanese hanko (personal seal) as a PNG buffer with a
 * transparent background.
 *
 * @param nameJa - Japanese name string (kanji, kana, or mixed).
 * @returns PNG buffer at 180×180 px (2× of the 90×90 viewBox).
 */
export async function generateHankoPng(nameJa: string): Promise<Buffer> {
  const displayName = resolveDisplayName(nameJa);
  const layout = computeLayout(displayName);
  const svg = buildSvg(layout);

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 180 },
  });
  const pngData = resvg.render();
  return pngData.asPng();
}
