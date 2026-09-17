import { addAtom, addBond, getAtom, getBond, neighborsOf } from './molecule';
import { BOND_LENGTH, angleBetween, distance, pointAt } from './geometry';
import type { AtomId, BondId, Molecule } from './types';
import type { Point } from './geometry';

/**
 * Hazir yapi sablonlari. Hepsi var olan bir molekule *eklenir* —
 * bos tuvale de var olan bir yapinin yanina da uygulanabilir.
 */

export type Template = {
  id: string;
  label: string;
  /** Halka kose sayisi — kaynastirma hesaplarinda kullanilir. */
  sides: number;
  /** Bir atlamali ikili baglarla (Kekule) cizilsin mi? */
  aromatic: boolean;
  /** Sablonu bos alana ekler, olusan atom kimliklerini doner. */
  build: (mol: Molecule, center: Point) => { molecule: Molecule; atomIds: AtomId[] };
};

/** Duzgun n-genin kose koordinatlari. Bag uzunlugu BOND_LENGTH olacak sekilde olceklenir. */
export function ringVertices(sides: number, center: Point, rotation = -Math.PI / 2): Point[] {
  // Duzgun cokgende kenar = 2 * R * sin(pi/n)
  const radius = BOND_LENGTH / (2 * Math.sin(Math.PI / sides));
  return Array.from({ length: sides }, (_, i) => {
    const angle = rotation + (i * 2 * Math.PI) / sides;
    return {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    };
  });
}

/**
 * Karbon halkasi ekler.
 * @param aromatic true ise bir atlamali ikili baglarla (Kekule) cizilir
 */
export function buildRing(
  mol: Molecule,
  center: Point,
  sides: number,
  aromatic = false,
): { molecule: Molecule; atomIds: AtomId[] } {
  let current = mol;
  const atomIds: AtomId[] = [];

  for (const vertex of ringVertices(sides, center)) {
    const added = addAtom(current, { element: 'C', x: vertex.x, y: vertex.y });
    current = added.molecule;
    atomIds.push(added.atomId);
  }

  for (let i = 0; i < atomIds.length; i++) {
    const next = (i + 1) % atomIds.length;
    current = addBond(current, atomIds[i], atomIds[next], aromatic && i % 2 === 0 ? 2 : 1);
  }

  return { molecule: current, atomIds };
}

/**
 * Halkayi var olan bir bagin uzerine kaynastirir (naftalin gibi).
 *
 * Bagin iki ucu halkanin bir kenari olur; kalan koseler, molekulun geri
 * kalanindan uzak tarafta uretilir.
 */
export function fuseRingOnBond(
  mol: Molecule,
  bondId: BondId,
  sides: number,
  aromatic: boolean,
): Molecule {
  const bond = getBond(mol, bondId);
  if (!bond) return mol;
  const a = getAtom(mol, bond.a1);
  const b = getAtom(mol, bond.a2);
  if (!a || !b) return mol;

  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const edge = distance(a, b) || BOND_LENGTH;
  // Duzgun cokgende merkez, kenar ortasindan apothem kadar uzakta durur.
  const apothem = edge / (2 * Math.tan(Math.PI / sides));

  const normal = { x: -(b.y - a.y) / edge, y: (b.x - a.x) / edge };
  const side = emptierSide(mol, [bond.a1, bond.a2], mid, normal);
  const center = { x: mid.x + normal.x * apothem * side, y: mid.y + normal.y * apothem * side };

  // a'dan baslayip b yonunde ilerleyerek kalan koseleri uret.
  const startAngle = angleBetween(center, a);
  const endAngle = angleBetween(center, b);
  const step = (2 * Math.PI) / sides;
  // Hangi yonde donecegimizi a->b gecisine bakarak seciyoruz.
  const direction = normalizeAngle(endAngle - startAngle) < Math.PI ? 1 : -1;
  const radius = distance(center, a);

  let current = mol;
  const ringAtoms: AtomId[] = [bond.a1, bond.a2];

  for (let i = 2; i < sides; i++) {
    const angle = startAngle + direction * step * i;
    const vertex = pointAt(center, angle, radius);
    const added = addAtom(current, { element: 'C', x: vertex.x, y: vertex.y });
    current = added.molecule;
    ringAtoms.push(added.atomId);
  }

  // Var olan kenari bozmadan kalan kenarlari ekle.
  for (let i = 1; i < ringAtoms.length; i++) {
    current = addBond(current, ringAtoms[i], ringAtoms[(i + 1) % ringAtoms.length], 1);
  }
  if (aromatic) {
    current = kekulize(current, ringAtoms);
  }
  return current;
}

/**
 * Halkayi var olan bir atoma baglar: atom halkanin bir kosesi olur,
 * halka merkezi komsulardan uzak yone yerlestirilir.
 */
