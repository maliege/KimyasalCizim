import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import Canvas from './editor/Canvas';
import { editorReducer, initialEditorState } from './editor/editorReducer';
import type { EditorState } from './editor/editorReducer';
import { loadMolecule, saveMolecule } from './editor/persistence';
import { DEFAULT_VIEWPORT, fitTo, zoomAt } from './editor/viewport';
import type { Viewport } from './editor/viewport';
import Toolbar from './panels/Toolbar';
import InfoPanel from './panels/InfoPanel';
import { useMoleculeInfo } from './rdkit/useMoleculeInfo';
import { resolveKey } from './editor/keymap';
import { molecularFormula } from './model/valence';
import { COMPACT_QUERY, useMediaQuery } from './ui/useMediaQuery';
import type { Molecule } from './model/types';

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
  // Sifirla basliyoruz ki "henuz olculmedi" durumu ayirt edilebilsin;
  // 800x600 gibi bir taban deger, sigdirma adimini yanlis olcuyle calistirir.
  const [size, setSize] = useState({ width: 0, height: 0 });

  // Tek bir RDKit hesabi hem paneli hem tuvaldeki stereo etiketlerini besler.
  const { info, stereo, pending, status } = useMoleculeInfo(state.molecule);

  // Dar ekranda uc sutun sigmaz: tuval tam genislik alir, bilgi paneli
  // istege bagli acilir.
  const compact = useMediaQuery(COMPACT_QUERY);
  const [infoOpen, setInfoOpen] = useState(false);
  const formula = molecularFormula(state.molecule);

  // Tuval, kalan alani doldursun.
  useLayoutEffect(() => {
    const box = canvasBoxRef.current;
    if (!box) return;

    // Ilk olcumu hemen aliyoruz: ResizeObserver'in ilk geri cagrisi bir
    // sonraki kareye kaliyor ve o ana kadar tuval olcusuz oluyor. Bu gecikme
    // "kayitli cizimi sigdir" adimini sahte olcuyle calistirip molekulu
    // ekran disinda birakiyordu.
    const rect = box.getBoundingClientRect();
    setSize({ width: Math.max(1, rect.width), height: Math.max(1, rect.height) });

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

  // Geri yuklenen cizim, tuval olculur olculmez ekrana oturtulur.
  //
  // Bu yalniz *acilista* kayit varsa calismali. useRef'in baslangic degeri
  // sadece ilk render'da kullanilir, yani bu bayrak "mount aninda molekul
  // var miydi" sorusunu dondurur. Bayragi "henuz sigdirmadik" diye kurmak
  // hataliydi: bos tuvalde kosul saglanmiyor, sonra ilk atomu koyunca efekt
  // atesleniyor ve gorunum elin altinda kayiyordu.
  const needsInitialFit = useRef(state.molecule.atoms.length > 0);
  useEffect(() => {
    if (!needsInitialFit.current || size.width <= 1) return;
    needsInitialFit.current = false;
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

      const action = resolveKey(e.key);
      if (action.kind === 'tool') dispatch({ type: 'setTool', tool: action.tool });
      else if (action.kind === 'element') dispatch({ type: 'setElement', element: action.element });
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
        {compact ? (
          <>
            <span style={styles.formula}>{formula || 'boş'}</span>
            <button
              type="button"
              style={styles.infoToggle}
              onClick={() => setInfoOpen((open) => !open)}
              aria-expanded={infoOpen}
            >
              {infoOpen ? 'Kapat' : 'Bilgi'}
            </button>
          </>
        ) : (
          <span style={styles.hint}>
            Bağ çizmek için sürükleyin · Shift serbest açı · Tekerlek yakınlaştırır ·
            Ctrl+sürükleme kaydırır
          </span>
        )}
      </header>

      <div style={compact ? styles.bodyCompact : styles.body}>
        {/* DOM sirasi genis ekranin sirasi: arac sutunu solda, tuval ortada,
            bilgi sagda. Dar ekranda tuvale `order: -1` verilerek one alinir,
            boylece arac seridi basparmak menziline, altina duser. */}
        <Toolbar
          state={state}
          dispatch={dispatch}
          onZoom={handleZoom}
          onFit={handleFit}
          compact={compact}
        />

        <main
          ref={canvasBoxRef}
          style={compact ? { ...styles.canvasBox, order: -1 } : styles.canvasBox}
        >
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

        {(!compact || infoOpen) && (
          <InfoPanel
            molecule={state.molecule}
            info={info}
            pending={pending}
            status={status}
            onImport={handleImport}
            svgRef={svgRef}
            compact={compact}
            onClose={compact ? () => setInfoOpen(false) : undefined}
          />
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  // 100dvh: mobil tarayicilarda adres cubugu acilip kapandikca 100vh
  // degisir ve sayfa zipllar; dvh gercek gorunur yuksekligi verir.
  app: { display: 'flex', flexDirection: 'column', height: '100dvh' },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 12px',
    background: 'var(--panel)',
    borderBottom: '1px solid var(--border)',
  },
  hint: { fontSize: 11, color: 'var(--muted)' },
  formula: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'ui-monospace, Consolas, monospace',
    color: 'var(--muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  infoToggle: {
    fontSize: 12,
    padding: '6px 12px',
    minHeight: 34,
    background: '#fff',
    border: '1px solid var(--border)',
    borderRadius: 6,
    cursor: 'pointer',
    color: 'var(--text)',
    flexShrink: 0,
  },
  body: { display: 'flex', flex: 1, minHeight: 0 },
  bodyCompact: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 },
  canvasBox: { flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden', background: '#fff' },
};
