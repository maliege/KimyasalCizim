export type AtomId = string;
export type BondId = string;

export type Atom = {
  id: AtomId;
  /** Element simgesi: 'C', 'O', 'Cl' … */
  element: string;
  /** Tuval koordinatlari (SVG kullanici birimi) */
  x: number;
  y: number;
  /** Formul yuku: 0, +1, -1 … */
  charge: number;
  /** Izotop kutle numarasi (13C icin 13). Yoksa dogal bollukta kabul edilir. */
  isotope?: number;
  /**
   * Elle sabitlenmis hidrojen sayisi. Tanimsizsa valence.ts hesaplar —
   * normal kullanimda tanimsiz kalir, sadece .mol iceri aktariminda dolar.
   */
  explicitH?: number;
};

export type BondOrder = 1 | 2 | 3;

/** MDL molfile stereo kodlari: none=0, wedge=1 (one dogru), hash=6 (arkaya) */
export type BondStereo = 'none' | 'wedge' | 'hash';

export type Bond = {
  id: BondId;
  a1: AtomId;
  a2: AtomId;
  order: BondOrder;
  stereo: BondStereo;
};

export type Molecule = {
  atoms: Atom[];
  bonds: Bond[];
};
