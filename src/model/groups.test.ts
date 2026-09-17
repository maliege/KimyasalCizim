import { describe, expect, it } from 'vitest';
import { addAtom, addBond, bondOrderSum, emptyMolecule, getAtom, neighborsOf } from './molecule';
import { BOND_LENGTH, distance } from './geometry';
import { GROUPS, placeGroup } from './groups';
import { molecularFormula } from './valence';
import type { Molecule } from './types';

/** Tek karbonlu bir dayanak. */
function anchorAtom(): { mol: Molecule; id: string } {
  const { molecule, atomId } = addAtom(emptyMolecule(), { element: 'C', x: 100, y: 100 });
  return { mol: molecule, id: atomId };
}

describe('placeGroup', () => {
  it('grubu dayanak atoma bağlar', () => {
    const { mol, id } = anchorAtom();
    const result = placeGroup(mol, 'hydroxyl', { x: 0, y: 0 }, id);

    expect(result.atoms).toHaveLength(2);
    expect(neighborsOf(result, id)).toHaveLength(1);
    expect(molecularFormula(result)).toBe('CH4O'); // metanol
  });

  it('boş alana bırakılınca karbon iskeleti açar', () => {
    const acetic = placeGroup(emptyMolecule(), 'carboxyl', { x: 50, y: 50 }, null);
    expect(molecularFormula(acetic)).toBe('C2H4O2'); // asetik asit
  });

  it('bilinmeyen grubu yok sayar', () => {
    const { mol, id } = anchorAtom();
    expect(placeGroup(mol, 'yok-boyle', { x: 0, y: 0 }, id)).toBe(mol);
  });

  it('her grupta bağ uzunluklarını korur', () => {
    for (const group of GROUPS) {
      const { mol, id } = anchorAtom();
      const result = placeGroup(mol, group.id, { x: 0, y: 0 }, id);
      const byId = new Map(result.atoms.map((a) => [a.id, a]));

      for (const bond of result.bonds) {
        const length = distance(byId.get(bond.a1)!, byId.get(bond.a2)!);
        expect(length, `${group.id}: ${bond.a1}-${bond.a2}`).toBeCloseTo(BOND_LENGTH, 4);
      }
    }
  });

  it('hiçbir grup dayanak karbonun valansını aşmaz', () => {
    for (const group of GROUPS) {
      const { mol, id } = anchorAtom();
      const result = placeGroup(mol, group.id, { x: 0, y: 0 }, id);
      expect(bondOrderSum(result, id), group.id).toBeLessThanOrEqual(4);
    }
  });
});

describe('grup kimyası', () => {
  it('karboksil doğru yapıyı verir (bir =O, bir -OH)', () => {
    const { mol, id } = anchorAtom();
    const result = placeGroup(mol, 'carboxyl', { x: 0, y: 0 }, id);

    const carbon = neighborsOf(result, id)[0];
    const oxygens = neighborsOf(result, carbon)
      .map((oid) => getAtom(result, oid)!)
      .filter((a) => a.element === 'O');

    expect(oxygens).toHaveLength(2);
    expect(bondOrderSum(result, carbon)).toBe(4);
    // Biri cift bagli (0 H), digeri tekli bagli (1 H)
    expect(oxygens.map((o) => bondOrderSum(result, o.id)).sort()).toEqual([1, 2]);
  });

  it('nitro yüklü azot ve yüklü oksijenle çizilir', () => {
    const { mol, id } = anchorAtom();
    const result = placeGroup(mol, 'nitro', { x: 0, y: 0 }, id);

    const nitrogen = result.atoms.find((a) => a.element === 'N')!;
    expect(nitrogen.charge).toBe(1);
    // Yuk dengesi sifir olmali
    expect(result.atoms.reduce((sum, a) => sum + a.charge, 0)).toBe(0);
    // N⁺ dort bag yapar, hidrojen kalmaz
    expect(bondOrderSum(result, nitrogen.id)).toBe(4);
    expect(molecularFormula(result)).toBe('CH3NO2'); // nitrometan
  });

  it('siyano üçlü bağ kurar', () => {
    const { mol, id } = anchorAtom();
    const result = placeGroup(mol, 'cyano', { x: 0, y: 0 }, id);
    expect(result.bonds.some((b) => b.order === 3)).toBe(true);
    expect(molecularFormula(result)).toBe('C2H3N'); // asetonitril
  });

  it('fenil altıgeni kapatır ve dayanak atomu halkaya katmaz', () => {
    const { mol, id } = anchorAtom();
    const result = placeGroup(mol, 'phenyl', { x: 0, y: 0 }, id);

    expect(result.atoms).toHaveLength(7); // dayanak + 6 halka karbonu
    expect(result.bonds).toHaveLength(7); // 6 halka kenari + baglanti bagi
    // Dayanak atomun halkada tek bir komsusu var — yani halkanin parcasi degil
    expect(neighborsOf(result, id)).toHaveLength(1);
    expect(molecularFormula(result)).toBe('C7H8'); // toluen
  });

  it('fenil halkasında her karbon tam bir ikili bağa girer', () => {
    const { mol, id } = anchorAtom();
    const result = placeGroup(mol, 'phenyl', { x: 0, y: 0 }, id);

    const doubles = new Map<string, number>();
    for (const bond of result.bonds.filter((b) => b.order === 2)) {
      for (const atom of [bond.a1, bond.a2]) {
        doubles.set(atom, (doubles.get(atom) ?? 0) + 1);
      }
    }
    expect(doubles.size).toBe(6);
    expect([...doubles.values()].every((n) => n === 1)).toBe(true);
  });

  it('sülfonik grupta kükürt altı değerlikli olur', () => {
    const { mol, id } = anchorAtom();
    const result = placeGroup(mol, 'sulfo', { x: 0, y: 0 }, id);
    const sulfur = result.atoms.find((a) => a.element === 'S')!;
    expect(bondOrderSum(result, sulfur.id)).toBe(6);
    expect(molecularFormula(result)).toBe('CH4O3S'); // metansülfonik asit
  });
});

describe('yerleşim yönü', () => {
  it('grubu var olan komşulardan uzağa koyar', () => {
    // C1'in solunda bir komsu var; grup saga gitmeli.
    let m = emptyMolecule();
    const left = addAtom(m, { element: 'C', x: 60, y: 100 });
    m = left.molecule;
    const center = addAtom(m, { element: 'C', x: 100, y: 100 });
    m = addBond(center.molecule, left.atomId, center.atomId, 1);

    const result = placeGroup(m, 'hydroxyl', { x: 0, y: 0 }, center.atomId);
    const oxygen = result.atoms.find((a) => a.element === 'O')!;
    expect(oxygen.x).toBeGreaterThan(100);
  });
});
