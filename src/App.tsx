import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import Canvas from './editor/Canvas';
import { editorReducer, initialEditorState } from './editor/editorReducer';
import type { EditorState, ToolId } from './editor/editorReducer';
import { loadMolecule, saveMolecule } from './editor/persistence';
import { DEFAULT_VIEWPORT, fitTo, zoomAt } from './editor/viewport';
import type { Viewport } from './editor/viewport';
import Toolbar from './panels/Toolbar';
import InfoPanel from './panels/InfoPanel';
import { useMoleculeInfo } from './rdkit/useMoleculeInfo';
import type { Molecule } from './model/types';

/** Klavye kisayolu -> arac eslemesi */
const TOOL_KEYS: Record<string, ToolId> = {
  s: 'select',
  b: 'bond',
  a: 'atom',
  e: 'erase',
  t: 'template',
  g: 'group',
  w: 'wedge',
  h: 'hash',
};

/** Kaydetmeden once beklenen sure — her fare hareketinde diske yazmayalim. */
const SAVE_DEBOUNCE_MS = 400;

/** Onceki oturumdan kalan cizimle basla. */
function restoreState(base: EditorState): EditorState {
  const saved = loadMolecule();
  return saved ? { ...base, molecule: saved } : base;
}

export default function App() {
  const [state, dispatch] = useReducer(editorReducer, initialEditorState, restoreState);
  const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT);
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasBoxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });

  // Tek bir RDKit hesabi hem paneli hem tuvaldeki stereo etiketlerini besler.
  const { info, stereo, pending, status } = useMoleculeInfo(state.molecule);

  // Tuval, kalan alani doldursun.
  useLayoutEffect(() => {
    const box = canvasBoxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.max(1, width), height: Math.max(1, height) });
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  // Cizim degistikce sakla — sekme kapansa da kaybolmasin.
  useEffect(() => {
    const timer = setTimeout(() => saveMolecule(state.molecule), SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [state.molecule]);

  const handleZoom = useCallback(
    (factor: number) => {
      setViewport((vp) => zoomAt(vp, size.width / 2, size.height / 2, factor));
    },
    [size],
  );

  const handleFit = useCallback(() => {
    setViewport(fitTo(state.molecule, size.width, size.height));
  }, [state.molecule, size]);

  // Geri yuklenen cizim ilk olcumden sonra tuvale oturtulur.
  const fittedOnce = useRef(false);
  useEffect(() => {
    if (fittedOnce.current || state.molecule.atoms.length === 0 || size.width <= 1) return;
    fittedOnce.current = true;
    setViewport(fitTo(state.molecule, size.width, size.height));
  }, [state.molecule, size]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Metin alanlarindaki yazimi bozmayalim.
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      const modifier = e.ctrlKey || e.metaKey;

      if (modifier) {
        switch (e.key.toLowerCase()) {
          case 'z':
            e.preventDefault();
            dispatch({ type: e.shiftKey ? 'redo' : 'undo' });
            return;
          case 'y':
            e.preventDefault();
            dispatch({ type: 'redo' });
            return;
          case 'a':
            e.preventDefault();
            dispatch({ type: 'selectAll' });
            return;
          case 'c':
            // Kullanici gercek bir metin sectiyse tarayiciya birak.
            if (window.getSelection()?.toString()) return;
            dispatch({ type: 'copySelection' });
            return;
          case 'v':
            dispatch({ type: 'paste' });
            return;
          default:
            return;
        }
      }
      if (e.altKey) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        dispatch({ type: 'deleteSelection' });
        return;
      }
      if (e.key === 'Escape') {
        dispatch({ type: 'setSelection', atomIds: [] });
        return;
      }

      const tool = TOOL_KEYS[e.key.toLowerCase()];
      if (tool) {
        dispatch({ type: 'setTool', tool });
        return;
      }
      // Buyuk harfle yazilan element simgeleri dogrudan secilsin (C, N, O…)
      if (/^[A-Z]$/.test(e.key)) {
        dispatch({ type: 'setElement', element: e.key });
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleImport = useCallback(
    (molecule: Molecule) => {
      dispatch({ type: 'commit', molecule });
      setViewport(fitTo(molecule, size.width, size.height));
    },
    [size],
  );

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <strong style={{ fontSize: 14 }}>KimyasalÇizim</strong>
        <span style={styles.hint}>
          Bağ çizmek için sürükleyin · Shift serbest açı · Tekerlek yakınlaştırır · Ctrl+sürükleme
          kaydırır
        </span>
      </header>

      <div style={styles.body}>
        <Toolbar state={state} dispatch={dispatch} onZoom={handleZoom} onFit={handleFit} />

        <main ref={canvasBoxRef} style={styles.canvasBox}>
          <Canvas
            state={state}
            dispatch={dispatch}
            width={size.width}
            height={size.height}
            viewport={viewport}
            onViewportChange={setViewport}
            stereo={stereo}
            svgRef={svgRef}
          />
        </main>

        <InfoPanel
          molecule={state.molecule}
          info={info}
          pending={pending}
          status={status}
          onImport={handleImport}
          svgRef={svgRef}
        />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: { display: 'flex', flexDirection: 'column', height: '100vh' },
  header: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 12,
    padding: '8px 12px',
    background: 'var(--panel)',
    borderBottom: '1px solid var(--border)',
  },
  hint: { fontSize: 11, color: 'var(--muted)' },
  body: { display: 'flex', flex: 1, minHeight: 0 },
  canvasBox: { flex: 1, minWidth: 0, overflow: 'hidden', background: '#fff' },
};
