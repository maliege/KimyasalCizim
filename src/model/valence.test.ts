import { describe, expect, it } from 'vitest';
import { addAtom, addBond, emptyMolecule, getAtom } from './molecule';
import { buildRing } from './templates';
import { implicitHydrogens, molecularFormula } from './valence';
import type { Molecule } from './types';

/** Tek atomlu molekul yardimcisi */
function lone(element: string, charge = 0): { mol: Molecule; id: string } {
  const { molecule, atomId } = addAtom(emptyMolecule(), { element, x: 0, y: 0, charge });
  return { mol: molecule, id: atomId };
}

const hydrogensOf = (mol: Molecule, id: string) => implicitHydrogens(mol, getAtom(mol, id)!);

describe('implicitHydrogens', () => {
  it('yalnız atomların valansını doldurur', () => {
    const c = lone('C');
    expect(hydrogensOf(c.mol, c.id)).toBe(4); // CH4
    const n = lone('N');
    expect(hydrogensOf(n.mol, n.id)).toBe(3); // NH3
    const o = lone('O');
    expect(hydrogensOf(o.mol, o.id)).toBe(2); // H2O
    const cl = lone('Cl');
    expect(hydrogensOf(cl.mol, cl.id)).toBe(1); // HCl
  });

  it('bağ derecelerini düşer', () => {
    let m = emptyMolecule();
    const a = addAtom(m, { element: 'C', x: 0, y: 0 });
    m = a.molecule;
    const b = addAtom(m, { element: 'C', x: 40, y: 0 });
    m = b.molecule;

    const single = addBond(m, a.atomId, b.atomId, 1);
    expect(hydrogensOf(single, a.atomId)).toBe(3); // etan

    const double = addBond(m, a.atomId, b.atomId, 2);
    expect(hydrogensOf(double, a.atomId)).toBe(2); // eten

    const triple = addBond(m, a.atomId, b.atomId, 3);
    expect(hydrogensOf(triple, a.atomId)).toBe(1); // etin
  });

  it('katyonlarda elektron çiftini bağa çevirir', () => {
    const n = lone('N', 1);
    expect(hydrogensOf(n.mol, n.id)).toBe(4); // NH4+
  });

  it('elektron eksiği olan katyonlarda valansı düşürür', () => {
    const c = lone('C', 1);
    expect(hydrogensOf(c.mol, c.id)).toBe(3); // CH3+
  });

  it('anyonlarda valansı düşürür', () => {
    const o = lone('O', -1);
    expect(hydrogensOf(o.mol, o.id)).toBe(1); // OH-
    const c = lone('C', -1);
    expect(hydrogensOf(c.mol, c.id)).toBe(3); // CH3-
  });

  it('kükürtte yüksek valansa geçer', () => {
    let m = emptyMolecule();
    const s = addAtom(m, { element: 'S', x: 0, y: 0 });
    m = s.molecule;
    // Iki cift bagli oksijen: SO2 -> S'te H kalmaz
    for (const y of [-40, 40]) {
      const o = addAtom(m, { element: 'O', x: 40, y });
      m = addBond(o.molecule, s.atomId, o.atomId, 2);
    }
    expect(hydrogensOf(m, s.atomId)).toBe(0);
  });

  it('bilinmeyen elementte H göstermez', () => {
    const fe = lone('Fe');
    expect(hydrogensOf(fe.mol, fe.id)).toBe(0);
  });
});

describe('molecularFormula', () => {
  it('benzeni C6H6 olarak yazar', () => {
    const benzene = buildRing(emptyMolecule(), { x: 0, y: 0 }, 6, true).molecule;
    expect(molecularFormula(benzene)).toBe('C6H6');
  });

  it('Hill sırasını uygular (C, H, sonra alfabetik)', () => {
    // CH3-O-NH2 (metoksiamin): C'de 3H, O'da 0H, N'de 2H
    let m = emptyMolecule();
    const c = addAtom(m, { element: 'C', x: 0, y: 0 });
    m = c.molecule;
    const o = addAtom(m, { element: 'O', x: 40, y: 0 });
    m = o.molecule;
    const n = addAtom(m, { element: 'N', x: 80, y: 0 });
    m = n.molecule;
    m = addBond(m, c.atomId, o.atomId, 1);
    m = addBond(m, o.atomId, n.atomId, 1);
    expect(molecularFormula(m)).toBe('CH5NO');
  });

  it('karbonsuz molekülde tümünü alfabetik sıralar', () => {
    const { mol } = lone('O');
    expect(molecularFormula(mol)).toBe('H2O');
  });

  it('boş molekülde boş dizge döner', () => {
    expect(molecularFormula(emptyMolecule())).toBe('');
  });
});
