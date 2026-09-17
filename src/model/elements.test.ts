import { describe, expect, it } from 'vitest';
import {
  ACTINIDES,
  ALL_SYMBOLS,
  LANTHANIDES,
  MAIN_BLOCK,
  SINGLE_LETTER_ELEMENTS,
  atomicNumber,
  blockAt,
  elementName,
  isElement,
} from './elements';

describe('element tablosu tutarlılığı', () => {
  it('118 element içerir', () => {
    expect(ALL_SYMBOLS).toHaveLength(118);
  });

  it('atom numaraları bilinen elementlerle uyuşur', () => {
    expect(atomicNumber('H')).toBe(1);
    expect(atomicNumber('C')).toBe(6);
    expect(atomicNumber('Fe')).toBe(26);
    expect(atomicNumber('I')).toBe(53);
    expect(atomicNumber('Au')).toBe(79);
    expect(atomicNumber('U')).toBe(92);
    expect(atomicNumber('Og')).toBe(118);
  });

  it('simgeler benzersizdir', () => {
    expect(new Set(ALL_SYMBOLS).size).toBe(ALL_SYMBOLS.length);
  });

  it('her elementin Türkçe adı vardır', () => {
    const adsiz = ALL_SYMBOLS.filter((s) => elementName(s) === s);
    expect(adsiz).toEqual([]);
  });

  it('yerleşimdeki her simge tabloda tanımlıdır', () => {
    const yerlesim = [...MAIN_BLOCK.flat().filter((s) => s !== null), ...LANTHANIDES, ...ACTINIDES];
    const tanimsiz = yerlesim.filter((s) => !isElement(s));
    expect(tanimsiz).toEqual([]);
  });

  it('her element yerleşimde tam bir kez görünür', () => {
    const yerlesim = [...MAIN_BLOCK.flat().filter((s) => s !== null), ...LANTHANIDES, ...ACTINIDES];
    expect(yerlesim).toHaveLength(118);
    expect(new Set(yerlesim).size).toBe(118);
  });

  it('ana gövde 7 periyot × 18 gruptur', () => {
    expect(MAIN_BLOCK).toHaveLength(7);
    for (const [i, periyot] of MAIN_BLOCK.entries()) {
      expect(periyot, `periyot ${i + 1}`).toHaveLength(18);
    }
  });

  it('f bloğu 14’er elementtir', () => {
    expect(LANTHANIDES).toHaveLength(14);
    expect(ACTINIDES).toHaveLength(14);
  });

  it('periyotlar artan atom numarasıyla ilerler', () => {
    for (const [i, periyot] of MAIN_BLOCK.entries()) {
      const numaralar = periyot.filter((s) => s !== null).map((s) => atomicNumber(s)!);
      const sirali = [...numaralar].sort((a, b) => a - b);
      expect(numaralar, `periyot ${i + 1}`).toEqual(sirali);
    }
  });
});

describe('isElement', () => {
  it('gerçek simgeleri tanır', () => {
    expect(isElement('C')).toBe(true);
    expect(isElement('Cl')).toBe(true);
  });

  it('uydurma simgeleri reddeder', () => {
    // Klavye kısayolunun 'D', 'Q', 'Z' gibi tuşları element sanmasını önler.
    for (const sahte of ['D', 'Q', 'Z', 'J', 'X', 'Xx', '', 'c']) {
      expect(isElement(sahte), sahte).toBe(false);
    }
  });
});

describe('SINGLE_LETTER_ELEMENTS', () => {
  it('yalnızca tek harfli gerçek simgeleri içerir', () => {
    expect(SINGLE_LETTER_ELEMENTS.every((s) => s.length === 1 && isElement(s))).toBe(true);
    expect(SINGLE_LETTER_ELEMENTS).toContain('C');
    expect(SINGLE_LETTER_ELEMENTS).toContain('W');
    expect(SINGLE_LETTER_ELEMENTS).not.toContain('D');
  });
});

describe('blockAt', () => {
  it('blokları doğru sınıflar', () => {
    expect(blockAt(2, 1)).toBe('s'); // Li
    expect(blockAt(4, 8)).toBe('d'); // Fe
    expect(blockAt(2, 14)).toBe('p'); // C
    expect(blockAt(3, 18)).toBe('p'); // Ar
  });

  it('helyumu s bloğunda tutar', () => {
    // Tablonun sağında çizilir ama p bloğu değildir.
    expect(blockAt(1, 18)).toBe('s');
  });
});
