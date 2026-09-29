import { describe, expect, it } from 'vitest';
import {
  addAtom,
  addBond,
  bondsOf,
  emptyMolecule,
  findBondBetween,
  getAtom,
  neighborsOf,
} from '../model/molecule';
import { BOND_LENGTH, distance } from '../model/geometry';
import { finishBond, finishMove, previewMove, resolveTap } from './gestures';
import type { TapContext } from './gestures';
import type { AtomId, Molecule } from '../model/types';

/** Varsayilan arac ayarlari; testler yalniz ilgilendikleri alani ezer. */
const ctx = (overrides: Partial<TapContext> = {}): TapContext => ({
  tool: 'bond',
  element: 'C',
  bondOrder: 1,
  templateId: 'benzene',
  groupId: 'carboxyl',
  selectedAtoms: [],
  ...overrides,
});

/** (0,0) ve (40,0) konumunda iki karbon, aralarinda tekli bag. */
function ethane(): { mol: Molecule; a: AtomId; b: AtomId } {
  let m = emptyMolecule();
  const first = addAtom(m, { element: 'C', x: 0, y: 0 });
  m = first.molecule;
  const second = addAtom(m, { element: 'C', x: BOND_LENGTH, y: 0 });
  m = addBond(second.molecule, first.atomId, second.atomId, 1);
  return { mol: m, a: first.atomId, b: second.atomId };
}

const FAR = { x: 500, y: 500 };

describe('resolveTap · bağ aracı', () => {
  it('boş alanda başlangıç atomu açarak sürükleme başlatır', () => {
    const outcome = resolveTap(emptyMolecule(), { x: 100, y: 100 }, ctx());

    expect(outcome.kind).toBe('startBond');
    if (outcome.kind !== 'startBond') return;
    expect(outcome.molecule.atoms).toHaveLength(1);
    expect(getAtom(outcome.molecule, outcome.fromAtom)).toMatchObject({
      element: 'C',
      x: 100,
      y: 100,
    });
  });

  it('var olan atomdan başlarken molekülü değiştirmez', () => {
    const { mol, a } = ethane();
    const outcome = resolveTap(mol, { x: 0, y: 0 }, ctx());

    expect(outcome.kind).toBe('startBond');
    if (outcome.kind !== 'startBond') return;
    expect(outcome.molecule).toBe(mol);
    expect(outcome.fromAtom).toBe(a);
  });

  it('bağa tıklayınca dereceyi 1→2→3→1 döndürür', () => {
    let { mol } = ethane();
    const mid = { x: BOND_LENGTH / 2, y: 0 };

    for (const beklenen of [2, 3, 1]) {
      const outcome = resolveTap(mol, mid, ctx());
      expect(outcome.kind).toBe('commit');
      if (outcome.kind !== 'commit') return;
      mol = outcome.molecule;
      expect(mol.bonds[0].order).toBe(beklenen);
      expect(mol.bonds).toHaveLength(1); // ikinci bağ açmamalı
    }
  });

  it('derece döndürürken stereo işaretini temizler', () => {
    const { mol, a, b } = ethane();
    const wedged = addBond(mol, a, b, 1, 'wedge');

    const outcome = resolveTap(wedged, { x: BOND_LENGTH / 2, y: 0 }, ctx());
    if (outcome.kind !== 'commit') throw new Error('commit bekleniyordu');
    expect(outcome.molecule.bonds[0].stereo).toBe('none');
  });

  it('atom bağın üstündeyken atomu önceler', () => {
    // Bağın ucu aynı zamanda bir atom; tıklama atoma gitmeli (sürükleme),
    // derece döndürmeye değil.
    const { mol } = ethane();
    expect(resolveTap(mol, { x: 2, y: 2 }, ctx()).kind).toBe('startBond');
  });
});

describe('resolveTap · seçme aracı', () => {
  it('boş alanda kutu seçimi başlatır', () => {
    const { mol } = ethane();
    expect(resolveTap(mol, FAR, ctx({ tool: 'select' })).kind).toBe('startBox');
  });

  it('seçili olmayan atoma basınca onu seçip tek başına taşır', () => {
    const { mol, a } = ethane();
    const outcome = resolveTap(mol, { x: 0, y: 0 }, ctx({ tool: 'select' }));

    expect(outcome).toMatchObject({
      kind: 'startMove',
      atomIds: [a],
      soloAtom: a,
      select: [a],
    });
  });

  it('çoklu seçimin parçasına basınca tüm seçimi taşır', () => {
    const { mol, a, b } = ethane();
    const outcome = resolveTap(
      mol,
      { x: 0, y: 0 },
      ctx({ tool: 'select', selectedAtoms: [a, b] }),
    );

    expect(outcome).toMatchObject({ kind: 'startMove', atomIds: [a, b], soloAtom: null });
    // Zaten seçili olana basmak seçimi bozmamalı.
    if (outcome.kind === 'startMove') expect(outcome.select).toBeNull();
  });

  it('tek elemanlı seçimde birleştirmeye izin verir (solo kalır)', () => {
    const { mol, a } = ethane();
    const outcome = resolveTap(mol, { x: 0, y: 0 }, ctx({ tool: 'select', selectedAtoms: [a] }));
    if (outcome.kind !== 'startMove') throw new Error('startMove bekleniyordu');
    expect(outcome.soloAtom).toBe(a);
  });
});

