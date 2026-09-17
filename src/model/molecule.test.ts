import { describe, expect, it } from 'vitest';
import {
  addAtom,
  addBond,
  bondOrderSum,
  bondsOf,
  deleteAtom,
  emptyMolecule,
  findBondBetween,
  mergeAtoms,
  neighborsOf,
} from './molecule';
import type { AtomId, Molecule } from './types';

/** Verilen elementlerden zincir kurar: C-C-C … */
function chain(...elements: string[]): { mol: Molecule; ids: AtomId[] } {
  let mol = emptyMolecule();
  const ids: AtomId[] = [];
  elements.forEach((element, i) => {
    const added = addAtom(mol, { element, x: i * 40, y: 0 });
    mol = added.molecule;
    ids.push(added.atomId);
    if (i > 0) mol = addBond(mol, ids[i - 1], ids[i], 1);
  });
  return { mol, ids };
}

describe('addBond', () => {
  it('aynı çift arasında ikinci bağ yerine mevcut olanı günceller', () => {
    const { mol, ids } = chain('C', 'C');
    const updated = addBond(mol, ids[0], ids[1], 2);
    expect(updated.bonds).toHaveLength(1);
    expect(updated.bonds[0].order).toBe(2);
  });

  it('atomu kendine bağlamaz', () => {
    const { mol, ids } = chain('C');
    expect(addBond(mol, ids[0], ids[0], 1)).toBe(mol);
  });
});

describe('deleteAtom', () => {
  it('atoma bağlı bağları da siler', () => {
    const { mol, ids } = chain('C', 'C', 'C');
    const pruned = deleteAtom(mol, ids[1]);
    expect(pruned.atoms).toHaveLength(2);
    expect(pruned.bonds).toHaveLength(0);
  });
});

describe('mergeAtoms', () => {
  it('bağları korunan atoma aktarır', () => {
    // C1-C2   C3-C4  →  C2 ile C3 birleşince zincir olur
    const { mol, ids } = chain('C', 'C');
    const extra = addAtom(mol, { element: 'C', x: 200, y: 0 });
    let m = extra.molecule;
    const last = addAtom(m, { element: 'C', x: 240, y: 0 });
    m = addBond(last.molecule, extra.atomId, last.atomId, 1);

    const merged = mergeAtoms(m, ids[1], extra.atomId);
    expect(merged.atoms).toHaveLength(3);
    expect(neighborsOf(merged, ids[1]).sort()).toEqual([ids[0], last.atomId].sort());
  });

  it('oluşan kendine dönen bağı atar', () => {
    const { mol, ids } = chain('C', 'C');
    const merged = mergeAtoms(mol, ids[0], ids[1]);
    expect(merged.atoms).toHaveLength(1);
    expect(merged.bonds).toHaveLength(0);
  });

  it('tekrarlı bağ oluşturmaz', () => {
    // Ucgen: birleştirince iki kenar aynı çifte düşer
    const { mol, ids } = chain('C', 'C', 'C');
    const triangle = addBond(mol, ids[0], ids[2], 1);

    const merged = mergeAtoms(triangle, ids[0], ids[2]);
    expect(merged.atoms).toHaveLength(2);
    expect(merged.bonds).toHaveLength(1);
    expect(findBondBetween(merged, ids[0], ids[1])).toBeDefined();
  });

  it('aynı atomla birleştirme değişiklik yapmaz', () => {
    const { mol, ids } = chain('C', 'C');
    expect(mergeAtoms(mol, ids[0], ids[0])).toBe(mol);
  });
});

describe('bondOrderSum', () => {
  it('bağ derecelerini toplar', () => {
    const { mol, ids } = chain('C', 'C', 'C');
    const withDouble = addBond(mol, ids[0], ids[1], 2);
    expect(bondOrderSum(withDouble, ids[1])).toBe(3); // ikili + tekli
    expect(bondsOf(withDouble, ids[1])).toHaveLength(2);
  });
});

describe('kimlik üretimi', () => {
  it('silinen kimlikleri yeniden kullanmaz', () => {
    const { mol, ids } = chain('C', 'C');
    const pruned = deleteAtom(mol, ids[1]);
    const added = addAtom(pruned, { element: 'O', x: 0, y: 0 });
    expect(added.atomId).not.toBe(ids[0]);
    expect(added.molecule.atoms.map((a) => a.id)).toHaveLength(2);
  });
});
