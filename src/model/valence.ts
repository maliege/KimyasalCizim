import { bondOrderSum } from './molecule';
import type { Atom, Molecule } from './types';

/**
 * Standart valanslar. Ortuk hidrojen sayisi bunlardan hesaplanir.
 * Birden fazla valansi olan elementlerde (S, P, N) en dusuk olan
 * temel alinir; bag toplami onu asarsa bir ustune gecilir.
 */
const VALENCES: Record<string, number[]> = {
  H: [1],
  // Soy gazlar bag yapmaz; ortuk hidrojen gosterilmemeli.
  He: [0], Ne: [0], Ar: [0], Kr: [0], Xe: [0], Rn: [0],
  // 1. ve 2. grup
  Li: [1], Na: [1], K: [1], Rb: [1], Cs: [1],
  Be: [2], Mg: [2], Ca: [2], Sr: [2], Ba: [2],
  // 13. grup
  B: [3], Al: [3], Ga: [3], In: [3], Tl: [1, 3],
  // 14. grup
  C: [4], Si: [4], Ge: [4], Sn: [2, 4], Pb: [2, 4],
  // 15. grup
  N: [3], P: [3, 5], As: [3, 5], Sb: [3, 5], Bi: [3, 5],
  // 16. grup
  O: [2], S: [2, 4, 6], Se: [2, 4, 6], Te: [2, 4, 6], Po: [2, 4, 6],
  // 17. grup
  F: [1], Cl: [1], Br: [1], I: [1, 3, 5, 7], At: [1],
};

// Gecis metalleri bilerek disarida: valanslari degisken oldugu icin ortuk
// hidrojen uydurmak yaniltici olur. hasKnownValence onlar icin false doner,
// yani "Fe" cizildiginde hidrojen eklenmez — organometalik yapilarda
// istenen davranis budur.

/** Elementin bilinen bir valansi var mi? Yoksa H gosterilmez. */
export const hasKnownValence = (element: string): boolean => element in VALENCES;

/**
 * Bir atomun ortuk hidrojen sayisi: (yuke gore duzeltilmis valans) - (bag toplami).
 */
export function implicitHydrogens(mol: Molecule, atom: Atom): number {
  if (atom.explicitH !== undefined) return atom.explicitH;

  const valences = VALENCES[atom.element];
  if (!valences) return 0;

  const used = bondOrderSum(mol, atom.id);
  const adjusted = valences.map((v) => v + chargeAdjustment(atom.element, atom.charge));

  // Bag toplamini karsilayabilen en dusuk valansi sec.
  const valence = adjusted.find((v) => v >= used) ?? adjusted[adjusted.length - 1];
  return Math.max(0, valence - used);
}

/**
 * Yukun valansa etkisi.
 *
 * N, P gibi bagimsiz elektron cifti tasiyan elementlerde katyon o cifti
 * baga cevirir, yani valans artar (NH4+ -> 4). B, C gibi elektron eksigi
 * olanlarda ise katyon valansi dusurur (CH3+ -> 3). Anyonlarda tersi.
 */
function chargeAdjustment(element: string, charge: number): number {
  if (charge === 0) return 0;
  const lonePairDonor = ['N', 'P', 'O', 'S', 'Se'].includes(element);
  return lonePairDonor ? charge : -Math.abs(charge);
}

/**
 * Kapali formul (Hill sistemi): once C, sonra H, ardindan diger elementler
 * alfabetik. Karbon yoksa tum elementler alfabetik siralanir.
 */
export function molecularFormula(mol: Molecule): string {
  const counts = new Map<string, number>();
  const bump = (el: string, n = 1) => counts.set(el, (counts.get(el) ?? 0) + n);

  for (const atom of mol.atoms) {
    bump(atom.element);
    bump('H', implicitHydrogens(mol, atom));
  }

  const zero = [...counts].filter(([, n]) => n === 0).map(([el]) => el);
  for (const el of zero) counts.delete(el);

  const rest = [...counts.keys()].filter((el) => el !== 'C' && el !== 'H').sort();
  const order = counts.has('C') ? ['C', ...(counts.has('H') ? ['H'] : []), ...rest] : [...counts.keys()].sort();

  return order
    .map((el) => {
      const n = counts.get(el)!;
      return n === 1 ? el : `${el}${n}`;
    })
    .join('');
}