describe('resolveTap · atom aracı', () => {
  it('boş alana seçili elementi koyar', () => {
    const outcome = resolveTap(emptyMolecule(), { x: 10, y: 20 }, ctx({ tool: 'atom', element: 'O' }));
    if (outcome.kind !== 'commit') throw new Error('commit bekleniyordu');
    expect(outcome.molecule.atoms[0]).toMatchObject({ element: 'O', x: 10, y: 20 });
  });

  it('var olan atomun elementini değiştirir', () => {
    const { mol, a } = ethane();
    const outcome = resolveTap(mol, { x: 0, y: 0 }, ctx({ tool: 'atom', element: 'N' }));
    if (outcome.kind !== 'commit') throw new Error('commit bekleniyordu');

    expect(getAtom(outcome.molecule, a)!.element).toBe('N');
    expect(outcome.molecule.atoms).toHaveLength(2); // yeni atom eklenmemeli
  });

  it('element değişiminde sabitlenmiş hidrojen sayısını bırakır', () => {
    // .mol içe aktarımından gelen explicitH, element değişince anlamsızlaşır.
    let { mol, a } = ethane();
    mol = { ...mol, atoms: mol.atoms.map((x) => (x.id === a ? { ...x, explicitH: 3 } : x)) };

    const outcome = resolveTap(mol, { x: 0, y: 0 }, ctx({ tool: 'atom', element: 'O' }));
    if (outcome.kind !== 'commit') throw new Error('commit bekleniyordu');
    expect(getAtom(outcome.molecule, a)!.explicitH).toBeUndefined();
  });
});

describe('resolveTap · silgi', () => {
  it('atomu ve bağlarını siler', () => {
    const { mol } = ethane();
    const outcome = resolveTap(mol, { x: 0, y: 0 }, ctx({ tool: 'erase' }));
    if (outcome.kind !== 'commit') throw new Error('commit bekleniyordu');
    expect(outcome.molecule.atoms).toHaveLength(1);
    expect(outcome.molecule.bonds).toHaveLength(0);
  });

  it('yalnız bağı siler, atomları bırakır', () => {
    const { mol } = ethane();
    const outcome = resolveTap(mol, { x: BOND_LENGTH / 2, y: 0 }, ctx({ tool: 'erase' }));
    if (outcome.kind !== 'commit') throw new Error('commit bekleniyordu');
    expect(outcome.molecule.atoms).toHaveLength(2);
    expect(outcome.molecule.bonds).toHaveLength(0);
  });

  it('boşluğa tıklamak bir şey yapmaz', () => {
    const { mol } = ethane();
    expect(resolveTap(mol, FAR, ctx({ tool: 'erase' })).kind).toBe('none');
  });
});

describe('resolveTap · yük araçları', () => {
  it('yükü artırır ve azaltır', () => {
    const { mol, a } = ethane();

    const arti = resolveTap(mol, { x: 0, y: 0 }, ctx({ tool: 'chargePlus' }));
    if (arti.kind !== 'commit') throw new Error('commit bekleniyordu');
    expect(getAtom(arti.molecule, a)!.charge).toBe(1);

    const eksi = resolveTap(arti.molecule, { x: 0, y: 0 }, ctx({ tool: 'chargeMinus' }));
    if (eksi.kind !== 'commit') throw new Error('commit bekleniyordu');
    expect(getAtom(eksi.molecule, a)!.charge).toBe(0);
  });

  it('atom yoksa bir şey yapmaz', () => {
    const { mol } = ethane();
    expect(resolveTap(mol, FAR, ctx({ tool: 'chargePlus' })).kind).toBe('none');
  });
});

