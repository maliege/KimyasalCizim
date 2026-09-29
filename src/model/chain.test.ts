import { describe, expect, it } from 'vitest';
import { addAtom, bondsOf, emptyMolecule } from './molecule';
import { BOND_LENGTH, angleBetween, distance } from './geometry';
import { CHAIN_STEP, MAX_CHAIN, buildChain, chainPoints } from './chain';
import { molecularFormula } from './valence';

const O = { x: 0, y: 0 };

describe('chainPoints', () => {
  it('bağ sayısı sürükleme uzunluğuyla artar', () => {
    expect(chainPoints(O, { x: CHAIN_STEP * 1, y: 0 })).toHaveLength(1);
    expect(chainPoints(O, { x: CHAIN_STEP * 4, y: 0 })).toHaveLength(4);
    expect(chainPoints(O, { x: CHAIN_STEP * 7.4, y: 0 })).toHaveLength(7);
  });

  it('hiç sürüklenmezse bile en az bir bağ üretir', () => {
    expect(chainPoints(O, O)).toHaveLength(1);
  });

  it('dev zinciri sınırlar', () => {
    expect(chainPoints(O, { x: 100_000, y: 0 })).toHaveLength(MAX_CHAIN);
  });

  it('her bağ standart uzunlukta', () => {
    const pts = [O, ...chainPoints(O, { x: 300, y: 0 })];
    for (let i = 1; i < pts.length; i++) {
      expect(distance(pts[i - 1], pts[i])).toBeCloseTo(BOND_LENGTH, 6);
    }
  });

  it('ardışık bağlar arası açı 120°', () => {
    const pts = [O, ...chainPoints(O, { x: 300, y: 0 })];
    for (let i = 1; i < pts.length - 1; i++) {
      const back = angleBetween(pts[i], pts[i - 1]);
      const fwd = angleBetween(pts[i], pts[i + 1]);
      let deg = Math.abs(((fwd - back) * 180) / Math.PI) % 360;
      if (deg > 180) deg = 360 - deg;
      expect(deg).toBeCloseTo(120, 6);
    }
  });

  it('zincir sürükleme yönünde ilerler ve zikzak yapar', () => {
    const pts = chainPoints(O, { x: CHAIN_STEP * 6, y: 0 });
    // Ana eksen boyunca düzgün ilerleme
    expect(pts.at(-1)!.x).toBeCloseTo(CHAIN_STEP * 6, 6);
    // Yanal sapma bir yukarı bir aşağı
    const sides = pts.map((p) => Math.sign(Math.round(p.y)));
    expect(sides).toEqual([-1, 0, -1, 0, -1, 0]);
  });

  it('yönü 30° katına yakalar, Shift ile serbest bırakır', () => {
    const hedef = { x: 200, y: 37 }; // ~10.5°
    const yakalanan = chainPoints(O, hedef);
    const serbest = chainPoints(O, hedef, false);
    // Yakalanmış zincirin sonu yatay eksende (0°), serbestinki değil
    expect(yakalanan.at(-1)!.y).toBeCloseTo(0, 6);
    expect(Math.abs(serbest.at(-1)!.y)).toBeGreaterThan(5);
  });
});

describe('buildChain', () => {
  it('başlangıç atomundan tekli bağlarla zincir kurar', () => {
    const start = addAtom(emptyMolecule(), { element: 'C', x: 0, y: 0 });
    const { molecule, atomIds } = buildChain(start.molecule, start.atomId, chainPoints(O, { x: CHAIN_STEP * 4, y: 0 }));

    expect(atomIds).toHaveLength(4);
    expect(molecule.bonds).toHaveLength(4);
    expect(molecule.bonds.every((b) => b.order === 1)).toBe(true);
    expect(molecularFormula(molecule)).toBe('C5H12'); // pentan
    // Uçlar birer, iç atomlar ikişer bağlı
    expect(bondsOf(molecule, start.atomId)).toHaveLength(1);
    expect(bondsOf(molecule, atomIds[1])).toHaveLength(2);
  });

  it('var olan bir heteroatomdan da başlayabilir', () => {
    const o = addAtom(emptyMolecule(), { element: 'O', x: 0, y: 0 });
    const { molecule } = buildChain(o.molecule, o.atomId, chainPoints(O, { x: CHAIN_STEP * 2, y: 0 }));
    expect(molecularFormula(molecule)).toBe('C2H6O'); // etanol
  });
});
