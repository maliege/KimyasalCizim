import { describe, expect, it } from 'vitest';
import { resolveKey } from './keymap';

describe('resolveKey', () => {
  it('küçük harf aracı seçer', () => {
    expect(resolveKey('w')).toEqual({ kind: 'tool', tool: 'wedge' });
    expect(resolveKey('s')).toEqual({ kind: 'tool', tool: 'select' });
    expect(resolveKey('b')).toEqual({ kind: 'tool', tool: 'bond' });
    expect(resolveKey('g')).toEqual({ kind: 'tool', tool: 'group' });
  });

  it('BÜYÜK harf elementi seçer', () => {
    expect(resolveKey('C')).toEqual({ kind: 'element', element: 'C' });
    expect(resolveKey('O')).toEqual({ kind: 'element', element: 'O' });
  });

  it('araç kısayolu ile çakışan elementleri gölgelemez', () => {
    // Asıl hata buydu: araç eşlemesi küçük/büyük harf ayırmadan
    // bakıldığı için 'W' tungsten yerine kama aracına düşüyordu.
    const cakisanlar: [string, string][] = [
      ['W', 'W'], // kama ↔ tungsten
      ['B', 'B'], // bağ ↔ bor
      ['S', 'S'], // seç ↔ kükürt
      ['H', 'H'], // kesikli ↔ hidrojen
    ];
    for (const [tus, element] of cakisanlar) {
      expect(resolveKey(tus), tus).toEqual({ kind: 'element', element });
    }
  });

  it('element olmayan harfleri yok sayar', () => {
    for (const tus of ['D', 'Q', 'Z', 'J', 'X', 'R', 'L']) {
      expect(resolveKey(tus), tus).toEqual({ kind: 'none' });
    }
  });

  it('araç olmayan küçük harfleri yok sayar', () => {
    // Küçük harf hiçbir zaman element seçmemeli.
    for (const tus of ['c', 'o', 'n', 'q']) {
      expect(resolveKey(tus), tus).toEqual({ kind: 'none' });
    }
  });

  it('harf olmayan tuşları yok sayar', () => {
    for (const tus of ['1', 'Enter', 'ArrowUp', ' ', 'Cl', '']) {
      expect(resolveKey(tus), tus).toEqual({ kind: 'none' });
    }
  });
});
