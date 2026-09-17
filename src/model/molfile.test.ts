import { describe, expect, it } from 'vitest';
import { addAtom, addBond, emptyMolecule, updateAtom } from './molecule';
import { buildRing } from './templates';
import { fromMolfile, toMolfile } from './molfile';
import type { Molecule } from './types';

function acetate(): Molecule {
  let m = emptyMolecule();
  const c1 = addAtom(m, { element: 'C', x: 0, y: 0 });
  m = c1.molecule;
  const c2 = addAtom(m, { element: 'C', x: 40, y: 0 });
  m = c2.molecule;
  const o1 = addAtom(m, { element: 'O', x: 60, y: -35 });
  m = o1.molecule;
  const o2 = addAtom(m, { element: 'O', x: 60, y: 35, charge: -1 });
  m = o2.molecule;
  m = addBond(m, c1.atomId, c2.atomId, 1);
  m = addBond(m, c2.atomId, o1.atomId, 2);
  m = addBond(m, c2.atomId, o2.atomId, 1);
  m = updateAtom(m, c1.atomId, { isotope: 13 });
  return m;
}

describe('toMolfile', () => {
  it('sayım satırını doğru yazar', () => {
    const mol = buildRing(emptyMolecule(), { x: 0, y: 0 }, 6, true).molecule;
    const lines = toMolfile(mol).split('\n');
    expect(lines[3]).toBe('  6  6  0  0  0  0  0  0  0  0999 V2000');
  });

  it('atom satırında element sütun 32-34 arasında olur', () => {
    const mol = addAtom(emptyMolecule(), { element: 'Cl', x: 0, y: 0 }).molecule;
    const atomLine = toMolfile(mol).split('\n')[4];
    expect(atomLine.slice(31, 34)).toBe('Cl ');
  });

  it('yük ve izotopu M satırlarıyla yazar', () => {
    const text = toMolfile(acetate());
    expect(text).toContain('M  CHG  1   4  -1');
    expect(text).toContain('M  ISO  1   1  13');
    expect(text.trimEnd().endsWith('M  END')).toBe(true);
  });

  it('y eksenini çevirir (tuval aşağı, molfile yukarı)', () => {
    const mol = addAtom(emptyMolecule(), { element: 'C', x: 0, y: 40 }).molecule;
    const atomLine = toMolfile(mol).split('\n')[4];
    expect(Number(atomLine.slice(10, 20))).toBeCloseTo(-1.5, 4);
  });
});

describe('gidiş-dönüş', () => {
  it('asetat yapısını korur', () => {
    const original = acetate();
    const restored = fromMolfile(toMolfile(original));

    expect(restored.atoms).toHaveLength(original.atoms.length);
    expect(restored.bonds).toHaveLength(original.bonds.length);

    original.atoms.forEach((atom, i) => {
      expect(restored.atoms[i].element).toBe(atom.element);
      expect(restored.atoms[i].charge).toBe(atom.charge);
      expect(restored.atoms[i].isotope).toBe(atom.isotope);
      expect(restored.atoms[i].x).toBeCloseTo(atom.x, 2);
      expect(restored.atoms[i].y).toBeCloseTo(atom.y, 2);
    });

    original.bonds.forEach((bond, i) => {
      expect(restored.bonds[i].order).toBe(bond.order);
      expect(restored.bonds[i].stereo).toBe(bond.stereo);
    });
  });

  it('stereo bağları korur', () => {
    let m = emptyMolecule();
    const c = addAtom(m, { element: 'C', x: 0, y: 0 });
    m = c.molecule;
    const f = addAtom(m, { element: 'F', x: 40, y: 0 });
    m = f.molecule;
    const br = addAtom(m, { element: 'Br', x: 0, y: 40 });
    m = br.molecule;
    m = addBond(m, c.atomId, f.atomId, 1, 'wedge');
    m = addBond(m, c.atomId, br.atomId, 1, 'hash');

    const restored = fromMolfile(toMolfile(m));
    expect(restored.bonds.map((b) => b.stereo)).toEqual(['wedge', 'hash']);
  });

  it('boş molekülü işler', () => {
    const restored = fromMolfile(toMolfile(emptyMolecule()));
    expect(restored).toEqual({ atoms: [], bonds: [] });
  });
});

describe('fromMolfile hata durumları', () => {
  it('V3000 dosyasını reddeder', () => {
    const v3000 = ['', '', '', '  0  0  0  0  0  0  0  0  0  0999 V3000'].join('\n');
    expect(() => fromMolfile(v3000)).toThrow(/V3000/);
  });

  it('eksik atom satırında hata verir', () => {
    const truncated = ['', '', '', '  2  0  0  0  0  0  0  0  0  0999 V2000'].join('\n');
    expect(() => fromMolfile(truncated)).toThrow(/Atom satırı eksik/);
  });
});
