import {
  addAtom,
  addBond,
  deleteAtom,
  deleteBond,
  findBondBetween,
  getAtom,
  getBond,
  mergeAtoms,
  moveAtom,
  translateAtoms,
  updateAtom,
  updateBond,
} from '../model/molecule';
import { BOND_LENGTH, atomAt, bondAt, pointAt, preferredBondAngle, snapToGrid } from '../model/geometry';
import type { Point } from '../model/geometry';
import { placeTemplate } from '../model/templates';
import { placeGroup } from '../model/groups';
import type { AtomId, BondOrder, Molecule } from '../model/types';
import type { ToolId } from './editorReducer';
import { hasCommonIsotopes, nextIsotope } from '../model/isotopes';

/**
 * Fare jestlerinin *saf* karar mantigi.
 *
 * Canvas bilesenimiz yalnizca olaylari koordinata cevirip buradaki
 * kararlari uygular — React'e gomulu olmayan her sey burada oldugu icin
 * jest davranisi dogrudan test edilebilir.
 */

/**
 * Bir atoma "degdi" sayilmak icin gereken yakinlik — *ekran pikseli*.
 *
 * Dunya biriminde sabitlenseydi uzaklastirinca hedefler kucuk kalirdi:
 * 0.2x yakinlastirmada 15 dunya birimi yalnizca 3 piksel eder. Cagiran
 * taraf bunu `viewport.scale`'e bolerek dunya birimine cevirir.
 */
export const HIT_RADIUS_PX = 15;

/** Parmak fareden kalindir; dokunmatikte hedefi buyutuyoruz. */
export const HIT_RADIUS_TOUCH_PX = 26;

/** Varsayilan yaricap (1:1 yakinlastirmada piksel = dunya birimi). */
export const SNAP_RADIUS = HIT_RADIUS_PX;

/** Bag aracinin bos alandan basladiginda actigi varsayilan element. */
const DEFAULT_ELEMENT = 'C';

export type TapContext = {
  tool: ToolId;
  /** Atom aracinin yerlestirecegi element */
  element: string;
  bondOrder: BondOrder;
  templateId: string;
  groupId: string;
  selectedAtoms: AtomId[];
  /** Vurus yaricapi, dunya biriminde. Verilmezse 1:1 varsayilir. */
  hitRadius?: number;
};

/**
 * Tuvale basma aninin sonucu. Canvas bunu yorumlar:
 * `commit` gecmise yazilir, `start*` bir surukleme oturumu acar.
 */
export type TapOutcome =
  | { kind: 'none' }
  | { kind: 'commit'; molecule: Molecule }
  /** Bag surukleme basladi; `molecule` baslangic atomunu icerebilir */
  | { kind: 'startBond'; molecule: Molecule; fromAtom: AtomId }
  /** Zincir surukleme basladi; bag aracindaki gibi baslangic atomu acilmis olabilir */
  | { kind: 'startChain'; molecule: Molecule; fromAtom: AtomId }
  | {
      kind: 'startMove';
      atomIds: AtomId[];
      /** Yalniz tek atom tasiniyorsa kimligi — birlestirme buna bagli */
      soloAtom: AtomId | null;
      /** Secim degismeliyse yeni secim, degismeyecekse null */
      select: AtomId[] | null;
    }
  | { kind: 'startBox' };