describe('resolveTap · stereo araçları', () => {
  const mid = { x: BOND_LENGTH / 2, y: 0 };

  it('bağa kama işareti koyar ve dereceyi tekliye indirir', () => {
    const { mol, a, b } = ethane();
    const double = addBond(mol, a, b, 2);

    const outcome = resolveTap(double, mid, ctx({ tool: 'wedge' }));
    if (outcome.kind !== 'commit') throw new Error('commit bekleniyordu');
    expect(outcome.molecule.bonds[0]).toMatchObject({ stereo: 'wedge', order: 1 });
  });

  it('aynı aracı tekrar uygulayınca kamanın yönünü çevirir', () => {
    const { mol, a, b } = ethane();
    const first = resolveTap(mol, mid, ctx({ tool: 'wedge' }));
    if (first.kind !== 'commit') throw new Error('commit bekleniyordu');
    expect(first.molecule.bonds[0]).toMatchObject({ a1: a, a2: b });

    const flipped = resolveTap(first.molecule, mid, ctx({ tool: 'wedge' }));
    if (flipped.kind !== 'commit') throw new Error('commit bekleniyordu');
    expect(flipped.molecule.bonds[0]).toMatchObject({ a1: b, a2: a, stereo: 'wedge' });
  });

  it('kamadan kesikliye geçerken yönü korur', () => {
    const { mol, a, b } = ethane();
    const wedged = resolveTap(mol, mid, ctx({ tool: 'wedge' }));
    if (wedged.kind !== 'commit') throw new Error('commit bekleniyordu');

    const hashed = resolveTap(wedged.molecule, mid, ctx({ tool: 'hash' }));
    if (hashed.kind !== 'commit') throw new Error('commit bekleniyordu');
    expect(hashed.molecule.bonds[0]).toMatchObject({ a1: a, a2: b, stereo: 'hash' });
  });

  it('bağ yoksa bir şey yapmaz', () => {
    const { mol } = ethane();
    expect(resolveTap(mol, FAR, ctx({ tool: 'wedge' })).kind).toBe('none');
    // Atomun üstü de bağ sayılmaz
    expect(resolveTap(mol, { x: 0, y: 0 }, ctx({ tool: 'hash' })).kind).toBe('none');
  });
});

describe('resolveTap · şablon ve grup araçları', () => {
  it('boş alana halka yerleştirir', () => {
    const outcome = resolveTap(emptyMolecule(), { x: 100, y: 100 }, ctx({ tool: 'template' }));
    if (outcome.kind !== 'commit') throw new Error('commit bekleniyordu');
    expect(outcome.molecule.atoms).toHaveLength(6);
  });

  it('atoma grup bağlar', () => {
    const { mol, a } = ethane();
    const outcome = resolveTap(mol, { x: 0, y: 0 }, ctx({ tool: 'group', groupId: 'hydroxyl' }));
    if (outcome.kind !== 'commit') throw new Error('commit bekleniyordu');

    expect(outcome.molecule.atoms.some((x) => x.element === 'O')).toBe(true);
    expect(neighborsOf(outcome.molecule, a)).toHaveLength(2);
  });
});

describe('finishBond', () => {
  it('boşluğa sürükleyince yeni atom ve bağ açar', () => {
    const { mol, a } = ethane();
    const result = finishBond(mol, a, { x: -60, y: -60 }, true, 1, false);

    expect(result.atoms).toHaveLength(3);
    const yeni = result.atoms.at(-1)!;
    // Açı yakalanır ama uzunluk her zaman standarttır.
    expect(distance(getAtom(result, a)!, yeni)).toBeCloseTo(BOND_LENGTH, 6);
  });

  it('Shift ile serbest açıda bırakır', () => {
    const { mol, a } = ethane();
    const serbest = { x: -37, y: -91 };
    const result = finishBond(mol, a, serbest, true, 1, true);

    expect(result.atoms.at(-1)).toMatchObject({ x: serbest.x, y: serbest.y });
  });

  it('var olan atomun üstüne bırakınca ona bağlar', () => {
    const { mol, a, b } = ethane();
    // a'dan b'ye zaten bağ var; üçüncü bir atom ekleyip ona çekelim.
    const third = addAtom(mol, { element: 'C', x: 0, y: BOND_LENGTH });
    const result = finishBond(third.molecule, a, { x: 0, y: BOND_LENGTH }, true, 1, false);

    expect(result.atoms).toHaveLength(3); // yeni atom açılmamalı
    expect(findBondBetween(result, a, third.atomId)).toBeDefined();
    expect(findBondBetween(result, a, b)).toBeDefined();
  });

  it('var olan bağın üstüne çizince ikinci bağ açmaz, derecesini değiştirir', () => {
    const { mol, a, b } = ethane();
    const result = finishBond(mol, a, { x: BOND_LENGTH, y: 0 }, true, 2, false);

    expect(result.bonds).toHaveLength(1);
    expect(result.bonds[0].order).toBe(2);
    expect(result.atoms).toHaveLength(2);
    expect(findBondBetween(result, a, b)!.order).toBe(2);
  });

  it('sürüklenmeden bırakılınca boş bir açıda zincir uzatır', () => {
    const { mol, b } = ethane();
    // b'nin tek komşusu solunda; yeni bağ zikzak yapmalı, üstüne binmemeli.
    const result = finishBond(mol, b, { x: BOND_LENGTH, y: 0 }, false, 1, false);

    expect(result.atoms).toHaveLength(3);
    const yeni = result.atoms.at(-1)!;
    expect(distance(getAtom(result, b)!, yeni)).toBeCloseTo(BOND_LENGTH, 6);
    // Var olan komsunun uzerine dusmemeli
    expect(distance(yeni, getAtom(result, mol.atoms[0].id)!)).toBeGreaterThan(1);
  });

  it('seçili bağ derecesini kullanır', () => {
    const { mol, a } = ethane();
    const result = finishBond(mol, a, { x: -60, y: -60 }, true, 3, false);
    expect(result.bonds.at(-1)!.order).toBe(3);
  });

  it('kaynak atom yoksa molekülü olduğu gibi döner', () => {
    const { mol } = ethane();
    expect(finishBond(mol, 'boyle-bir-atom-yok', FAR, true, 1, false)).toBe(mol);
  });
});

