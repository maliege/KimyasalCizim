import { describe, expect, it } from 'vitest';
import { addAtom, addBond, emptyMolecule } from './molecule';
import {
  ANGLE_SNAP,
  BOND_LENGTH,
  angleBetween,
  atomAt,
  bondAt,
  distance,
  distanceToSegment,
  preferredBondAngle,
  snapToGrid,
} from './geometry';

const origin = { x: 100, y: 100 };
const degrees = (rad: number) => (rad * 180) / Math.PI;

describe('snapToGrid', () => {
  it('bağ uzunluğunu sabitler', () => {
    const snapped = snapToGrid(origin, { x: 300, y: 100 });
    expect(distance(origin, snapped)).toBeCloseTo(BOND_LENGTH, 6);
  });

  it('açıyı en yakın 30° katına yakalar', () => {
    // 25° gibi bir yön 30°'ye yuvarlanmali
    const target = { x: origin.x + Math.cos(0.44) * 90, y: origin.y + Math.sin(0.44) * 90 };
    const snapped = snapToGrid(origin, target);
    expect(degrees(angleBetween(origin, snapped))).toBeCloseTo(ANGLE_SNAP, 4);
  });

  it('yakalama kapalıyken noktayı olduğu gibi bırakır', () => {
    const target = { x: 137, y: 211 };
    expect(snapToGrid(origin, target, false)).toBe(target);
  });
});

describe('atomAt', () => {
  const mol = addAtom(emptyMolecule(), { element: 'C', x: 100, y: 100 }).molecule;
  const id = mol.atoms[0].id;

  it('yarıçap içindeki atomu bulur', () => {
    expect(atomAt(mol, { x: 108, y: 104 })).toBe(id);
  });

  it('yarıçap dışında null döner', () => {
    expect(atomAt(mol, { x: 140, y: 140 })).toBeNull();
  });

  it('dışlanan atomu atlar', () => {
    expect(atomAt(mol, { x: 100, y: 100 }, 15, id)).toBeNull();
  });
});

describe('distanceToSegment', () => {
  const a = { x: 0, y: 0 };
  const b = { x: 100, y: 0 };

  it('parça üstündeki dik uzaklığı verir', () => {
    expect(distanceToSegment({ x: 50, y: 12 }, a, b)).toBeCloseTo(12, 6);
  });

  it('parçanın ötesinde uç noktaya olan uzaklığı verir', () => {
    expect(distanceToSegment({ x: 130, y: 0 }, a, b)).toBeCloseTo(30, 6);
  });

  it('sıfır uzunluklu parçayı işler', () => {
    expect(distanceToSegment({ x: 3, y: 4 }, a, a)).toBeCloseTo(5, 6);
  });
});

describe('bondAt', () => {
  it('bağın üstündeki noktayı yakalar', () => {
    let m = emptyMolecule();
    const a = addAtom(m, { element: 'C', x: 0, y: 0 });
    m = a.molecule;
    const b = addAtom(m, { element: 'C', x: 40, y: 0 });
    m = addBond(b.molecule, a.atomId, b.atomId, 1);

    expect(bondAt(m, { x: 20, y: 3 })).toBe(m.bonds[0].id);
    expect(bondAt(m, { x: 20, y: 40 })).toBeNull();
  });
});

describe('preferredBondAngle', () => {
  it('komşusuz atomda sabit bir yön verir', () => {
    const mol = addAtom(emptyMolecule(), { element: 'C', x: 100, y: 100 }).molecule;
    expect(degrees(preferredBondAngle(mol, mol.atoms[0].id))).toBeCloseTo(-30, 4);
  });

  it('tek komşuda zikzak yapar (120°)', () => {
    let m = emptyMolecule();
    const a = addAtom(m, { element: 'C', x: 100, y: 100 });
    m = a.molecule;
    const b = addAtom(m, { element: 'C', x: 140, y: 100 }); // sagda, 0°
    m = addBond(b.molecule, a.atomId, b.atomId, 1);

    expect(degrees(preferredBondAngle(m, a.atomId))).toBeCloseTo(120, 4);
  });

  it('iki komşuda en geniş boşluğun ortasını seçer', () => {
    // Komsular 0° ve 180°'de; en genis bosluk 90° veya -90°
    let m = emptyMolecule();
    const c = addAtom(m, { element: 'C', x: 100, y: 100 });
    m = c.molecule;
    const right = addAtom(m, { element: 'C', x: 140, y: 100 });
    m = addBond(right.molecule, c.atomId, right.atomId, 1);
    const left = addAtom(m, { element: 'C', x: 60, y: 100 });
    m = addBond(left.molecule, c.atomId, left.atomId, 1);

    expect(Math.abs(degrees(preferredBondAngle(m, c.atomId)))).toBeCloseTo(90, 4);
  });
});
