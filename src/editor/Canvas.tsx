import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { atomsInRect, getAtom } from '../model/molecule';
import { atomAt, snapToGrid } from '../model/geometry';
import type { Point } from '../model/geometry';
import MoleculeSvg from '../render/MoleculeSvg';
import type { Rect } from '../render/MoleculeSvg';
import type { AtomId, Molecule } from '../model/types';
import type { EditorAction, EditorState } from './editorReducer';
import { SNAP_RADIUS, finishBond, finishMove, previewMove, resolveTap } from './gestures';
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
    const outcome = resolveTap(molecule, point, {
      tool,
      element: state.element,
      bondOrder: state.bondOrder,
      templateId: state.templateId,
      groupId: state.groupId,
      selectedAtoms: state.selectedAtoms,
    });

    switch (outcome.kind) {
      case 'none':
        return;

      case 'commit':
        commit(outcome.molecule);
        return;

      case 'startBond':
        dragRef.current = {
          kind: 'bond',
          fromAtom: outcome.fromAtom,
          moved: false,
          molAtStart: outcome.molecule,
        };
        // Bos alandan basladiysak yeni atom hemen gorunsun.
        dispatch({ type: 'preview', molecule: outcome.molecule });
        return;

      case 'startMove':
        dragRef.current = {
          kind: 'move',
          atomIds: outcome.atomIds,
          soloAtom: outcome.soloAtom,
          molAtStart: molecule,
          start: point,
          moved: false,
        };
        if (outcome.select) dispatch({ type: 'setSelection', atomIds: outcome.select });
        return;

      case 'startBox':
        dragRef.current = { kind: 'box', start: point };
        setSelectionRect({ x1: point.x, y1: point.y, x2: point.x, y2: point.y });
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
      const target = atomAt(drag.molAtStart, point, SNAP_RADIUS, drag.fromAtom);
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
      dispatch({
        type: 'preview',
        molecule: previewMove(drag.molAtStart, drag.atomIds, drag.soloAtom, drag.start, point),
      });
      setHoverAtom(drag.soloAtom ? atomAt(molecule, point, SNAP_RADIUS, drag.soloAtom) : null);
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

      commit(finishMove(drag.molAtStart, drag.atomIds, drag.soloAtom, drag.start, point));
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
