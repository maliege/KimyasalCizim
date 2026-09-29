import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { atomsInRect, getAtom } from '../model/molecule';
import { atomAt, snapToGrid } from '../model/geometry';
import type { Point } from '../model/geometry';
import MoleculeSvg from '../render/MoleculeSvg';
import type { Rect } from '../render/MoleculeSvg';
import type { AtomId, Molecule } from '../model/types';
import type { EditorAction, EditorState } from './editorReducer';
import { finishBond, finishMove, previewMove, resolveTap } from './gestures';
import { buildChain, chainPoints } from '../model/chain';
import { toWorld, zoomAt, panBy, pinchTo } from './viewport';
import type { Viewport } from './viewport';
import type { StereoLabels } from '../rdkit/useMoleculeInfo';
import { HIT_RADIUS_PX, HIT_RADIUS_TOUCH_PX } from './gestures';

type Props = {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
  width: number;
  height: number;
  viewport: Viewport;
  onViewportChange: (viewport: Viewport) => void;
  /** CIP stereo etiketleri (RDKit'ten, gecikmeli hesaplanir) */
  stereo?: StereoLabels | null;
  errorAtomIds?: Set<string>;
  groupHighlight?: { color: string; atomIds: Set<string> } | null;
  /** Disa aktarma tuvale erisebilsin diye ref disaridan verilir. */
  svgRef: React.RefObject<SVGSVGElement | null>;
};

