import { implicitHydrogens, hasKnownValence } from '../model/valence';
import { themed } from './theme';
import { bondsOf, getAtom, neighborsOf } from '../model/molecule';
import { angleBetween } from '../model/geometry';
import type { Atom, Molecule } from '../model/types';

/**
 * CPK/Jmol'e yakin element renkleri.
 *
 * Yalniz sik cizilen elementler listelenir; geri kalan her sey nötr griye
 * duser. Amac 118 rengi tamamlamak degil, yapiya bakinca heteroatomlari
 * ayirt edebilmek.
 */
const ELEMENT_COLORS: Record<string, string> = {
  // Organik cekirdek
  C: '#1c2029',
  H: '#4b5563',
  N: '#2050d0',
  O: '#d92020',
  S: '#c8a000',
  P: '#e07000',
  B: '#c08080',
  Si: '#907050',
  Se: '#9a6a00',
  // Halojenler
  F: '#28a05a',
  Cl: '#28a05a',
  Br: '#8b3a1a',
  I: '#7028c0',
  At: '#754f45',
  // Alkali ve toprak alkali
  Li: '#8c4ad4', Na: '#8c4ad4', K: '#7a34b8', Rb: '#7a34b8', Cs: '#6b2aa0',
  Mg: '#3f8f00', Ca: '#2f8000', Sr: '#2f8000', Ba: '#217000',
  // Sik gecen metaller
  Al: '#96908c', Fe: '#b8501f', Cu: '#a86a2a', Zn: '#5f6486', Ni: '#3f8f5a',
  Mn: '#8f4fa8', Cr: '#5f7f9f', Co: '#4a6fb0', Ti: '#96999c', Ag: '#8c8c99',
  Au: '#b08f28', Pt: '#8f9199', Hg: '#8f7f99', Pb: '#4f5560', Sn: '#67707a',
  // Soy gazlar
  He: '#5fa8b8', Ne: '#4f9ab8', Ar: '#4a90b0', Kr: '#3f84a8', Xe: '#3878a0',
};

/**
 * Elementin cizim rengi, tema degiskeni olarak: var(--el-N, #2050d0).
 * Koyu tema bu degiskenleri acik tonlarla ezer; disa aktarimda yedek (acik
 * tema) degerine cozulur. Bkz. theme.ts.
 */
export const elementColor = (element: string): string => {
  const light = ELEMENT_COLORS[element];
  return light ? themed(`el-${element}`, light) : themed('ink-soft', '#3f3f46');
};

/** Etiket yaricapi — bag cizgileri bu kadar kisaltilir. */
export const LABEL_RADIUS = 11;

export const ATOM_FONT_SIZE = 15;
export const BOND_WIDTH = 1.6;
/** Ikili/uclu bag cizgileri arasi mesafe. */
export const BOND_GAP = 4;

/**
 * Etiket gosterim secenekleri — ayarlarin cizimi ilgilendiren kismi.
 * Karar fonksiyonlari bunu PARAMETRE olarak alir (context okumaz) ki React'siz
 * test edilebilsinler. Bilesenler degeri LabelOptionsContext'ten alir.
 */
export type LabelOptions = {
  /** hidden: iskelet gosterim · terminal: yalniz zincir uclari · all: her karbon */
  carbonLabels: 'hidden' | 'terminal' | 'all';
  /** Yazilan karbonlarda hidrojenler gosterilsin mi (CH2 / C) */
  carbonHydrogens: 'show' | 'hide';
};

export const DEFAULT_LABEL_OPTIONS: LabelOptions = { carbonLabels: 'hidden', carbonHydrogens: 'show' };

/**
 * Bir atomun etiketi cizilecek mi?
 *
 * Heteroatomlar her zaman yazilir. Karbonlarda karar ayara bagli; ama yalniz
 * duran, yuklu ya da izotoplu karbonlar her ayarda yazilir, yoksa o bilgi
 * gorunmezdi. Bag cizgileri de bu karara gore etiket kenarinda kesilir.
 */
export function isLabelVisible(
  mol: Molecule,
  atom: Atom,
  options: LabelOptions = DEFAULT_LABEL_OPTIONS,
): boolean {
  if (atom.element !== 'C') return true;
  if (atom.charge !== 0 || atom.isotope !== undefined) return true;
  const degree = bondsOf(mol, atom.id).length;
  if (degree === 0) return true;
  switch (options.carbonLabels) {
    case 'all':
      return true;
    case 'terminal':
      return degree === 1;
    case 'hidden':
      return false;
  }
}

/**
 * Etikette yazilacak hidrojen sayisi.
 *
 * Tek yerde hesaplanir: hem etiket metni hem AtomLabel bunu kullanir, yoksa
 * gizleme ayari birinde uygulanip digerinde unutulabilirdi. Gizleme yalniz
 * karbonlari etkiler; OH → O yazmak onu radikal gibi gosterirdi.
 */
export function shownHydrogens(
  mol: Molecule,
  atom: Atom,
  options: LabelOptions = DEFAULT_LABEL_OPTIONS,
): number {
  if (!hasKnownValence(atom.element)) return 0;
  if (atom.element === 'C' && options.carbonHydrogens === 'hide') return 0;
  return implicitHydrogens(mol, atom);
}

/** Etiket metni: element + ortuk H'ler (or. "OH", "NH2", "CH4"). */
export function labelText(
  mol: Molecule,
  atom: Atom,
  options: LabelOptions = DEFAULT_LABEL_OPTIONS,
): string {
  const h = shownHydrogens(mol, atom, options);
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
