import { implicitHydrogens, hasKnownValence } from '../model/valence';
import { bondsOf, getAtom, neighborsOf } from '../model/molecule';
import { angleBetween } from '../model/geometry';
import type { Atom, Molecule } from '../model/types';

/** CPK'ya yakin element renkleri. */
const ELEMENT_COLORS: Record<string, string> = {
  C: '#1c2029',
  H: '#4b5563',
  N: '#2050d0',
  O: '#d92020',
  S: '#c8a000',
  P: '#e07000',
  F: '#28a05a',
  Cl: '#28a05a',
  Br: '#8b3a1a',
  I: '#7028c0',
  B: '#c08080',
  Si: '#907050',
};

export const elementColor = (element: string): string => ELEMENT_COLORS[element] ?? '#3f3f46';

/** Etiket yaricapi — bag cizgileri bu kadar kisaltilir. */
export const LABEL_RADIUS = 11;

export const ATOM_FONT_SIZE = 15;
export const BOND_WIDTH = 1.6;
/** Ikili/uclu bag cizgileri arasi mesafe. */
export const BOND_GAP = 4;

/**
 * Bir atomun etiketi cizilecek mi?
 *
 * Standart kimyasal gosterimde karbonlar cizgi koseleri olarak birakilir.
 * Ancak yalniz duran, yuklu, izotoplu veya tek bagli uc karbonlar
 * okunabilirlik icin yazilir.
 */
export function isLabelVisible(mol: Molecule, atom: Atom): boolean {
  if (atom.element !== 'C') return true;
  if (atom.charge !== 0 || atom.isotope !== undefined) return true;
  return bondsOf(mol, atom.id).length === 0;
}

/** Etiket metni: element + ortuk H'ler (or. "OH", "NH2", "CH4"). */
export function labelText(mol: Molecule, atom: Atom): string {
  const h = hasKnownValence(atom.element) ? implicitHydrogens(mol, atom) : 0;
  if (h === 0) return atom.element;
  if (h === 1) return `${atom.element}H`;
  return `${atom.element}H${h}`;
}

/**
 * Ortuk hidrojenler element simgesinin soluna mi yazilsin?
 *
 * Baglar sagdan geliyorsa H'leri sola aliriz ("HO-") — boylece cizgi
 * metnin uzerinden gecmez. Esik olmadan dikey bir bagda karar kayan
 * nokta gurultusune kalir; belirsizlikte standart olan saga yazim
 * ("OH", "NH2") korunur.
 */
const LEAN_THRESHOLD = 0.35;

export function hydrogensGoLeft(mol: Molecule, atom: Atom): boolean {
  const neighbors = neighborsOf(mol, atom.id)
    .map((id) => getAtom(mol, id))
    .filter((n) => n !== undefined);
  if (neighbors.length === 0) return false;

  const avgCos =
    neighbors.reduce((sum, n) => sum + Math.cos(angleBetween(atom, n)), 0) / neighbors.length;
  return avgCos > LEAN_THRESHOLD;
}

/** Yuk gosterimi: +, -, 2+, 3- … Yuksuzde bos dizge. */
export function chargeText(charge: number): string {
  if (charge === 0) return '';
  const sign = charge > 0 ? '+' : '−';
  const magnitude = Math.abs(charge);
  return magnitude === 1 ? sign : `${magnitude}${sign}`;
}
