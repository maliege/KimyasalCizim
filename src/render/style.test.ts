import { describe, expect, it } from 'vitest';
import { addAtom, addBond, emptyMolecule, getAtom } from '../model/molecule';
import { buildRing } from '../model/templates';
import { chargeText, hydrogensGoLeft, isLabelVisible, labelText } from './style';
import type { Molecule } from '../model/types';

/** Merkezde bir O, verilen konumda bir komsu karbon. */
function hydroxylWithNeighborAt(dx: number, dy: number): { mol: Molecule; oxygenId: string } {
  let m = emptyMolecule();
  const o = addAtom(m, { element: 'O', x: 100, y: 100 });
  m = o.molecule;
  const c = addAtom(m, { element: 'C', x: 100 + dx, y: 100 + dy });
  m = addBond(c.molecule, o.atomId, c.atomId, 1);
  return { mol: m, oxygenId: o.atomId };
}

const goesLeft = (dx: number, dy: number) => {
  const { mol, oxygenId } = hydroxylWithNeighborAt(dx, dy);
  return hydrogensGoLeft(mol, getAtom(mol, oxygenId)!);
};

describe('hydrogensGoLeft', () => {
  it('komşu sağdaysa H sola geçer (HO-)', () => {
    expect(goesLeft(40, 0)).toBe(true);
  });

  it('komşu soldaysa H sağda kalır (-OH)', () => {
    expect(goesLeft(-40, 0)).toBe(false);
  });

  it('dikey bağda standart sağ yazımı korur', () => {
    // Bu, kayan nokta gürültüsünün "HO" üretmesini önleyen eşiğin testi.
    expect(goesLeft(0, -40)).toBe(false);
    expect(goesLeft(0, 40)).toBe(false);
    expect(goesLeft(0.01, -40)).toBe(false);
  });

  it('komşusuz atomda sağda kalır', () => {
    const mol = addAtom(emptyMolecule(), { element: 'O', x: 0, y: 0 }).molecule;
    expect(hydrogensGoLeft(mol, mol.atoms[0])).toBe(false);
  });
});

describe('labelText', () => {
  it('örtük hidrojenleri ekler', () => {
    const { mol, oxygenId } = hydroxylWithNeighborAt(40, 0);
    expect(labelText(mol, getAtom(mol, oxygenId)!)).toBe('OH');
  });

  it('hidrojen yoksa yalnız simgeyi yazar', () => {
    let m = emptyMolecule();
    const o = addAtom(m, { element: 'O', x: 0, y: 0 });
    m = o.molecule;
    const c = addAtom(m, { element: 'C', x: 40, y: 0 });
    m = addBond(c.molecule, o.atomId, c.atomId, 2); // karbonil
    expect(labelText(m, getAtom(m, o.atomId)!)).toBe('O');
  });

  it('birden fazla hidrojeni sayıyla yazar', () => {
    const mol = addAtom(emptyMolecule(), { element: 'N', x: 0, y: 0 }).molecule;
    expect(labelText(mol, mol.atoms[0])).toBe('NH3');
  });
});

describe('isLabelVisible', () => {
  it('halkadaki karbonları etiketsiz bırakır', () => {
    const benzene = buildRing(emptyMolecule(), { x: 0, y: 0 }, 6, true).molecule;
    expect(benzene.atoms.every((a) => !isLabelVisible(benzene, a))).toBe(true);
  });

  it('heteroatomları her zaman etiketler', () => {
    const { mol, oxygenId } = hydroxylWithNeighborAt(40, 0);
    expect(isLabelVisible(mol, getAtom(mol, oxygenId)!)).toBe(true);
  });

  it('yalnız duran karbonu etiketler', () => {
    const mol = addAtom(emptyMolecule(), { element: 'C', x: 0, y: 0 }).molecule;
    expect(isLabelVisible(mol, mol.atoms[0])).toBe(true);
  });

  it('C Göster açıkken halka ve zincir karbonlarını da etiketler', () => {
    const benzene = buildRing(emptyMolecule(), { x: 0, y: 0 }, 6, true).molecule;
    expect(benzene.atoms.every((a) => isLabelVisible(benzene, a, true))).toBe(true);
    // Etiket metni hidrojenleriyle birlikte: benzende her karbon CH
    expect(benzene.atoms.map((a) => labelText(benzene, a))).toEqual(Array(6).fill('CH'));
  });

  it('C Göster heteroatomların görünürlüğünü değiştirmez', () => {
    const { mol, oxygenId } = hydroxylWithNeighborAt(40, 0);
    expect(isLabelVisible(mol, getAtom(mol, oxygenId)!, false)).toBe(true);
    expect(isLabelVisible(mol, getAtom(mol, oxygenId)!, true)).toBe(true);
  });

  it('yüklü karbonu etiketler', () => {
    let m = emptyMolecule();
    const c = addAtom(m, { element: 'C', x: 0, y: 0, charge: 1 });
    m = c.molecule;
    const c2 = addAtom(m, { element: 'C', x: 40, y: 0 });
    m = addBond(c2.molecule, c.atomId, c2.atomId, 1);
    expect(isLabelVisible(m, getAtom(m, c.atomId)!)).toBe(true);
  });
});

describe('chargeText', () => {
  it('tekli yükleri işaretle gösterir', () => {
    expect(chargeText(1)).toBe('+');
    expect(chargeText(-1)).toBe('−');
  });

  it('çoklu yüklerde sayıyı öne alır', () => {
    expect(chargeText(2)).toBe('2+');
    expect(chargeText(-3)).toBe('3−');
  });

  it('yüksüzde boş döner', () => {
    expect(chargeText(0)).toBe('');
  });
});
