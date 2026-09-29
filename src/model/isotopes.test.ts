import { describe, expect, it } from 'vitest';
import { hasCommonIsotopes, nextIsotope } from './isotopes';

describe('nextIsotope', () => {
  it('karbonda doğal → 13 → 14 → doğal döner', () => {
    expect(nextIsotope('C', undefined)).toBe(13);
    expect(nextIsotope('C', 13)).toBe(14);
    expect(nextIsotope('C', 14)).toBeUndefined();
  });

  it('tek izotoplu elementte doğal ↔ izotop gidip gelir', () => {
    expect(nextIsotope('N', undefined)).toBe(15);
    expect(nextIsotope('N', 15)).toBeUndefined();
  });

  it('listede olmayan izotoptan doğala döner', () => {
    // Örneğin .mol dosyasından gelen ¹¹C
    expect(nextIsotope('C', 11)).toBeUndefined();
  });

  it('izotop tablosunda olmayan elementte değeri değiştirmez', () => {
    expect(nextIsotope('Fe', undefined)).toBeUndefined();
    expect(nextIsotope('Fe', 56)).toBe(56);
    expect(hasCommonIsotopes('Fe')).toBe(false);
  });

  it('hidrojende döteryum ve trityum', () => {
    expect(nextIsotope('H', undefined)).toBe(2);
    expect(nextIsotope('H', 2)).toBe(3);
  });
});
