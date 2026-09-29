import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import Canvas from './editor/Canvas';
import { editorReducer, initialEditorState } from './editor/editorReducer';
import type { EditorState } from './editor/editorReducer';
import { loadMolecule, saveMolecule } from './editor/persistence';
import { DEFAULT_VIEWPORT, fitTo, zoomAt } from './editor/viewport';
import type { Viewport } from './editor/viewport';
import Toolbar from './panels/Toolbar';
import ExercisePanel from './panels/ExercisePanel';
import {
  EXERCISES,
  evaluate,
  findExercise,
  formulaFromInchi,
  nextExercise,
} from './model/exercises';
import type { Verdict } from './model/exercises';
import { toMolfile } from './model/molfile';
import InfoPanel from './panels/InfoPanel';
import { useMoleculeInfo } from './rdkit/useMoleculeInfo';
import { COMBINE_WINDOW_MS, resolveKey } from './editor/keymap';
import { isElement } from './model/elements';
import { findFunctionalGroup } from './model/functionalGroups';
import { buildTaskUrl, parseShareHash } from './editor/shareLink';
import { fromMolfile } from './model/molfile';
import { identify, molblockFromSmiles } from './rdkit/RdkitService';
import { useRdkit } from './rdkit/useRdkit';
import { molecularFormula, valenceErrors } from './model/valence';
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
  /** Iki harfli element girisi icin son basilan tus. Ref: degisince render gerekmez. */
  const lastKey = useRef<{ key: string; time: number } | null>(null);
  const canvasBoxRef = useRef<HTMLDivElement>(null);
  // Sifirla basliyoruz ki "henuz olculmedi" durumu ayirt edilebilsin;
  // 800x600 gibi bir taban deger, sigdirma adimini yanlis olcuyle calistirir.
  const [size, setSize] = useState({ width: 0, height: 0 });

  // Tek bir RDKit hesabi hem paneli hem tuvaldeki stereo etiketlerini besler.
  const { info, stereo, groups, pending, status } = useMoleculeInfo(state.molecule);

  // Panelde tiklanan fonksiyonel grup tuvalde renklendirilir. Molekul
  // degisip grup artik yoksa vurgu kendiliginden kaybolur.
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const groupHighlight = useMemo(() => {
    const hit = activeGroup ? groups.find((g) => g.id === activeGroup) : undefined;
    const def = activeGroup ? findFunctionalGroup(activeGroup) : undefined;
    if (!hit || !def) return null;
    return { color: def.color, atomIds: new Set(hit.matches.flat()) };
  }, [activeGroup, groups]);

  // Dar ekranda uc sutun sigmaz: tuval tam genislik alir, bilgi paneli
  // istege bagli acilir.
  const compact = useMediaQuery(COMPACT_QUERY);
  const [infoOpen, setInfoOpen] = useState(false);
  const formula = molecularFormula(state.molecule);

  // Degerlik denetimi yerel ve ucuz: RDKit'i beklemeden her degisiklikte.
  // useMemo: molekul degismedikce yeniden hesaplanmaz.
  const errorAtoms = useMemo(() => valenceErrors(state.molecule), [state.molecule]);
  const errorAtomSet = useMemo(() => new Set(errorAtoms), [errorAtoms]);

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

      // Iki harfli simgeler icin son tusu kisa bir sure hatirliyoruz.
      const now = performance.now();
      const last = lastKey.current;
      const previous = last && now - last.time < COMBINE_WINDOW_MS ? last.key : undefined;
      lastKey.current = { key: e.key, time: now };

      const action = resolveKey(e.key, previous);
      if (action.kind === 'tool') dispatch({ type: 'setTool', tool: action.tool });
      else if (action.kind === 'element') {
        // Ilk harf tek basina bir element sectiyse (C → Cl) onu son kullanilanlardan
        // cikar; secmediyse (Z → Zn) cikaracak bir sey yok, alakasiz bir kayit silinmesin.
        const replacePrevious = action.combined && previous !== undefined && isElement(previous);
        dispatch({ type: 'setElement', element: action.element, replacePrevious });
        // Birlesen cift tuketildi; ucuncu bir harf onunla tekrar birlesmesin.
        if (action.combined) lastKey.current = null;
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

  // Paylasim baglantisi: adres #smiles=... tasiyorsa o yapiyi ac.
  //
  // Yapi normal bir duzenleme adimi olarak yuklenir; kullanicinin kendi
  // cizimi kaybolmaz, Ctrl+Z ile geri gelir. Adres parcasini hemen
  // temizliyoruz: yoksa sayfa her yenilendiginde kullanicinin son hali
  // yerine yine bagladaki yapi acilirdi.
  const { status: rdkitStatus, rdkit } = useRdkit();
  const [notice, setNotice] = useState<string | null>(null);

  // --- Alistirma modu ---
  const [exercise, setExercise] = useState<{
    id: string;
    verdict: Verdict | null;
    hint: boolean;
  } | null>(null);
  // Oturum boyunca cozulen gorevler; sayfa yenilenince sifirlanir.
  const [solved, setSolved] = useState<Set<string>>(() => new Set());
  const [taskShare, setTaskShare] = useState<'kopyalandi' | null>(null);

  /** Gorevi baslatir: tuval temizlenir (geri alinabilir), gorunum sifirlanir. */
  const startExercise = useCallback((id: string) => {
    if (!findExercise(id)) return;
    setExercise({ id, verdict: null, hint: false });
    dispatch({ type: 'clear' });
    setViewport(DEFAULT_VIEWPORT);
  }, []);

  // Cizim degisince eski sonuc gecersizlesir; ogrenci yeniden kontrol eder.
  useEffect(() => {
    setExercise((ex) => (ex?.verdict ? { ...ex, verdict: null } : ex));
  }, [state.molecule]);

  const activeExercise = exercise ? findExercise(exercise.id) : undefined;

  // Hedefin kimligi gorev basina bir kez hesaplanir.
  const target = useMemo(
    () =>
      activeExercise && rdkitStatus === 'ready' ? identify(rdkit, activeExercise.smiles) : null,
    [activeExercise, rdkitStatus, rdkit],
  );

  const handleCheck = () => {
    if (!exercise || !target || rdkitStatus !== 'ready') return;
    const empty = state.molecule.atoms.length === 0;
    const drawn = empty ? null : identify(rdkit, toMolfile(state.molecule));
    const verdict = evaluate(drawn, target, empty);
    setExercise({ ...exercise, verdict });
    if (verdict.kind === 'dogru') setSolved((prev) => new Set(prev).add(exercise.id));
  };

  const handleTaskShare = async () => {
    if (!exercise) return;
    try {
      await navigator.clipboard.writeText(buildTaskUrl(window.location.href, exercise.id));
      setTaskShare('kopyalandi');
      setTimeout(() => setTaskShare(null), 2000);
    } catch {
      setNotice('Bağlantı kopyalanamadı.');
    }
  };

  /** Ilk cozulmemis gorevden basla; hepsi cozulduyse bastan. */
  const openExercises = () =>
    startExercise((EXERCISES.find((e) => !solved.has(e.id)) ?? EXERCISES[0]).id);
  useEffect(() => {
    if (rdkitStatus !== 'ready' || size.width <= 1) return;

    const loadFromHash = () => {
      const { smiles, task } = parseShareHash(window.location.hash);
      if (!smiles && !task) return;
      history.replaceState(null, '', window.location.pathname + window.location.search);

      if (task) {
        if (findExercise(task)) {
          startExercise(task);
          setNotice(null);
        } else {
          setNotice(`Bağlantıdaki görev bulunamadı: ${task}`);
        }
        return;
      }
      if (!smiles) return;

      const molblock = molblockFromSmiles(rdkit, smiles);
      if (!molblock) {
        setNotice(`Bağlantıdaki yapı okunamadı: ${smiles}`);
        return;
      }
      handleImport(fromMolfile(molblock));
      setNotice(null);
    };

    loadFromHash();
    // Uygulama acikken yeni bir baglanti yapistirilirsa sayfa yenilenmez;
    // yalnizca adres parcasi degisir.
    window.addEventListener('hashchange', loadFromHash);
    return () => window.removeEventListener('hashchange', loadFromHash);
  }, [rdkitStatus, rdkit, handleImport, size.width, startExercise]);

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
        <button
          type="button"
          style={{ ...styles.infoToggle, marginLeft: 'auto', ...(exercise ? styles.exerciseOn : {}) }}
          aria-pressed={!!exercise}
          onClick={() => (exercise ? setExercise(null) : openExercises())}
          title="Şunu çizin görevleriyle pratik yapın"
        >
          🎓 {compact ? '' : 'Alıştırma'}
        </button>
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

        {/* Gorev seridi tuvalin UZERINE binmesin diye ayni sutunda, ustunde.
            Olcum main'e bagli oldugu icin tuval kalan alani dogru alir. */}
        <div style={compact ? { ...styles.centerColumn, order: -1 } : styles.centerColumn}>
        {exercise && activeExercise && (
          <ExercisePanel
            exercise={activeExercise}
            verdict={exercise.verdict}
            hintVisible={exercise.hint}
            targetFormula={target ? formulaFromInchi(target.inchi) : null}
            solved={solved}
            compact={compact}
            onPick={startExercise}
            onCheck={handleCheck}
            onHint={() => setExercise({ ...exercise, hint: true })}
            onNext={() => startExercise(nextExercise(exercise.id).id)}
            onShare={() => void handleTaskShare()}
            onExit={() => setExercise(null)}
            shareState={taskShare}
          />
        )}
        <main ref={canvasBoxRef} style={styles.canvasBox}>
          {notice && (
            <button type="button" style={styles.notice} onClick={() => setNotice(null)}>
              {notice} <span style={{ opacity: 0.6 }}>✕</span>
            </button>
          )}
          <Canvas
            state={state}
            dispatch={dispatch}
            width={size.width}
            height={size.height}
            viewport={viewport}
            onViewportChange={setViewport}
            stereo={stereo}
            errorAtomIds={errorAtomSet}
            groupHighlight={groupHighlight}
            svgRef={svgRef}
          />
        </main>
        </div>

        {(!compact || infoOpen) && (
          <InfoPanel
            molecule={state.molecule}
            info={info}
            pending={pending}
            status={status}
            onImport={handleImport}
            svgRef={svgRef}
            compact={compact}
            errorAtomIds={errorAtoms}
            groups={groups}
            activeGroup={groupHighlight ? activeGroup : null}
            onToggleGroup={(id) => setActiveGroup((cur) => (cur === id ? null : id))}
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
  centerColumn: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, minHeight: 0 },
  exerciseOn: {
    background: 'var(--accent)',
    border: '1px solid var(--accent)',
    color: '#fff',
  },
  bodyCompact: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 },
  canvasBox: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    background: '#fff',
    position: 'relative',
  },
  notice: {
    position: 'absolute',
    top: 10,
    left: '50%',
    transform: 'translateX(-50%)',
    maxWidth: 'calc(100% - 24px)',
    padding: '8px 12px',
    fontSize: 12,
    color: 'var(--danger)',
    background: '#fff',
    border: '1px solid var(--danger)',
    borderRadius: 6,
    cursor: 'pointer',
    zIndex: 5,
    boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
  },
};