/** Tuvale basildiginda ne olacagina karar verir. */
export function resolveTap(mol: Molecule, point: Point, ctx: TapContext): TapOutcome {
  const radius = ctx.hitRadius ?? SNAP_RADIUS;
  const hitAtomId = atomAt(mol, point, radius);
  // Atoma degdiysek bagi aramayiz; atom her zaman onceliklidir.
  const hitBondId = hitAtomId ? null : bondAt(mol, point, radius * 0.55);

  switch (ctx.tool) {
    case 'chain': {
      if (hitAtomId) return { kind: 'startChain', molecule: mol, fromAtom: hitAtomId };
      const added = addAtom(mol, { element: DEFAULT_ELEMENT, x: point.x, y: point.y });
      return { kind: 'startChain', molecule: added.molecule, fromAtom: added.atomId };
    }

    case 'bond': {
      if (hitBondId) {
        // Var olan baga tiklamak dereceyi dondurur: 1 -> 2 -> 3 -> 1
        const bond = getBond(mol, hitBondId)!;
        const order = ((bond.order % 3) + 1) as BondOrder;
        return {
          kind: 'commit',
          molecule: updateBond(mol, hitBondId, { order, stereo: 'none' }),
        };
      }
      // Bos alandan basliyorsak once baslangic atomunu acariz.
      if (hitAtomId) {
        return { kind: 'startBond', molecule: mol, fromAtom: hitAtomId };
      }
      const added = addAtom(mol, { element: DEFAULT_ELEMENT, x: point.x, y: point.y });
      return { kind: 'startBond', molecule: added.molecule, fromAtom: added.atomId };
    }

    case 'select': {
      if (!hitAtomId) return { kind: 'startBox' };

      const inSelection = ctx.selectedAtoms.includes(hitAtomId);
      // Secili bir atomu surukleyince tum secim birlikte tasinir.
      const wholeSelection = inSelection && ctx.selectedAtoms.length > 1;
      const atomIds = wholeSelection ? ctx.selectedAtoms : [hitAtomId];

      return {
        kind: 'startMove',
        atomIds,
        soloAtom: wholeSelection ? null : hitAtomId,
        select: inSelection ? null : [hitAtomId],
      };
    }

    case 'atom':
      return {
        kind: 'commit',
        molecule: hitAtomId
          ? updateAtom(mol, hitAtomId, { element: ctx.element, explicitH: undefined })
          : addAtom(mol, { element: ctx.element, x: point.x, y: point.y }).molecule,
      };

    case 'erase': {
      if (hitAtomId) return { kind: 'commit', molecule: deleteAtom(mol, hitAtomId) };
      if (hitBondId) return { kind: 'commit', molecule: deleteBond(mol, hitBondId) };
      return { kind: 'none' };
    }

    case 'chargePlus':
    case 'chargeMinus': {
      if (!hitAtomId) return { kind: 'none' };
      const atom = getAtom(mol, hitAtomId)!;
      const delta = ctx.tool === 'chargePlus' ? 1 : -1;
      return {
        kind: 'commit',
        molecule: updateAtom(mol, hitAtomId, { charge: atom.charge + delta }),
      };
    }

    case 'isotope': {
      if (!hitAtomId) return { kind: 'none' };
      const atom = getAtom(mol, hitAtomId)!;
      if (!hasCommonIsotopes(atom.element)) return { kind: 'none' };
      return {
        kind: 'commit',
        molecule: updateAtom(mol, hitAtomId, { isotope: nextIsotope(atom.element, atom.isotope) }),
      };
    }

    case 'wedge':
    case 'hash': {
      if (!hitBondId) return { kind: 'none' };
      const bond = getBond(mol, hitBondId)!;
      // Ayni araca tekrar tiklamak kamanin sivri ucunu ters cevirir.
      const molecule =
        bond.stereo === ctx.tool
          ? updateBond(mol, hitBondId, { a1: bond.a2, a2: bond.a1 })
          : updateBond(mol, hitBondId, { stereo: ctx.tool, order: 1 });
      return { kind: 'commit', molecule };
    }

    case 'template':
      return {
        kind: 'commit',
        molecule: placeTemplate(mol, ctx.templateId, point, hitAtomId, hitBondId),
      };

    case 'group':
      return { kind: 'commit', molecule: placeGroup(mol, ctx.groupId, point, hitAtomId) };
  }
}

/**
 * Bag surukleme jestini sonuclandirir.
 *
 * - Baska bir atomun uzerinde biraktiysak ona baglar (var olan bag varsa
 *   derecesini gunceller)
 * - Suruklenmeden birakildiysa (tek tiklama) bos bir acida yeni atom acar
 * - Aksi halde yakalanmis konumda yeni atom olusturur
 */
export function finishBond(
  mol: Molecule,
  fromId: AtomId,
  point: Point,
  moved: boolean,
  order: BondOrder,
  freeAngle: boolean,
  hitRadius = SNAP_RADIUS,
): Molecule {
  const origin = getAtom(mol, fromId);
  if (!origin) return mol;

  const targetId = atomAt(mol, point, hitRadius, fromId);
  if (targetId) {
    const existing = findBondBetween(mol, fromId, targetId);
    // Var olan bagin uzerine cizmek dereceyi degistirir, ikinci bag acmaz.
    if (existing) return updateBond(mol, existing.id, { order });
    return addBond(mol, fromId, targetId, order);
  }

  const end =
    moved && !samePoint(origin, point)
      ? snapToGrid(origin, point, !freeAngle)
      : pointAt(origin, preferredBondAngle(mol, fromId), BOND_LENGTH);

  const added = addAtom(mol, { element: DEFAULT_ELEMENT, x: end.x, y: end.y });
  return addBond(added.molecule, fromId, added.atomId, order);
}

/** Surukleme sirasindaki ara konum — birlestirme yapmaz. */
export function previewMove(
  molAtStart: Molecule,
  atomIds: AtomId[],
  soloAtom: AtomId | null,
  start: Point,
  point: Point,
): Molecule {
  if (soloAtom) return moveAtom(molAtStart, soloAtom, point.x, point.y);
  return translateAtoms(molAtStart, atomIds, point.x - start.x, point.y - start.y);
}

/**
 * Birakma ani: tek atom baska bir atomun uzerine dustuyse ikisi birlesir.
 * Coklu secim tasimasinda birlestirme yapilmaz — kullanici bir yapiyi
 * tasiyordur, kaynastirmayi degil.
 */
export function finishMove(
  molAtStart: Molecule,
  atomIds: AtomId[],
  soloAtom: AtomId | null,
  start: Point,
  point: Point,
  hitRadius = SNAP_RADIUS,
): Molecule {
  const moved = previewMove(molAtStart, atomIds, soloAtom, start, point);
  if (!soloAtom) return moved;

  const target = atomAt(molAtStart, point, hitRadius, soloAtom);
  return target ? mergeAtoms(moved, target, soloAtom) : moved;
}

/** Bag aracinda "suruklenmedi" sayilan esik. */
const samePoint = (a: Point, b: Point): boolean =>
  Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2;
