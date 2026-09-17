import { getAtom, neighborsOf } from './molecule';
import type { AtomId, Molecule } from './types';

/** Standart bag uzunlugu (SVG kullanici birimi). */
export const BOND_LENGTH = 40;

/** Aci yakalama adimi (derece). */
export const ANGLE_SNAP = 30;

export type Point = { x: number; y: number };

export const distance = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y);

/** İki nokta arasindaki aci (radyan, SVG'de y asagi dogru buyur). */
export const angleBetween = (from: Point, to: Point): number =>
  Math.atan2(to.y - from.y, to.x - from.x);

export const pointAt = (origin: Point, angleRad: number, length: number): Point => ({
  x: origin.x + Math.cos(angleRad) * length,
  y: origin.y + Math.sin(angleRad) * length,
});

/**
 * Bir hedef noktayi, kaynaktan itibaren en yakin `ANGLE_SNAP` katina ve
 * sabit bag uzunluguna yakalar. Serbest cizim icin `snap=false` gecilir.
 */
export function snapToGrid(from: Point, to: Point, snap = true): Point {
  if (!snap) return to;
  const step = (ANGLE_SNAP * Math.PI) / 180;
  const snapped = Math.round(angleBetween(from, to) / step) * step;
  return pointAt(from, snapped, BOND_LENGTH);
}

/** Verilen noktanin `radius` yaricapindaki en yakin atomu. */
export function atomAt(
  mol: Molecule,
  point: Point,
  radius = 15,
  exclude?: AtomId,
): AtomId | null {
  let best: AtomId | null = null;
  let bestDist = radius;
  for (const atom of mol.atoms) {
    if (atom.id === exclude) continue;
    const d = distance(atom, point);
    if (d <= bestDist) {
      best = atom.id;
      bestDist = d;
    }
  }
  return best;
}

/** Verilen noktaya `tolerance` mesafesinden yakin olan bag. */
export function bondAt(mol: Molecule, point: Point, tolerance = 8): string | null {
  for (const bond of mol.bonds) {
    const a = getAtom(mol, bond.a1);
    const b = getAtom(mol, bond.a2);
    if (!a || !b) continue;
    if (distanceToSegment(point, a, b) <= tolerance) return bond.id;
  }
  return null;
}

export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return distance(p, a);
  // Noktanin dogru parcasi uzerindeki izdusum orani, [0,1] araligina kirpilir.
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy });
}

/**
 * Bir atoma yeni bag eklerken kullanilacak en uygun yon.
 *
 * Var olan komsulardan olabildigince uzak bir aci secer; boylece tek
 * tiklamayla zincir uzatinca dogal zikzak olusur (109.5°'ye yakin).
 */
export function preferredBondAngle(mol: Molecule, atomId: AtomId): number {
  const origin = getAtom(mol, atomId);
  if (!origin) return 0;

  const neighborAngles = neighborsOf(mol, atomId)
    .map((id) => getAtom(mol, id))
    .filter((n) => n !== undefined)
    .map((n) => angleBetween(origin, n));

  if (neighborAngles.length === 0) {
    return (-30 * Math.PI) / 180; // bos atomdan saga-yukari
  }
  if (neighborAngles.length === 1) {
    // Tek komsu varsa 120° donerek zikzak yap.
    return neighborAngles[0] + (120 * Math.PI) / 180;
  }

  // Komsu aciları arasindaki en genis bosluğun ortasini sec.
  const sorted = [...neighborAngles].sort((p, q) => p - q);
  let bestAngle = sorted[0] + Math.PI;
  let widestGap = -1;
  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const next = i === sorted.length - 1 ? sorted[0] + 2 * Math.PI : sorted[i + 1];
    const gap = next - current;
    if (gap > widestGap) {
      widestGap = gap;
      bestAngle = current + gap / 2;
    }
  }
  return bestAngle;
}
