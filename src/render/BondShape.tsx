import { getAtom, neighborsOf } from '../model/molecule';
import { distance } from '../model/geometry';
import type { Atom, Bond, Molecule } from '../model/types';
import type { Point as GeomPoint } from '../model/geometry';
import { BOND_GAP, BOND_WIDTH, LABEL_RADIUS, isLabelVisible } from './style';

type Props = {
  molecule: Molecule;
  bond: Bond;
  selected?: boolean;
};

/**
 * Tek bir bagi cizer.
 *
 * Ikili baglarda ikinci cizginin nereye konacagi gorunumu belirler:
 * her iki ucun komsulari ayni tarafta topluysa (halka veya dallanmis
 * zincir) ikinci cizgi o tarafa, kisaltilmis olarak cizilir; aksi halde
 * iki cizgi bagin iki yanina simetrik yerlestirilir.
 */
export default function BondShape({ molecule, bond, selected }: Props) {
  const a = getAtom(molecule, bond.a1);
  const b = getAtom(molecule, bond.a2);
  if (!a || !b) return null;

  const [start, end] = trimForLabels(molecule, a, b);
  const color = selected ? 'var(--accent)' : '#1c2029';
  const width = BOND_WIDTH + (selected ? 1 : 0);

  if (bond.stereo === 'wedge') {
    return <WedgeBond start={start} end={end} color={color} />;
  }
  if (bond.stereo === 'hash') {
    return <HashBond start={start} end={end} color={color} />;
  }

  const line = (p: GeomPoint, q: GeomPoint, key?: string) => (
    <line
      key={key}
      x1={p.x}
      y1={p.y}
      x2={q.x}
      y2={q.y}
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
    />
  );

  if (bond.order === 1) return line(start, end);

  const normal = perpendicular(start, end);

  if (bond.order === 3) {
    return (
      <>
        {line(start, end, 'center')}
        {line(offset(start, normal, BOND_GAP), offset(end, normal, BOND_GAP), 'up')}
        {line(offset(start, normal, -BOND_GAP), offset(end, normal, -BOND_GAP), 'down')}
      </>
    );
  }

  // Ikili bag
  const side = crowdedSide(molecule, bond, start, end);
  if (side === 0) {
    // Simetrik cift cizgi
    const half = BOND_GAP / 2;
    return (
      <>
        {line(offset(start, normal, half), offset(end, normal, half), 'a')}
        {line(offset(start, normal, -half), offset(end, normal, -half), 'b')}
      </>
    );
  }

  // Ic cizgi: kalabalik tarafa, iki ucundan %15 kisaltilmis.
  const inner = shorten(
    offset(start, normal, BOND_GAP * side),
    offset(end, normal, BOND_GAP * side),
    0.15,
  );
  return (
    <>
      {line(start, end, 'main')}
      {line(inner[0], inner[1], 'inner')}
    </>
  );
}

function WedgeBond({ start, end, color }: { start: GeomPoint; end: GeomPoint; color: string }) {
  const n = perpendicular(start, end);
  const half = BOND_GAP * 0.9;
  const p1 = offset(end, n, half);
  const p2 = offset(end, n, -half);
  return (
    <polygon
      points={`${start.x},${start.y} ${p1.x},${p1.y} ${p2.x},${p2.y}`}
      fill={color}
      stroke={color}
      strokeWidth={0.5}
      strokeLinejoin="round"
    />
  );
}

function HashBond({ start, end, color }: { start: GeomPoint; end: GeomPoint; color: string }) {
  const n = perpendicular(start, end);
  const len = distance(start, end);
  const steps = Math.max(3, Math.round(len / 5));
  const bars = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const mid = { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t };
    const half = BOND_GAP * 0.9 * t; // uca dogru genisler
    const p1 = offset(mid, n, half);
    const p2 = offset(mid, n, -half);
    bars.push(
      <line
        key={i}
        x1={p1.x}
        y1={p1.y}
        x2={p2.x}
        y2={p2.y}
        stroke={color}
        strokeWidth={BOND_WIDTH}
        strokeLinecap="round"
      />,
    );
  }
  return <>{bars}</>;
}

// --- geometri yardimcilari ---

const perpendicular = (a: GeomPoint, b: GeomPoint): GeomPoint => {
  const len = distance(a, b) || 1;
  return { x: -(b.y - a.y) / len, y: (b.x - a.x) / len };
};

const offset = (p: GeomPoint, normal: GeomPoint, amount: number): GeomPoint => ({
  x: p.x + normal.x * amount,
  y: p.y + normal.y * amount,
});

/** Dogru parcasini iki ucundan `fraction` oraninda kisaltir. */
function shorten(a: GeomPoint, b: GeomPoint, fraction: number): [GeomPoint, GeomPoint] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return [
    { x: a.x + dx * fraction, y: a.y + dy * fraction },
    { x: b.x - dx * fraction, y: b.y - dy * fraction },
  ];
}

/** Etiketi gorunen uclarda bag cizgisini metnin disinda baslatir. */
function trimForLabels(mol: Molecule, a: Atom, b: Atom): [GeomPoint, GeomPoint] {
  const len = distance(a, b) || 1;
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  const trimA = isLabelVisible(mol, a) ? LABEL_RADIUS : 0;
  const trimB = isLabelVisible(mol, b) ? LABEL_RADIUS : 0;
  return [
    { x: a.x + ux * trimA, y: a.y + uy * trimA },
    { x: b.x - ux * trimB, y: b.y - uy * trimB },
  ];
}

/**
 * Ikili bagin komsularinin hangi tarafta yogunlastigi.
 * @returns +1 / -1 kalabalik taraf, 0 ise iki taraf dengeli
 */
function crowdedSide(mol: Molecule, bond: Bond, start: GeomPoint, end: GeomPoint): number {
  const normal = perpendicular(start, end);
  const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };

  let score = 0;
  for (const end0 of [bond.a1, bond.a2] as const) {
    for (const neighborId of neighborsOf(mol, end0)) {
      if (neighborId === bond.a1 || neighborId === bond.a2) continue;
      const n = getAtom(mol, neighborId);
      if (!n) continue;
      // Komsunun bag eksenine gore hangi yarim duzlemde oldugu
      score += Math.sign((n.x - mid.x) * normal.x + (n.y - mid.y) * normal.y);
    }
  }
  return Math.sign(score);
}