describe('previewMove ve finishMove', () => {
  it('tek atomu imlecin konumuna taşır', () => {
    const { mol, a } = ethane();
    const moved = previewMove(mol, [a], a, { x: 0, y: 0 }, { x: 10, y: 90 });
    expect(getAtom(moved, a)).toMatchObject({ x: 10, y: 90 });
  });

  it('tek atom başka atomun üstüne bırakılınca birleşir', () => {
    // Üç atomlu zincir: uçları üst üste getirip halka kapatmak
    let m = emptyMolecule();
    const ids: AtomId[] = [];
    for (let i = 0; i < 3; i++) {
      const added = addAtom(m, { element: 'C', x: i * BOND_LENGTH, y: 0 });
      m = added.molecule;
      ids.push(added.atomId);
      if (i > 0) m = addBond(m, ids[i - 1], ids[i], 1);
    }

    const target = getAtom(m, ids[2])!;
    const result = finishMove(m, [ids[0]], ids[0], { x: 0, y: 0 }, { x: target.x, y: target.y });

    expect(result.atoms).toHaveLength(2);
    // Ortadaki atom hem eski hem yeni komsusuyla bagli kalmali
    expect(bondsOf(result, ids[1])).toHaveLength(1);
  });

  it('uzağa bırakılan tek atom birleşmez', () => {
    const { mol, a } = ethane();
    const result = finishMove(mol, [a], a, { x: 0, y: 0 }, FAR);
    expect(result.atoms).toHaveLength(2);
    expect(getAtom(result, a)).toMatchObject(FAR);
  });

  it('çoklu seçimi göreli konumları koruyarak öteler', () => {
    const { mol, a, b } = ethane();
    const result = finishMove(mol, [a, b], null, { x: 0, y: 0 }, { x: 25, y: -15 });

    expect(getAtom(result, a)).toMatchObject({ x: 25, y: -15 });
    expect(getAtom(result, b)).toMatchObject({ x: BOND_LENGTH + 25, y: -15 });
    expect(distance(getAtom(result, a)!, getAtom(result, b)!)).toBeCloseTo(BOND_LENGTH, 6);
  });

  it('çoklu seçim taşımasında birleştirme yapmaz', () => {
    // Bir yapıyı başka bir yapının üstüne taşımak onu kaynaştırmamalı;
    // kullanıcı düzen değiştiriyordur, bağ kurmuyordur.
    const { mol, a, b } = ethane();
    const uzak = addAtom(mol, { element: 'C', x: 300, y: 300 });
    const hedef = getAtom(uzak.molecule, uzak.atomId)!;

    const result = finishMove(
      uzak.molecule,
      [a, b],
      null,
      { x: 0, y: 0 },
      { x: hedef.x, y: hedef.y },
    );
    expect(result.atoms).toHaveLength(3);
  });
});

describe('resolveTap · izotop aracı', () => {
  it('karbona tıkladıkça ¹³C → ¹⁴C → doğal döner', () => {
    let { mol, a } = ethane();
    const beklenen = [13, 14, undefined];
    for (const iso of beklenen) {
      const outcome = resolveTap(mol, { x: 0, y: 0 }, ctx({ tool: 'isotope' }));
      if (outcome.kind !== 'commit') throw new Error('commit bekleniyordu');
      mol = outcome.molecule;
      expect(getAtom(mol, a)!.isotope).toBe(iso);
    }
  });

  it('izotop tablosunda olmayan elementte bir şey yapmaz', () => {
    const fe = addAtom(emptyMolecule(), { element: 'Fe', x: 0, y: 0 }).molecule;
    expect(resolveTap(fe, { x: 0, y: 0 }, ctx({ tool: 'isotope' })).kind).toBe('none');
  });
});
