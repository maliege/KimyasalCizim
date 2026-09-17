import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  addAtom,
  addBond,
  atomsInRect,
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
import {
  BOND_LENGTH,
  atomAt,
  bondAt,
  pointAt,
  preferredBondAngle,
  snapToGrid,
} from '../model/geometry';
import type { Point } from '../model/geometry';
import { placeTemplate } from '../model/templates';
import { placeGroup } from '../model/groups';
import MoleculeSvg from '../render/MoleculeSvg';
import type { Rect } from '../render/MoleculeSvg';
import type { AtomId, BondOrder, Molecule } from '../model/types';
import type { EditorAction, EditorState } from './editorReducer';
import { toWorld, zoomAt, panBy } from './viewport';
import type { Viewport } from './viewport';
import type { StereoLabels } from '../rdkit/useMoleculeInfo';

type Props = {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
  width: number;
  height: number;
  viewport: Viewport;
  onViewportChange: (viewport: Viewport) => void;
  /** CIP stereo etiketleri (RDKit'ten, gecikmeli hesaplanir) */
  stereo?: StereoLabels | null;
  /** Disa aktarma tuvale erisebilsin diye ref disaridan verilir. */
  svgRef: React.RefObject<SVGSVGElement | null>;
};

/** Surukleme oturumu — pointerdown ile acilir, pointerup ile kapanir. */
type Drag =
  | { kind: 'bond'; fromAtom: AtomId; moved: boolean; molAtStart: Molecule }
  | {
      kind: 'move';
      /** Tasinan atomlar: tek atom ya da tum secim */
      atomIds: AtomId[];
      /** Yapisma kontrolu icin — yalniz tek atom tasinirken anlamli */
      soloAtom: AtomId | null;
      molAtStart: Molecule;
      start: Point;
      moved: boolean;
    }
  | { kind: 'pan'; lastScreen: Point }
  | { kind: 'box'; start: Point }
  | null;

