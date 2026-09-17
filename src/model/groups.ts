import { addAtom, addBond, getAtom } from './molecule';
import { BOND_LENGTH, preferredBondAngle } from './geometry';
import type { AtomId, BondOrder, Molecule } from './types';
import type { Point } from './geometry';

/**
 * Fonksiyonel grup sablonlari.
 *
 * Halkalardan farki: grup, dayanak atoma bir *bag* ile baglanir — dayanak
 * atom grubun parcasi olmaz. Fenil bu yuzden benzen halkasindan ayri bir
 * sablondur: halka aracini bir atoma uygularsaniz o atom halkanin kosesi
 * olur (spiro), fenil ise yana sarkan bir benzen halkasi verir.
 */

/** Dayanak atomu gosteren ozel indeks. */
const ANCHOR = -1;

/** 60°'lik dikey acilim — standart 120° bag acilarini verir. */
const S = Math.sin(Math.PI / 3);

type FragmentAtom = {
  element: string;
  /** Dayanak atoma gore konum, BOND_LENGTH biriminde. Fragman +x yonunde uzanir. */
  dx: number;
  dy: number;
  charge?: number;
};

/** [kaynak, hedef, derece] — indeksler atoms dizisine, ANCHOR dayanak atoma isaret eder. */
type FragmentBond = readonly [number, number, BondOrder];

export type Group = {
  id: string;
  label: string;
  /** Arac ipucunda gosterilen kapali gosterim */
  formula: string;
  atoms: readonly FragmentAtom[];
  bonds: readonly FragmentBond[];
};

export const GROUPS: readonly Group[] = [
  {
    id: 'methyl',
    label: 'Metil',
    formula: 'CH₃',
    atoms: [{ element: 'C', dx: 1, dy: 0 }],
    bonds: [[ANCHOR, 0, 1]],
  },
  {
    id: 'hydroxyl',
    label: 'Hidroksil',
    formula: 'OH',
    atoms: [{ element: 'O', dx: 1, dy: 0 }],
    bonds: [[ANCHOR, 0, 1]],
  },
  {
    id: 'amino',
    label: 'Amino',
    formula: 'NH₂',
    atoms: [{ element: 'N', dx: 1, dy: 0 }],
    bonds: [[ANCHOR, 0, 1]],
  },
  {
    id: 'thiol',
    label: 'Tiyol',
    formula: 'SH',
    atoms: [{ element: 'S', dx: 1, dy: 0 }],
    bonds: [[ANCHOR, 0, 1]],
  },
  {
    id: 'carbonyl',
    label: 'Karbonil',
    formula: 'C=O',
    atoms: [
      { element: 'C', dx: 1, dy: 0 },
      { element: 'O', dx: 1.5, dy: -S },
    ],
    bonds: [
      [ANCHOR, 0, 1],
      [0, 1, 2],
    ],
  },
  {
    id: 'carboxyl',
    label: 'Karboksil',
    formula: 'COOH',
    atoms: [
      { element: 'C', dx: 1, dy: 0 },
      { element: 'O', dx: 1.5, dy: -S },
      { element: 'O', dx: 1.5, dy: S },
    ],
    bonds: [
      [ANCHOR, 0, 1],
      [0, 1, 2],
      [0, 2, 1],
    ],
  },
  {
    id: 'nitro',
    label: 'Nitro',
    formula: 'NO₂',
    // Dogru gosterim yukselmis azot: N⁺ bir =O ve bir O⁻ tasir.
    atoms: [
      { element: 'N', dx: 1, dy: 0, charge: 1 },
      { element: 'O', dx: 1.5, dy: -S },
      { element: 'O', dx: 1.5, dy: S, charge: -1 },
    ],
    bonds: [
      [ANCHOR, 0, 1],
      [0, 1, 2],
      [0, 2, 1],
    ],
  },
  {
    id: 'cyano',
    label: 'Siyano',
    formula: 'C≡N',
    // Uclu bag dogrusaldir, bu yuzden azot ayni eksende.
    atoms: [
      { element: 'C', dx: 1, dy: 0 },
      { element: 'N', dx: 2, dy: 0 },
    ],
    bonds: [
      [ANCHOR, 0, 1],
      [0, 1, 3],
    ],
  },
  {
    id: 'sulfo',
    label: 'Sülfonik',
    formula: 'SO₃H',
    atoms: [
      { element: 'S', dx: 1, dy: 0 },
      { element: 'O', dx: 1.5, dy: -S },
      { element: 'O', dx: 1.5, dy: S },
      { element: 'O', dx: 2, dy: 0 },
    ],
    bonds: [
      [ANCHOR, 0, 1],
      [0, 1, 2],
      [0, 2, 2],
      [0, 3, 1],
    ],
  },
  {
    id: 'phenyl',
    label: 'Fenil',
    formula: 'C₆H₅',
    // Kenar uzunlugu 1 olan duzgun altigen, dayanak atomdan bir bag oteye kurulur.
    atoms: [
      { element: 'C', dx: 1, dy: 0 },
      { element: 'C', dx: 1.5, dy: -S },
      { element: 'C', dx: 2.5, dy: -S },
      { element: 'C', dx: 3, dy: 0 },
      { element: 'C', dx: 2.5, dy: S },
      { element: 'C', dx: 1.5, dy: S },
    ],
    bonds: [
      [ANCHOR, 0, 1],
      [0, 1, 2],
      [1, 2, 1],
      [2, 3, 2],
      [3, 4, 1],
      [4, 5, 2],
      [5, 0, 1],
    ],
  },
];

export const findGroup = (id: string): Group | undefined => GROUPS.find((g) => g.id === id);

/**
 * Grubu tuvale yerlestirir.
 *
 * Var olan bir atoma tiklandiysa grup ona baglanir; bos alana tiklandiysa
 * once bir karbon iskeleti acilir — boylece COOH asetik asit, OH metanol
 * gibi tanidik sonuclar verir.
 *
 * Grup, dayanak atomun komsularindan en uzak yone dondurulerek yerlestirilir.
 */
export function placeGroup(
  mol: Molecule,
  groupId: string,
  point: Point,
  anchorId: AtomId | null,
): Molecule {
  const group = findGroup(groupId);
  if (!group) return mol;

  let current = mol;
  let anchor = anchorId;

  if (!anchor) {
    const added = addAtom(current, { element: 'C', x: point.x, y: point.y });
    current = added.molecule;
    anchor = added.atomId;
  }

  const origin = getAtom(current, anchor);
  if (!origin) return mol;

  // Fragman +x yonunde tanimli; onu bos yone dondururuz.
  const angle = preferredBondAngle(current, anchor);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  const ids: AtomId[] = [];
  for (const spec of group.atoms) {
    const added = addAtom(current, {
      element: spec.element,
      x: origin.x + (spec.dx * cos - spec.dy * sin) * BOND_LENGTH,
      y: origin.y + (spec.dx * sin + spec.dy * cos) * BOND_LENGTH,
      charge: spec.charge,
    });
    current = added.molecule;
    ids.push(added.atomId);
  }

  const resolve = (index: number): AtomId => (index === ANCHOR ? anchor : ids[index]);
  for (const [from, to, order] of group.bonds) {
    current = addBond(current, resolve(from), resolve(to), order);
  }

  return current;
}
