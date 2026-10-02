/**
 * Tanınan fonksiyonel gruplar — SMARTS desenleri.
 *
 * Desenler ortusmeyecek sekilde yazildi: esterin C=O'su keton, asidin OH'si
 * alkol, amidin azotu amin olarak ikinci kez sayilmamali. Karbonil
 * desenlerinde `[#6X3]` (aromatik ya da degil, uc baglantili karbon)
 * kullaniliyor, cunku RDKit kafein gibi halkalardaki C=O'yu aromatik sayar;
 * `[CX3]` yazsaydik onlari hic goremezdik.
 *
 * Bu desenler src/rdkit/functionalGroups.chem.test.ts icinde gercek RDKit ile
 * galerideki molekuller uzerinde dogrulaniyor.
 */

export type FunctionalGroup = {
  id: string;
  /** Turkce ad */
  name: string;
  /** Tuvalde vurgu rengi */
  color: string;
  /** Bir ya da daha fazla SMARTS; eslesmeler birlestirilir. */
  smarts: readonly string[];
};

export const FUNCTIONAL_GROUPS: readonly FunctionalGroup[] = [
  { id: 'carboxylic-acid', name: 'Karboksilik asit', color: '#d92020', smarts: ['[#6X3](=O)[OX2H1]'] },
  { id: 'carboxylate', name: 'Karboksilat', color: '#e0457b', smarts: ['[#6X3](=O)[OX1-]'] },
  { id: 'sulfonic-acid', name: 'Sülfonik asit', color: '#b8860b', smarts: ['[SX4](=O)(=O)[OX2H1]'] },
  { id: 'ester', name: 'Ester', color: '#e07000', smarts: ['[#6][#6X3](=O)[OX2H0][#6]'] },
  { id: 'amide', name: 'Amid', color: '#7a34b8', smarts: ['[#7X3][#6X3](=[OX1])'] },
  {
    id: 'aldehyde',
    name: 'Aldehit',
    color: '#c2185b',
    // R–CHO ya da formaldehit; formik asit bilerek disarida (C'ye degil O'ya bagli)
    smarts: ['[$([CX3H1][#6]),$([CX3H2])]=[OX1]'],
  },
  { id: 'ketone', name: 'Keton', color: '#ad1457', smarts: ['[#6][#6X3](=[OX1])[#6]'] },
  { id: 'alcohol', name: 'Alkol', color: '#1e88e5', smarts: ['[CX4][OX2H1]'] },
  { id: 'phenol', name: 'Fenol', color: '#0277bd', smarts: ['c[OX2H1]'] },
  { id: 'ether', name: 'Eter', color: '#00897b', smarts: ['[OD2;!$(OC=O)]([#6])[#6]'] },
  {
    id: 'amine',
    name: 'Amin',
    color: '#2e7d32',
    // Yuksuz, uc baglantili, amid ya da sulfonamid olmayan azot
    smarts: ['[NX3;+0;!$(N[#6X3]=O);!$(NS(=O)=O)]'],
  },
  { id: 'nitrile', name: 'Nitril', color: '#5d4037', smarts: ['[CX2]#[NX1]'] },
  { id: 'nitro', name: 'Nitro', color: '#6d4c41', smarts: ['[N+](=O)[O-]'] },
  { id: 'halide', name: 'Halojenür', color: '#28a05a', smarts: ['[#6][F,Cl,Br,I]'] },
  { id: 'thiol', name: 'Tiyol', color: '#9e7700', smarts: ['[#6][SX2H1]'] },
  { id: 'alkene', name: 'Alken', color: '#546e7a', smarts: ['[CX3]=[CX3]'] },
  { id: 'alkyne', name: 'Alkin', color: '#37474f', smarts: ['[CX2]#[CX2]'] },
  {
    id: 'aromatic-ring',
    name: 'Aromatik halka',
    color: '#8e24aa',
    // Alti ve bes uyeli aromatik halkalar (benzen, piridin, imidazol…)
    smarts: ['a1aaaaa1', 'a1aaaa1'],
  },
];

export const findFunctionalGroup = (id: string): FunctionalGroup | undefined =>
  FUNCTIONAL_GROUPS.find((g) => g.id === id);