export default function Canvas({
  state,
  dispatch,
  width,
  height,
  viewport,
  onViewportChange,
  stereo,
  svgRef,
}: Props) {
  const dragRef = useRef<Drag>(null);
  const [preview, setPreview] = useState<Rect | null>(null);
  const [selectionRect, setSelectionRect] = useState<Rect | null>(null);
  const [hoverAtom, setHoverAtom] = useState<AtomId | null>(null);
  const { molecule, tool } = state;

  /** Fare olayini dunya koordinatina cevirir (yakinlastirma dahil). */
  const toLocal = (e: { clientX: number; clientY: number }): Point => {
    const rect = svgRef.current!.getBoundingClientRect();
    return toWorld(viewport, e.clientX - rect.left, e.clientY - rect.top);
  };

  const screenPoint = (e: { clientX: number; clientY: number }): Point => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  // Tekerlek zoom'u: React'in onWheel'i pasif dinleyici kullandigi icin
  // preventDefault calismaz — yerel dinleyiciyi elle bagliyoruz.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      // Ustel olcek: her tiklamada ayni oranda buyur/kucul.
      const factor = Math.exp(-e.deltaY * 0.0015);
      onViewportChange(zoomAt(viewport, e.clientX - rect.left, e.clientY - rect.top, factor));
    };

    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [viewport, onViewportChange, svgRef]);

  const commit = (mol: Molecule) => dispatch({ type: 'commit', molecule: mol });

  function handlePointerDown(e: ReactPointerEvent) {
    svgRef.current?.setPointerCapture(e.pointerId);

    // Orta tus (veya Ctrl+surukleme) her araçta tuvali kaydirir.
    if (e.button === 1 || e.ctrlKey || e.metaKey) {
      dragRef.current = { kind: 'pan', lastScreen: screenPoint(e) };
      return;
    }
    if (e.button !== 0) return;

    const point = toLocal(e);
    const hitAtomId = atomAt(molecule, point);
    const hitBondId = hitAtomId ? null : bondAt(molecule, point);

    switch (tool) {
      case 'bond': {
        if (hitBondId) {
          // Var olan baga tiklamak dereceyi dondurur: 1 -> 2 -> 3 -> 1
          const bond = getBond(molecule, hitBondId)!;
          const next = ((bond.order % 3) + 1) as BondOrder;
          commit(updateBond(molecule, hitBondId, { order: next, stereo: 'none' }));
          return;
        }
        // Bos alandan basliyorsak once baslangic atomunu olustur.
        let working = molecule;
        let from = hitAtomId;
        if (!from) {
          const added = addAtom(working, { element: 'C', x: point.x, y: point.y });
          working = added.molecule;
          from = added.atomId;
        }
        dragRef.current = { kind: 'bond', fromAtom: from, moved: false, molAtStart: working };
        dispatch({ type: 'preview', molecule: working });
        return;
      }

      case 'select': {
        if (hitAtomId) {
          const inSelection = state.selectedAtoms.includes(hitAtomId);
          // Secili bir atomu surukleyince tum secim tasinir.
          const atomIds = inSelection && state.selectedAtoms.length > 1
            ? state.selectedAtoms
            : [hitAtomId];

          dragRef.current = {
            kind: 'move',
            atomIds,
            soloAtom: atomIds.length === 1 ? hitAtomId : null,
            molAtStart: molecule,
            start: point,
            moved: false,
          };
          if (!inSelection) dispatch({ type: 'setSelection', atomIds: [hitAtomId] });
        } else {
          // Bos alanda surukleme kutu secimi baslatir.
          dragRef.current = { kind: 'box', start: point };
          setSelectionRect({ x1: point.x, y1: point.y, x2: point.x, y2: point.y });
        }
        return;
      }

      case 'atom': {
        if (hitAtomId) {
          commit(updateAtom(molecule, hitAtomId, { element: state.element, explicitH: undefined }));
        } else {
          commit(addAtom(molecule, { element: state.element, x: point.x, y: point.y }).molecule);
        }
        return;
      }

      case 'erase': {
        if (hitAtomId) commit(deleteAtom(molecule, hitAtomId));
        else if (hitBondId) commit(deleteBond(molecule, hitBondId));
        return;
      }

      case 'chargePlus':
      case 'chargeMinus': {
        if (!hitAtomId) return;
        const atom = getAtom(molecule, hitAtomId)!;
        const delta = tool === 'chargePlus' ? 1 : -1;
        commit(updateAtom(molecule, hitAtomId, { charge: atom.charge + delta }));
        return;
      }

      case 'wedge':
      case 'hash': {
        if (!hitBondId) return;
        const bond = getBond(molecule, hitBondId)!;
        if (bond.stereo === tool) {
          // Ayni araca tekrar tiklamak kamanin yonunu cevirir.
          commit(updateBond(molecule, hitBondId, { a1: bond.a2, a2: bond.a1 }));
        } else {
          commit(updateBond(molecule, hitBondId, { stereo: tool, order: 1 }));
        }
        return;
      }

      case 'template':
        commit(placeTemplate(molecule, state.templateId, point, hitAtomId, hitBondId));
        return;

      case 'group':
        commit(placeGroup(molecule, state.groupId, point, hitAtomId));
        return;
    }
  }

  function handlePointerMove(e: ReactPointerEvent) {
    const drag = dragRef.current;

    if (!drag) {
      setHoverAtom(atomAt(molecule, toLocal(e)));
      return;
    }

    if (drag.kind === 'pan') {
      const now = screenPoint(e);
      onViewportChange(panBy(viewport, now.x - drag.lastScreen.x, now.y - drag.lastScreen.y));
      drag.lastScreen = now;
      return;
    }

    const point = toLocal(e);

    if (drag.kind === 'box') {
      setSelectionRect({ x1: drag.start.x, y1: drag.start.y, x2: point.x, y2: point.y });
      return;
    }

    if (drag.kind === 'bond') {
      const origin = getAtom(drag.molAtStart, drag.fromAtom)!;
      const target = atomAt(drag.molAtStart, point, 15, drag.fromAtom);
      const end = target
        ? getAtom(drag.molAtStart, target)!
        : snapToGrid(origin, point, !e.shiftKey);
      setHoverAtom(target);
      setPreview({ x1: origin.x, y1: origin.y, x2: end.x, y2: end.y });
      drag.moved = true;
      return;
    }

    if (drag.kind === 'move') {
      drag.moved = true;
      // Surukleme sirasinda gecmise yazmiyoruz — tek adimda geri alinsin.
      const moved = drag.soloAtom
        ? moveAtom(drag.molAtStart, drag.soloAtom, point.x, point.y)
        : translateAtoms(
            drag.molAtStart,
            drag.atomIds,
            point.x - drag.start.x,
            point.y - drag.start.y,
          );
      dispatch({ type: 'preview', molecule: moved });
      setHoverAtom(drag.soloAtom ? atomAt(molecule, point, 15, drag.soloAtom) : null);
    }
  }

  function handlePointerUp(e: ReactPointerEvent) {
    const drag = dragRef.current;
    dragRef.current = null;
    setPreview(null);
    svgRef.current?.releasePointerCapture(e.pointerId);
    if (!drag) return;

    if (drag.kind === 'pan') return;

    const point = toLocal(e);

    if (drag.kind === 'box') {
      setSelectionRect(null);
      dispatch({
        type: 'setSelection',
        atomIds: atomsInRect(molecule, {
          x1: drag.start.x,
          y1: drag.start.y,
          x2: point.x,
          y2: point.y,
        }),
      });
      return;
    }

    if (drag.kind === 'bond') {
      commit(
        finishBond(drag.molAtStart, drag.fromAtom, point, drag.moved, state.bondOrder, e.shiftKey),
      );
      setHoverAtom(null);
      return;
    }

    if (drag.kind === 'move') {
      if (!drag.moved) {
        dispatch({ type: 'preview', molecule: drag.molAtStart });
        return;
      }

      if (drag.soloAtom) {
        // Baska bir atomun uzerine birakildiysa ikisini birlestir.
        const target = atomAt(molecule, point, 15, drag.soloAtom);
        const moved = moveAtom(drag.molAtStart, drag.soloAtom, point.x, point.y);
        commit(target ? mergeAtoms(moved, target, drag.soloAtom) : moved);
      } else {
        commit(
          translateAtoms(
            drag.molAtStart,
            drag.atomIds,
            point.x - drag.start.x,
            point.y - drag.start.y,
          ),
        );
      }
      setHoverAtom(null);
    }
  }

  return (
    <MoleculeSvg
      ref={svgRef}
      molecule={molecule}
      width={width}
      height={height}
      viewport={viewport}
      preview={preview}
      selectionRect={selectionRect}
      hoverAtomId={hoverAtom}
      stereo={stereo}
      highlight={{ atomIds: new Set(state.selectedAtoms) }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => setHoverAtom(null)}
      onContextMenu={(e) => e.preventDefault()}
      style={{ display: 'block', background: '#fff', touchAction: 'none', cursor: cursorFor(tool) }}
    />
  );
}

