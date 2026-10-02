import { describe, expect, it } from 'vitest';
import { addAtom, addBond, emptyMolecule, getAtom } from './molecule';
import { BOND_LENGTH, distance } from './geometry';
import { buildRing } from './templates';
import { transformAtoms } from './transform';
import type { Molecule } from './types';

/** Ucu kama bagli, üç atomlu kucuk bir yapi. */
function wedged(): Molecule {
  let m = emptyMolecule();
  const a = addAtom(m, { element: 'C', x: 0, y: 0 });
  m = a.molecule;
  const b = addAtom(m, { element: 'C', x: BOND_LENGTH, y: 0 });
  m = b.molecule;
  const c = addAtom(m, { element: 'O', x: BOND_LENGTH * 2, y: 20 });
  m = c.molecule;
  m = addBond(m, a.atomId, b.atomId, 1, 'wedge');
  m = addBond(m, b.atomId, c.atomId, 1, 'hash');
  return m;
}

const lengths = (m: Molecule) =>
  m.bonds.map((bond) => distance(getAtom(m, bond.a1)!, getAtom(m, bond.a2)!));

const closeTo = (a: Molecule, b: Molecule) => {
  a.atoms.forEach((atom, i) => {
    expect(atom.x).toBeCloseTo(b.atoms[i].x, 6);
    expect(atom.y).toBeCloseTo(b.atoms[i].y, 6);
  });
};

describe('döndürme', () => {
  it('bağ uzunluklarını korur', () => {
    const ring = buildRing(emptyMolecule(), { x: 100, y: 100 }, 6, true).molecule;
    const rotated = transformAtoms(ring, [], { kind: 'rotate', degrees: 30 });
    lengths(rotated).forEach((l) => expect(l).toBeCloseTo(BOND_LENGTH, 6));
  });

  it('dört kez 90° dönünce başa döner', () => {
    const m = wedged();
    let r = m;
    for (let i = 0; i < 4; i++) r = transformAtoms(r, [], { kind: 'rotate', degrees: 90 });
    closeTo(r, m);
  });

  it('stereo işaretlerine dokunmaz', () => {
    const r = transformAtoms(wedged(), [], { kind: 'rotate', degrees: 30 });
    expect(r.bonds.map((b) => b.stereo)).toEqual(['wedge', 'hash']);
  });

  it('yalnız seçili atomları döndürür', () => {
    const m = wedged();
    const r = transformAtoms(m, [m.atoms[1].id, m.atoms[2].id], { kind: 'rotate', degrees: 90 });
    expect(r.atoms[0]).toEqual(m.atoms[0]);
    expect(r.atoms[1]).not.toEqual(m.atoms[1]);
  });
});

describe('aynalama', () => {
  it('yatay aynalamada x ağırlık merkezinin öbür yanına geçer', () => {
    const m = wedged();
    const f = transformAtoms(m, [], { kind: 'flip', axis: 'horizontal' });
    // En soldaki atom en sağa gider
    expect(f.atoms[0].x).toBeGreaterThan(f.atoms[2].x);
    expect(f.atoms.map((a) => a.y)).toEqual(m.atoms.map((a) => a.y));
  });

  it('kama ile kesikliyi yer değiştirir (konfigürasyon korunsun)', () => {
    const f = transformAtoms(wedged(), [], { kind: 'flip', axis: 'vertical' });
    expect(f.bonds.map((b) => b.stereo)).toEqual(['hash', 'wedge']);
  });

  it('iki kez aynalayınca stereo dahil başa döner', () => {
    const m = wedged();
    const once = transformAtoms(m, [], { kind: 'flip', axis: 'horizontal' });
    const twice = transformAtoms(once, [], { kind: 'flip', axis: 'horizontal' });
    closeTo(twice, m);
    expect(twice.bonds).toEqual(m.bonds);
  });

  it('seçimin dışına uzanan stereo bağa dokunmaz', () => {
    const m = wedged();
    // Yalnız son iki atom seçili: ilk bağın (kama) bir ucu dışarıda.
    const f = transformAtoms(m, [m.atoms[1].id, m.atoms[2].id], { kind: 'flip', axis: 'vertical' });
    expect(f.bonds.map((b) => b.stereo)).toEqual(['wedge', 'wedge']);
  });
});

it('boş molekülde değişiklik yapmaz', () => {
  const m = emptyMolecule();
  expect(transformAtoms(m, [], { kind: 'rotate', degrees: 90 })).toBe(m);
});
