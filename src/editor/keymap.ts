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
  a: 'atom',
  e: 'erase',
  t: 'template',
  g: 'group',
  w: 'wedge',
  h: 'hash',
};

export type KeyAction =
  | { kind: 'tool'; tool: ToolId }
  | { kind: 'element'; element: string }
  | { kind: 'none' };

export function resolveKey(key: string): KeyAction {
  const tool = TOOL_KEYS[key];
  if (tool) return { kind: 'tool', tool };

  // Yalniz tek harfli gercek simgeler; aksi halde 'D' veya 'Q' tusu tuvale
  // uydurma bir element koyardi. Iki harfli simgeler (Cl, Br) bu yolla
  // yazilamaz — palet ya da periyodik tablo uzerinden secilirler.
  if (/^[A-Z]$/.test(key) && isElement(key)) {
    return { kind: 'element', element: key };
  }

  return { kind: 'none' };
}

/** Yardim metinlerinde gostermek icin arac kisayollari. */
export const TOOL_SHORTCUTS: readonly (readonly [string, ToolId])[] = Object.entries(TOOL_KEYS);
