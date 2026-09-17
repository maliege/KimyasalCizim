import { describe, expect, it } from 'vitest';
import { addAtom, addBond, bondsOf, emptyMolecule } from './molecule';
import { BOND_LENGTH, distance } from './geometry';
import { buildRing, placeTemplate, ringVertices } from './templates';

describe('ringVertices', () => {
  it('kenar uzunluğu BOND_LENGTH olan düzgün çokgen üretir', () => {
    for (const sides of [3, 4, 5, 6, 7]) {
      const vertices = ringVertices(sides, { x: 0, y: 0 });
      expect(vertices).toHaveLength(sides);
      for (let i = 0; i < sides; i++) {
        const edge = distance(vertices[i], vertices[(i + 1) % sides]);
        expect(edge).toBeCloseTo(BOND_LENGTH, 6);
      }
    }
  });
});

describe('buildRing', () => {
  it('halkayı kapatır', () => {
    const { molecule, atomIds } = buildRing(emptyMolecule(), { x: 0, y: 0 }, 6);
    expect(atomIds).toHaveLength(6);
    expect(molecule.bonds).toHaveLength(6);
    // Her atomun halka içinde tam iki komşusu olmali
    for (const id of atomIds) {
      expect(bondsOf(molecule, id)).toHaveLength(2);
    }
  });

  it('aromatik halkada üç ikili bağ dağıtır', () => {
    const { molecule } = buildRing(emptyMolecule(), { x: 0, y: 0 }, 6, true);
    expect(molecule.bonds.filter((b) => b.order === 2)).toHaveLength(3);
  });
});

describe('placeTemplate', () => {
  it('boş alana serbest halka koyar', () => {
    const mol = placeTemplate(emptyMolecule(), 'benzene', { x: 100, y: 100 }, null, null);
    expect(mol.atoms).toHaveLength(6);
    expect(mol.bonds).toHaveLength(6);
  });

  it('bağa kaynaştırınca ortak kenarı paylaşır (naftalin)', () => {
    const first = buildRing(emptyMolecule(), { x: 100, y: 100 }, 6, true);
    const bondId = first.molecule.bonds[0].id;
    const fused = placeTemplate(first.molecule, 'benzene', { x: 0, y: 0 }, null, bondId);

    // 6 + 4 yeni atom; ortak kenarin iki atomu tekrar uretilmez
    expect(fused.atoms).toHaveLength(10);
    // 6 + 5 yeni bag (ortak kenar zaten vardi)
    expect(fused.bonds).toHaveLength(11);
  });

  it('kaynaşan halka ortak kenarı iki kez ikilemez', () => {
    const first = buildRing(emptyMolecule(), { x: 100, y: 100 }, 6, true);
    const fused = placeTemplate(
      first.molecule,
      'benzene',
      { x: 0, y: 0 },
      null,
      first.molecule.bonds[0].id,
    );
    // Naftalinin Kekule formunda her atom en fazla bir ikili baga girer.
    const doubleCount = new Map<string, number>();
    for (const bond of fused.bonds.filter((b) => b.order === 2)) {
      for (const id of [bond.a1, bond.a2]) {
        doubleCount.set(id, (doubleCount.get(id) ?? 0) + 1);
      }
    }
    expect([...doubleCount.values()].every((n) => n === 1)).toBe(true);
  });

  it('kaynaşan halkanın kenarları düzgün uzunlukta kalır', () => {
    const first = buildRing(emptyMolecule(), { x: 100, y: 100 }, 6, true);
    const fused = placeTemplate(
      first.molecule,
      'benzene',
      { x: 0, y: 0 },
      null,
      first.molecule.bonds[0].id,
    );
    const byId = new Map(fused.atoms.map((a) => [a.id, a]));
    for (const bond of fused.bonds) {
      expect(distance(byId.get(bond.a1)!, byId.get(bond.a2)!)).toBeCloseTo(BOND_LENGTH, 4);
    }
  });

  it('atoma bağlayınca o atomu halkanın köşesi yapar', () => {
    let m = emptyMolecule();
    const a = addAtom(m, { element: 'C', x: 100, y: 100 });
    m = a.molecule;
    const b = addAtom(m, { element: 'C', x: 140, y: 100 });
    m = addBond(b.molecule, a.atomId, b.atomId, 1);

    const attached = placeTemplate(m, 'cyclohexane', { x: 0, y: 0 }, b.atomId, null);
    expect(attached.atoms).toHaveLength(2 + 5); // 5 yeni kose
    // Halka atomunun artik 3 bagi var: zincir + halkanin iki kenari
    expect(bondsOf(attached, b.atomId)).toHaveLength(3);
  });

  it('bilinmeyen şablonu yok sayar', () => {
    const mol = emptyMolecule();
    expect(placeTemplate(mol, 'yok-boyle-bir-sey', { x: 0, y: 0 }, null, null)).toBe(mol);
  });
});