export function attachRingToAtom(
  mol: Molecule,
  atomId: AtomId,
  sides: number,
  aromatic: boolean,
): Molecule {
  const atom = getAtom(mol, atomId);
  if (!atom) return mol;

  const radius = BOND_LENGTH / (2 * Math.sin(Math.PI / sides));
  const away = awayFromNeighbors(mol, atomId);
  const center = pointAt(atom, away, radius);

  // Merkezi bilerek halkayi kur, sonra atomu en yakin koseyle birlestir.
  const startAngle = angleBetween(center, atom);
  const step = (2 * Math.PI) / sides;

  let current = mol;
  const ringAtoms: AtomId[] = [atomId];
  for (let i = 1; i < sides; i++) {
    const vertex = pointAt(center, startAngle + step * i, radius);
    const added = addAtom(current, { element: 'C', x: vertex.x, y: vertex.y });
    current = added.molecule;
    ringAtoms.push(added.atomId);
  }
  for (let i = 0; i < ringAtoms.length; i++) {
    current = addBond(current, ringAtoms[i], ringAtoms[(i + 1) % ringAtoms.length], 1);
  }
  if (aromatic) {
    current = kekulize(current, ringAtoms);
  }
  return current;
}

/**
 * Halka atomlarina bir atlamali ikili bag dagitir (Kekule formu).
 * Zaten dolu valansi olan atomlar atlanir — kaynasik halkalarda
 * ortak kenarin iki kez ikilenmesini onler.
 */
function kekulize(mol: Molecule, ringAtoms: AtomId[]): Molecule {
  let current = mol;
  const doubled = new Set<AtomId>();

  // Var olan ikili baglari isaretle ki uzerine yazmayalim.
  for (const bond of current.bonds) {
    if (bond.order === 2) {
      doubled.add(bond.a1);
      doubled.add(bond.a2);
    }
  }

  for (let i = 0; i < ringAtoms.length; i++) {
    const a = ringAtoms[i];
    const b = ringAtoms[(i + 1) % ringAtoms.length];
    if (doubled.has(a) || doubled.has(b)) continue;
    current = addBond(current, a, b, 2);
    doubled.add(a);
    doubled.add(b);
  }
  return current;
}

/** Verilen atomlarin komsularinin daha az bulundugu taraf (+1 / -1). */
function emptierSide(mol: Molecule, ringEnds: AtomId[], mid: Point, normal: Point): number {
  let score = 0;
  for (const end of ringEnds) {
    for (const neighborId of neighborsOf(mol, end)) {
      if (ringEnds.includes(neighborId)) continue;
      const n = getAtom(mol, neighborId);
      if (!n) continue;
      score += Math.sign((n.x - mid.x) * normal.x + (n.y - mid.y) * normal.y);
    }
  }
  // Komsular hangi taraftaysa halkayi tersine koy; esitlikte yukari.
  return score > 0 ? -1 : 1;
}

/** Bir atomun komsularindan en uzak yon. */
function awayFromNeighbors(mol: Molecule, atomId: AtomId): number {
  const atom = getAtom(mol, atomId)!;
  const neighbors = neighborsOf(mol, atomId)
    .map((id) => getAtom(mol, id))
    .filter((n) => n !== undefined);
  if (neighbors.length === 0) return -Math.PI / 2;

  const sumX = neighbors.reduce((s, n) => s + Math.cos(angleBetween(atom, n)), 0);
  const sumY = neighbors.reduce((s, n) => s + Math.sin(angleBetween(atom, n)), 0);
  return Math.atan2(-sumY, -sumX);
}

const normalizeAngle = (a: number): number => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

/**
 * Tuvale sablon yerlestirir; tiklanan yere gore serbest, atoma bagli
 * veya baga kaynasik olarak.
 */
export function placeTemplate(
  mol: Molecule,
  templateId: string,
  point: Point,
  hitAtomId: AtomId | null,
  hitBondId: BondId | null,
): Molecule {
  const template = TEMPLATES.find((t) => t.id === templateId);
  if (!template) return mol;

  if (hitBondId) return fuseRingOnBond(mol, hitBondId, template.sides, template.aromatic);
  if (hitAtomId) return attachRingToAtom(mol, hitAtomId, template.sides, template.aromatic);
  return template.build(mol, point).molecule;
}

const ring = (id: string, label: string, sides: number, aromatic = false): Template => ({
  id,
  label,
  sides,
  aromatic,
  build: (mol, center) => buildRing(mol, center, sides, aromatic),
});

export const TEMPLATES: Template[] = [
  ring('benzene', 'Benzen', 6, true),
  ring('cyclohexane', 'Siklohekzan', 6),
  ring('cyclopentane', 'Siklopentan', 5),
  ring('cyclopropane', 'Siklopropan', 3),
  ring('cyclobutane', 'Siklobütan', 4),
  ring('cycloheptane', 'Sikloheptan', 7),
];
