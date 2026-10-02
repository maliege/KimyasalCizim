import { describe, expect, it } from 'vitest';
import { addAtom, addBond, emptyMolecule, getAtom } from './molecule';
import { buildRing } from './templates';
import { implicitHydrogens, molecularFormula, valenceErrors } from './valence';
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

describe('exceedsValence / valenceErrors', () => {
  /** Merkez atoma n adet tekli bagla karbon baglar. */
  function star(element: string, n: number, charge = 0) {
    let m = emptyMolecule();
    const c = addAtom(m, { element, x: 0, y: 0, charge });
    m = c.molecule;
    for (let i = 0; i < n; i++) {
      const leaf = addAtom(m, { element: 'C', x: 40 * Math.cos(i), y: 40 * Math.sin(i) });
      m = addBond(leaf.molecule, c.atomId, leaf.atomId, 1);
    }
    return { mol: m, id: c.atomId };
  }

  it('beş bağlı karbonu işaretler', () => {
    const { mol, id } = star('C', 5);
    expect(valenceErrors(mol)).toEqual([id]);
  });

  it('dört bağlı karbonu işaretlemez', () => {
    expect(valenceErrors(star('C', 4).mol)).toEqual([]);
  });

  it('amonyum azotunu (N⁺, 4 bağ) işaretlemez', () => {
    expect(valenceErrors(star('N', 4, 1).mol)).toEqual([]);
  });

  it('yüksüz dört bağlı azotu işaretler', () => {
    const { mol, id } = star('N', 4);
    expect(valenceErrors(mol)).toEqual([id]);
  });

  it('çok değerlikli elementlerde en yüksek değerliği kullanır', () => {
    // Kükürt 6 bağa kadar geçerli (sülfonik asit), 7'de hata
    expect(valenceErrors(star('S', 6).mol)).toEqual([]);
    expect(valenceErrors(star('S', 7).mol)).toHaveLength(1);
  });

  it('ikili bağları derecesiyle sayar', () => {
    // C=C=C=C... değil: tek karbona üç ikili bağ = 6 > 4
    let m = emptyMolecule();
    const c = addAtom(m, { element: 'C', x: 0, y: 0 });
    m = c.molecule;
    for (let i = 0; i < 3; i++) {
      const o = addAtom(m, { element: 'O', x: 40 * i, y: 40 });
      m = addBond(o.molecule, c.atomId, o.atomId, 2);
    }
    expect(valenceErrors(m)).toEqual([c.atomId]);
  });

  it('değerliği bilinmeyen metalleri hiç işaretlemez', () => {
    expect(valenceErrors(star('Fe', 6).mol)).toEqual([]);
  });

  it('benzende hata bulmaz', () => {
    const benzene = buildRing(emptyMolecule(), { x: 0, y: 0 }, 6, true).molecule;
    expect(valenceErrors(benzene)).toEqual([]);
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
