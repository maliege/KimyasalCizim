import { isElement } from '../model/elements';
import type { ToolId } from './editorReducer';

/**
 * Degistirici tusu olmayan klavye girdilerinin cozumlenmesi.
 *
 * Kritik kural: **kucuk harf arac secer, BUYUK harf element secer.**
 * Bu ayrim olmadan 'w' hem kama aracina hem tungstene denk gelirdi; ayni
 * cakisma b/B (bag-bor), s/S (sec-kukurt), h/H (kesikli-hidrojen) icin de
 * var. Once araci deneyip sonra elemente dusmek yetmiyor, cunku arac
 * eslemesi buyuk harfi de yutardi.
 */

/** Kucuk harf kisayollari. Buyuk harfleri bilerek icermez. */
const TOOL_KEYS: Record<string, ToolId> = {
  s: 'select',
  b: 'bond',
  c: 'chain',
  a: 'atom',
  e: 'erase',
  t: 'template',
  g: 'group',
  w: 'wedge',
  h: 'hash',
};

export type KeyAction =
  | { kind: 'tool'; tool: ToolId }
  /** combined: bir onceki buyuk harfle birlesip iki harfli simge oldu */
  | { kind: 'element'; element: string; combined?: boolean }
  | { kind: 'none' };

/** Iki harfli simge icin ikinci harfin beklendigi sure. */
export const COMBINE_WINDOW_MS = 800;

/**
 * @param previous hemen once (COMBINE_WINDOW_MS icinde) basilan tus, varsa.
 *   Buyuk harf + kucuk harf bir element olusturuyorsa (C+l → Cl, N+a → Na)
 *   o secilir — ikinci harf bir arac kisayoluna denk gelse bile, cunku hizla
 *   yazilan bir cift acikca simge kastediyor.
 */
export function resolveKey(key: string, previous?: string): KeyAction {
  if (
    previous &&
    /^[A-Z]$/.test(previous) &&
    /^[a-z]$/.test(key) &&
    isElement(previous + key)
  ) {
    return { kind: 'element', element: previous + key, combined: true };
  }

  const tool = TOOL_KEYS[key];
  if (tool) return { kind: 'tool', tool };

  // Yalniz tek harfli gercek simgeler; aksi halde 'D' veya 'Q' tusu tuvale
  // uydurma bir element koyardi. Iki harfli simgeler yukaridaki birlestirme
  // ile yazilir (C ardindan l → Cl).
  if (/^[A-Z]$/.test(key) && isElement(key)) {
    return { kind: 'element', element: key };
  }

  return { kind: 'none' };
}

/** Yardim metinlerinde gostermek icin arac kisayollari. */
export const TOOL_SHORTCUTS: readonly (readonly [string, ToolId])[] = Object.entries(TOOL_KEYS);
