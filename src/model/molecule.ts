import type { Atom, AtomId, Bond, BondId, BondOrder, BondStereo, Molecule } from './types';

/**
 * Molekul uzerinde saf (mutasyonsuz) islemler. Her fonksiyon yeni bir
 * Molecule doner; reducer bunlari zincirleyerek undo/redo icin anlik
 * goruntuler biriktirir.
 */

export const emptyMolecule = (): Molecule => ({ atoms: [], bonds: [] });

/**
 * Yeni kimlik uretir. Var olan en buyuk sayidan bir fazlasini kullanir —
 * boylece testlerde deterministik, ve .mol iceri aktariminda catisma olmaz.
 */
function nextId(existing: { id: string }[], prefix: 'a' | 'b'): string {
  let max = 0;
  for (const item of existing) {
    const n = Number(item.id.slice(prefix.length));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${prefix}${max + 1}`;
}

export function addAtom(
  mol: Molecule,
  init: { element: string; x: number; y: number; charge?: number; isotope?: number },
): { molecule: Molecule; atomId: AtomId } {
  const atom: Atom = {
    id: nextId(mol.atoms, 'a'),
    element: init.element,
    x: init.x,
    y: init.y,
    charge: init.charge ?? 0,
    ...(init.isotope !== undefined ? { isotope: init.isotope } : {}),
  };
  return { molecule: { ...mol, atoms: [...mol.atoms, atom] }, atomId: atom.id };
}

export function addBond(
  mol: Molecule,
  a1: AtomId,
  a2: AtomId,
  order: BondOrder = 1,
  stereo: BondStereo = 'none',
): Molecule {
  if (a1 === a2) return mol;
  // Ayni cift arasinda ikinci bir bag olusturmak yerine var olani guncelle.
  const existing = findBondBetween(mol, a1, a2);
  if (existing) {
    return updateBond(mol, existing.id, { order, stereo });
  }
  const bond: Bond = { id: nextId(mol.bonds, 'b'), a1, a2, order, stereo };
  return { ...mol, bonds: [...mol.bonds, bond] };
}

export function updateAtom(mol: Molecule, id: AtomId, patch: Partial<Omit<Atom, 'id'>>): Molecule {
  return {
    ...mol,
    atoms: mol.atoms.map((a) => (a.id === id ? { ...a, ...patch } : a)),
  };
}

export function updateBond(mol: Molecule, id: BondId, patch: Partial<Omit<Bond, 'id'>>): Molecule {
  return {
    ...mol,
    bonds: mol.bonds.map((b) => (b.id === id ? { ...b, ...patch } : b)),
  };
}

export function moveAtom(mol: Molecule, id: AtomId, x: number, y: number): Molecule {
  return updateAtom(mol, id, { x, y });
}

/** Atomu ve ona bagli tum baglari siler. */
export function deleteAtom(mol: Molecule, id: AtomId): Molecule {
  return {
    atoms: mol.atoms.filter((a) => a.id !== id),
    bonds: mol.bonds.filter((b) => b.a1 !== id && b.a2 !== id),
  };
}

export function deleteBond(mol: Molecule, id: BondId): Molecule {
  return { ...mol, bonds: mol.bonds.filter((b) => b.id !== id) };
}

/** Birden fazla atomu ve baglarini tek islemde siler. */
export function deleteAtoms(mol: Molecule, ids: AtomId[]): Molecule {
  if (ids.length === 0) return mol;
  const doomed = new Set(ids);
  return {
    atoms: mol.atoms.filter((a) => !doomed.has(a.id)),
    bonds: mol.bonds.filter((b) => !doomed.has(b.a1) && !doomed.has(b.a2)),
  };
}

/** Verilen atomlari topluca oteler (grup surukleme). */
export function translateAtoms(
  mol: Molecule,
  ids: AtomId[],
  dx: number,
  dy: number,
): Molecule {
  if (ids.length === 0) return mol;
  const moving = new Set(ids);
  return {
    ...mol,
    atoms: mol.atoms.map((a) => (moving.has(a.id) ? { ...a, x: a.x + dx, y: a.y + dy } : a)),
  };
}

/**
 * Secili atomlarin olusturdugu alt grafigi ayri bir molekul olarak cikarir.
 * Yalniz iki ucu da secimde olan baglar tasinir.
 */
export function extractFragment(mol: Molecule, ids: AtomId[]): Molecule {
  const kept = new Set(ids);
  return {
    atoms: mol.atoms.filter((a) => kept.has(a.id)),
    bonds: mol.bonds.filter((b) => kept.has(b.a1) && kept.has(b.a2)),
  };
}

/**
 * Fragmani yeni kimliklerle molekule ekler (yapistirma, sablon kopyalama).
 * @returns olusan molekul ve eklenen atomlarin yeni kimlikleri
 */
export function insertFragment(
  mol: Molecule,
  fragment: Molecule,
  offset: { x: number; y: number } = { x: 0, y: 0 },
): { molecule: Molecule; atomIds: AtomId[] } {
  let current = mol;
  // Eski kimlikten yeni kimlige — baglari yeniden baglamak icin.
  const remap = new Map<AtomId, AtomId>();

  for (const atom of fragment.atoms) {
    const added = addAtom(current, {
      element: atom.element,
      x: atom.x + offset.x,
      y: atom.y + offset.y,
      charge: atom.charge,
      isotope: atom.isotope,
    });
    current = added.molecule;
    remap.set(atom.id, added.atomId);
  }

  for (const bond of fragment.bonds) {
    const a1 = remap.get(bond.a1);
    const a2 = remap.get(bond.a2);
    if (!a1 || !a2) continue;
    current = addBond(current, a1, a2, bond.order, bond.stereo);
  }

  return { molecule: current, atomIds: [...remap.values()] };
}

/** Dikdortgen icinde kalan atomlarin kimlikleri (kutu secimi). */
export function atomsInRect(
  mol: Molecule,
  rect: { x1: number; y1: number; x2: number; y2: number },
): AtomId[] {
  const left = Math.min(rect.x1, rect.x2);
  const right = Math.max(rect.x1, rect.x2);
  const top = Math.min(rect.y1, rect.y2);
  const bottom = Math.max(rect.y1, rect.y2);

  return mol.atoms
    .filter((a) => a.x >= left && a.x <= right && a.y >= top && a.y <= bottom)
    .map((a) => a.id);
}

/**
 * `dropId` atomunu `keepId` icine eritir (surukleyip birakma yapismasi).
 * Kopan baglar keepId'ye baglanir; olusan tekrarli ve kendine donen
 * baglar temizlenir.
 */
export function mergeAtoms(mol: Molecule, keepId: AtomId, dropId: AtomId): Molecule {
  if (keepId === dropId) return mol;

  const rewired = mol.bonds.map((b) => ({
    ...b,
    a1: b.a1 === dropId ? keepId : b.a1,
    a2: b.a2 === dropId ? keepId : b.a2,
  }));

  const seen = new Set<string>();
  const bonds: Bond[] = [];
  for (const b of rewired) {
    if (b.a1 === b.a2) continue; // kendine donen bag
    const key = [b.a1, b.a2].sort().join('|');
    if (seen.has(key)) continue; // tekrarli bag
    seen.add(key);
    bonds.push(b);
  }

  return { atoms: mol.atoms.filter((a) => a.id !== dropId), bonds };
}

// --- sorgular ---

export const getAtom = (mol: Molecule, id: AtomId): Atom | undefined =>
  mol.atoms.find((a) => a.id === id);

export const getBond = (mol: Molecule, id: BondId): Bond | undefined =>
  mol.bonds.find((b) => b.id === id);

export function findBondBetween(mol: Molecule, a1: AtomId, a2: AtomId): Bond | undefined {
  return mol.bonds.find(
    (b) => (b.a1 === a1 && b.a2 === a2) || (b.a1 === a2 && b.a2 === a1),
  );
}

export const bondsOf = (mol: Molecule, id: AtomId): Bond[] =>
  mol.bonds.filter((b) => b.a1 === id || b.a2 === id);

export const otherEnd = (bond: Bond, id: AtomId): AtomId => (bond.a1 === id ? bond.a2 : bond.a1);

export const neighborsOf = (mol: Molecule, id: AtomId): AtomId[] =>
  bondsOf(mol, id).map((b) => otherEnd(b, id));

/** Bir atomun baglarindaki toplam derece (ortuk H hesabinda kullanilir). */
export const bondOrderSum = (mol: Molecule, id: AtomId): number =>
  bondsOf(mol, id).reduce((sum, b) => sum + b.order, 0);