/** Surukleme oturumu — pointerdown ile acilir, pointerup ile kapanir. */
type Drag =
  | { kind: 'bond'; fromAtom: AtomId; moved: boolean; molAtStart: Molecule }
  | { kind: 'chain'; fromAtom: AtomId; moved: boolean; molAtStart: Molecule }
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
  errorAtomIds,
  groupHighlight,
  svgRef,
}: Props) {
  const dragRef = useRef<Drag>(null);
  /** Ekranda su an basili olan tum isaretciler — coklu dokunma icin. */
  const pointersRef = useRef(new Map<number, Point>());
  /**
   * Iki parmak jesti suruyorsa jestin *baslangic* durumu.
   *
   * Her adimi bir oncekine gore degil basa gore hesapliyoruz: pointermove
   * olaylari parmak basina ayri ayri gelir, yani ara karelerde bir parmak
   * hep bayat kalir. Artimli hesapta bu, iki parmakla kaydirirken olcegin
   * titremesine yol aciyordu.
   */
  const pinchRef = useRef<{ points: readonly [Point, Point]; viewport: Viewport } | null>(null);
  const [preview, setPreview] = useState<Rect | null>(null);
  const [chainPreview, setChainPreview] = useState<{ points: Point[]; label: string } | null>(null);
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

  /** Dokunma hedefi fareden buyuk; yaricap ayrica yakinlastirmaya gore olceklenir. */
  const hitRadiusFor = (e: { pointerType: string }): number =>
    (e.pointerType === 'touch' ? HIT_RADIUS_TOUCH_PX : HIT_RADIUS_PX) / viewport.scale;

  /** Suren tek parmak jestini iptal eder (ikinci parmak inince). */
  function cancelActiveDrag() {
    const drag = dragRef.current;
    dragRef.current = null;
    setPreview(null);
    setSelectionRect(null);
    setHoverAtom(null);
    // Baslamis bir cizim varsa modeli jest oncesine dondur.
    setChainPreview(null);
    if (drag && (drag.kind === 'bond' || drag.kind === 'chain' || drag.kind === 'move')) {
      dispatch({ type: 'preview', molecule: drag.molAtStart });
    }
  }

  function handlePointerDown(e: ReactPointerEvent) {
    pointersRef.current.set(e.pointerId, screenPoint(e));
    capturePointer(svgRef.current, e.pointerId);

    // Ikinci parmak inince tek parmak jesti birakilir ve yakinlastirmaya gecilir.
    if (pointersRef.current.size === 2) {
      cancelActiveDrag();
      pinchRef.current = { points: twoPointers(pointersRef.current), viewport };
      return;
    }
    if (pointersRef.current.size > 2) return;

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
      hitRadius: hitRadiusFor(e),
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

      case 'startChain':
        dragRef.current = {
          kind: 'chain',
          fromAtom: outcome.fromAtom,
          moved: false,
          molAtStart: outcome.molecule,
        };
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
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, screenPoint(e));
    }

    // Iki parmak: yakinlastirma ve kaydirma birlikte, jestin basina gore.
    if (pinchRef.current && pointersRef.current.size >= 2) {
      const { points, viewport: startViewport } = pinchRef.current;
      onViewportChange(pinchTo(startViewport, points, twoPointers(pointersRef.current)));
      return;
    }

    const drag = dragRef.current;

    if (!drag) {
      setHoverAtom(atomAt(molecule, toLocal(e), hitRadiusFor(e)));
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

    if (drag.kind === 'chain') {
      const origin = getAtom(drag.molAtStart, drag.fromAtom)!;
      const points = chainPoints(origin, point, !e.shiftKey);
      setChainPreview({ points: [origin, ...points], label: `+${points.length} C` });
      drag.moved = true;
      return;
    }

    if (drag.kind === 'bond') {
      const origin = getAtom(drag.molAtStart, drag.fromAtom)!;
      const target = atomAt(drag.molAtStart, point, hitRadiusFor(e), drag.fromAtom);
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
      setHoverAtom(
        drag.soloAtom ? atomAt(molecule, point, hitRadiusFor(e), drag.soloAtom) : null,
      );
    }
  }

  function handlePointerUp(e: ReactPointerEvent) {
    pointersRef.current.delete(e.pointerId);
    releasePointer(svgRef.current, e.pointerId);

    // Iki parmaktan biri kalkti: jest biter, kalan parmak cizime baslamaz
    // (yoksa yakinlastirmadan cikarken tuvale cizgi atilirdi).
    if (pinchRef.current) {
      // Uc parmaktan biri kalktiysa kalan ikisiyle yeniden baslat; iki
      // parmaktan biri kalktiysa jest biter.
      pinchRef.current =
        pointersRef.current.size >= 2
          ? { points: twoPointers(pointersRef.current), viewport }
          : null;
      return;
    }

    const drag = dragRef.current;
    dragRef.current = null;
    setPreview(null);
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

    if (drag.kind === 'chain') {
      setChainPreview(null);
      if (drag.moved) {
        const origin = getAtom(drag.molAtStart, drag.fromAtom)!;
        commit(buildChain(drag.molAtStart, drag.fromAtom, chainPoints(origin, point, !e.shiftKey)).molecule);
      } else {
        // Suruklemeden tiklamak tek bag ekler — bag aracinin davranisi.
        commit(finishBond(drag.molAtStart, drag.fromAtom, point, false, 1, false, hitRadiusFor(e)));
      }
      return;
    }

    if (drag.kind === 'bond') {
      commit(
        finishBond(
          drag.molAtStart,
          drag.fromAtom,
          point,
          drag.moved,
          state.bondOrder,
          e.shiftKey,
          hitRadiusFor(e),
        ),
      );
      setHoverAtom(null);
      return;
    }

    if (drag.kind === 'move') {
      if (!drag.moved) {
        dispatch({ type: 'preview', molecule: drag.molAtStart });
        return;
      }

      commit(
        finishMove(
          drag.molAtStart,
          drag.atomIds,
          drag.soloAtom,
          drag.start,
          point,
          hitRadiusFor(e),
        ),
      );
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
      chainPreview={chainPreview}
      selectionRect={selectionRect}
      hoverAtomId={hoverAtom}
      stereo={stereo}
      errorAtomIds={errorAtomIds}
      groupHighlight={groupHighlight}
      highlight={{ atomIds: new Set(state.selectedAtoms) }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      // Isaretci iptal edilirse (sistem jesti, cagri vb.) yarim kalan
      // jesti temizlemezsek surukleme takili kalir.
      onPointerCancel={handlePointerUp}
      onPointerLeave={() => setHoverAtom(null)}
      onContextMenu={(e) => e.preventDefault()}
      style={{ display: 'block', background: '#fff', touchAction: 'none', cursor: cursorFor(tool) }}
    />
  );
}

/** Haritadaki ilk iki isaretciyi sirali bir cift olarak verir. */
function twoPointers(pointers: Map<number, Point>): readonly [Point, Point] {
  const [first, second] = [...pointers.values()];
  return [first, second];
}

/**
 * Isaretci yakalama, isaretci artik etkin degilse NotFoundError atar.
 * Yakalama sadece bir kolaylik — jest onsuz da yurumeli, bu yuzden
 * hatayi yutuyoruz. Sarmalanmasaydi tek bir yaris durumu tuvali
 * o jest boyunca tamamen olu birakirdi.
 */
function capturePointer(element: SVGSVGElement | null, pointerId: number): void {
  try {
    element?.setPointerCapture(pointerId);
  } catch {
    /* yakalanamadi; jest yine de calisir */
  }
}

function releasePointer(element: SVGSVGElement | null, pointerId: number): void {
  try {
    element?.releasePointerCapture(pointerId);
  } catch {
    /* zaten birakilmis */
  }
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