/**
 * Bag surukleme jestini sonuclandirir.
 *
 * - Baska bir atomun uzerinde biraktiysak o atoma baglar
 * - Suruklenmeden birakildiysa (tek tiklama) uygun bir acida yeni atom acar
 * - Aksi halde yakalanmis konumda yeni atom olusturur
 */
function finishBond(
  mol: Molecule,
  fromId: AtomId,
  point: Point,
  moved: boolean,
  order: BondOrder,
  freeAngle: boolean,
): Molecule {
  const origin = getAtom(mol, fromId);
  if (!origin) return mol;

  const targetId = atomAt(mol, point, 15, fromId);
  if (targetId) {
    const existing = findBondBetween(mol, fromId, targetId);
    if (existing) {
      // Var olan bagin uzerine cizmek dereceyi degistirir.
      return updateBond(mol, existing.id, { order });
    }
    return addBond(mol, fromId, targetId, order);
  }

  const end =
    moved && !samePoint(origin, point)
      ? snapToGrid(origin, point, !freeAngle)
      : pointAt(origin, preferredBondAngle(mol, fromId), BOND_LENGTH);

  const added = addAtom(mol, { element: 'C', x: end.x, y: end.y });
  return addBond(added.molecule, fromId, added.atomId, order);
}

const samePoint = (a: Point, b: Point): boolean =>
  Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2;

function cursorFor(tool: EditorState['tool']): string {
  switch (tool) {
    case 'select':
      return 'default';
    case 'erase':
      return 'not-allowed';
    default:
      return 'crosshair';
  }
}
