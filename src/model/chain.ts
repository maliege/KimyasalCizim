import { addAtom, addBond } from './molecule';
import { ANGLE_SNAP, BOND_LENGTH, angleBetween, distance, pointAt } from './geometry';
import type { Point } from './geometry';
import type { AtomId, Molecule } from './types';

/**
 * Zincir araci: surukleme yonunde zikzak karbon zinciri.
 *
 * Her bag ana yonden ±30° sapar ve isaret her bagda degisir; boylece ardisik
 * baglar arasi 120° olur (sp3 zincirin standart iskelet cizimi). Bir bagin
 * ana eksen uzerindeki izdusumu L·cos30° oldugundan, surukleme uzunlugu bu
 * adima bolunerek bag sayisi bulunur.
 */

/** Ana eksenden sapma. */
const ZIGZAG = (30 * Math.PI) / 180;

/** Bir bagin ana eksen uzerinde ilerledigi mesafe. */
export const CHAIN_STEP = BOND_LENGTH * Math.cos(ZIGZAG);

/** Tek suruklemede eklenebilecek en fazla bag — kazara dev zincir olmasin. */
export const MAX_CHAIN = 40;

/**
 * Baslangictan hedefe dogru zikzak noktalari (baslangic haric).
 * @param snap true ise ana yon 30°'nin katlarina yakalanir (bag araciyla ayni)
 * @returns en az bir nokta
 */
export function chainPoints(start: Point, end: Point, snap = true): Point[] {
  const step = (ANGLE_SNAP * Math.PI) / 180;
  const raw = distance(start, end) < 1 ? -step : angleBetween(start, end);
  const direction = snap ? Math.round(raw / step) * step : raw;
  const count = Math.min(MAX_CHAIN, Math.max(1, Math.round(distance(start, end) / CHAIN_STEP)));

  const points: Point[] = [];
  let current = start;
  for (let i = 0; i < count; i++) {
    // Ilk bag ekranda "yukari" sapar (SVG'de y asagi buyudugu icin eksi).
    const side = i % 2 === 0 ? -1 : 1;
    current = pointAt(current, direction + side * ZIGZAG, BOND_LENGTH);
    points.push(current);
  }
  return points;
}

/** Noktalari karbon atomu olarak ekleyip baslangic atomundan itibaren tekli baglarla baglar. */
export function buildChain(
  mol: Molecule,
  fromAtom: AtomId,
  points: readonly Point[],
): { molecule: Molecule; atomIds: AtomId[] } {
  let current = mol;
  let previous = fromAtom;
  const atomIds: AtomId[] = [];
  for (const point of points) {
    const added = addAtom(current, { element: 'C', x: point.x, y: point.y });
    current = addBond(added.molecule, previous, added.atomId, 1);
    previous = added.atomId;
    atomIds.push(added.atomId);
  }
  return { molecule: current, atomIds };
}
