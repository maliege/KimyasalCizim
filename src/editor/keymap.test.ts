import { describe, expect, it } from 'vitest';
import { resolveKey } from './keymap';

describe('resolveKey', () => {
  it('küçük harf aracı seçer', () => {
    expect(resolveKey('w')).toEqual({ kind: 'tool', tool: 'wedge' });
    expect(resolveKey('s')).toEqual({ kind: 'tool', tool: 'select' });
    expect(resolveKey('b')).toEqual({ kind: 'tool', tool: 'bond' });
    expect(resolveKey('g')).toEqual({ kind: 'tool', tool: 'group' });
    expect(resolveKey('c')).toEqual({ kind: 'tool', tool: 'chain' });
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
    for (const tus of ['o', 'n', 'q']) {
      expect(resolveKey(tus), tus).toEqual({ kind: 'none' });
    }
  });

  it('harf olmayan tuşları yok sayar', () => {
    for (const tus of ['1', 'Enter', 'ArrowUp', ' ', 'Cl', '']) {
      expect(resolveKey(tus), tus).toEqual({ kind: 'none' });
    }
  });
});

describe('iki harfli simgeler', () => {
  it('büyük harfin ardından gelen küçük harfi birleştirir', () => {
    expect(resolveKey('l', 'C')).toEqual({ kind: 'element', element: 'Cl', combined: true });
    expect(resolveKey('r', 'B')).toEqual({ kind: 'element', element: 'Br', combined: true });
    expect(resolveKey('e', 'F')).toEqual({ kind: 'element', element: 'Fe', combined: true });
  });

  it('ikinci harf araç kısayolu olsa da simge kazanır', () => {
    // 'a' atom aracı, 'g' grup aracı, 'e' silgi — ama Na, Ag, Se birer element.
    expect(resolveKey('a', 'N')).toMatchObject({ element: 'Na' });
    expect(resolveKey('g', 'A')).toMatchObject({ element: 'Ag' });
    expect(resolveKey('e', 'S')).toMatchObject({ element: 'Se' });
  });

  it('tek başına element olmayan büyük harfle de birleşir', () => {
    // 'Z' ve 'M' tek harfli element değil ama Zn ve Mg öyle.
    expect(resolveKey('n', 'Z')).toMatchObject({ element: 'Zn' });
    expect(resolveKey('g', 'M')).toMatchObject({ element: 'Mg' });
  });

  it('element oluşturmayan çiftte normal davranır', () => {
    // "Cq" element değil → 'q' hiçbir şey; "Ca" değil de "Cw" → 'w' kama aracı
    expect(resolveKey('q', 'C')).toEqual({ kind: 'none' });
    expect(resolveKey('w', 'C')).toEqual({ kind: 'tool', tool: 'wedge' });
  });

  it('önceki tuş küçük harfse birleştirmez', () => {
    expect(resolveKey('a', 'n')).toEqual({ kind: 'tool', tool: 'atom' });
  });

  it('önceki tuş yoksa eski davranış', () => {
    expect(resolveKey('a')).toEqual({ kind: 'tool', tool: 'atom' });
    expect(resolveKey('C')).toEqual({ kind: 'element', element: 'C' });
  });
});
