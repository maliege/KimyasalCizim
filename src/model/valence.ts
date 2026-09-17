import { bondOrderSum } from './molecule';
import type { Atom, Molecule } from './types';

/**
 * Standart valanslar. Ortuk hidrojen sayisi bunlardan hesaplanir.
 * Birden fazla valansi olan elementlerde (S, P, N) en dusuk olan
 * temel alinir; bag toplami onu asarsa bir ustune gecilir.
 */
const VALENCES: Record<string, number[]> = {
  H: [1],
  B: [3],
  C: [4],
  N: [3],
  O: [2],
  F: [1],
  Si: [4],
  P: [3, 5],
  S: [2, 4, 6],
  Cl: [1],
  Se: [2, 4, 6],
  Br: [1],
  I: [1, 3, 5, 7],
};

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
