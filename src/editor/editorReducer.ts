import { deleteAtoms, emptyMolecule, extractFragment, insertFragment } from '../model/molecule';
import type { BondOrder, Molecule } from '../model/types';

export type ToolId =
  | 'select'
  | 'bond'
  | 'atom'
  | 'erase'
  | 'chargePlus'
  | 'chargeMinus'
  | 'wedge'
  | 'hash'
  | 'template'
  | 'group';

export type EditorState = {
  molecule: Molecule;
  past: Molecule[];
  future: Molecule[];
  tool: ToolId;
  /** Atom aracinin yerlestirecegi element */
  element: string;
  /** Bag aracinin cizecegi derece */
  bondOrder: BondOrder;
  /** Secili halka sablonu */
  templateId: string;
  /** Secili fonksiyonel grup */
  groupId: string;
  selectedAtoms: string[];
  /** Kopyalanan parca — yapistirmaya hazir */
  clipboard: Molecule | null;
};

export const initialEditorState: EditorState = {
  molecule: emptyMolecule(),
  past: [],
  future: [],
  tool: 'bond',
  element: 'C',
  bondOrder: 1,
  templateId: 'benzene',
  groupId: 'carboxyl',
  selectedAtoms: [],
  clipboard: null,
};

export type EditorAction =
  /** Kalici degisiklik — geri alma yiginina yazilir */
  | { type: 'commit'; molecule: Molecule }
  /** Gecici degisiklik (surukleme sirasinda) — gecmise yazilmaz */
  | { type: 'preview'; molecule: Molecule }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'clear' }
  | { type: 'setTool'; tool: ToolId }
  | { type: 'setElement'; element: string }
  | { type: 'setBondOrder'; order: BondOrder }
  | { type: 'setTemplate'; templateId: string }
  | { type: 'setGroup'; groupId: string }
  | { type: 'setSelection'; atomIds: string[] }
  | { type: 'selectAll' }
  | { type: 'deleteSelection' }
  | { type: 'copySelection' }
  | { type: 'paste'; offset?: { x: number; y: number } };

/** Geri alma yigininda tutulacak en fazla adim. */
const HISTORY_LIMIT = 100;

/** Yapistirilan parcanin orijinalden kaymasi — ustuste binmesin diye. */
const PASTE_OFFSET = { x: 24, y: 24 };

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'commit':
      return commit(state, action.molecule);

    case 'preview':
      return { ...state, molecule: action.molecule };

    case 'undo': {
      const previous = state.past.at(-1);
      if (previous === undefined) return state;
      return {
        ...state,
        molecule: previous,
        past: state.past.slice(0, -1),
        future: [state.molecule, ...state.future],
        selectedAtoms: pruneSelection(state.selectedAtoms, previous),
      };
    }

    case 'redo': {
      const [next, ...rest] = state.future;
      if (next === undefined) return state;
      return {
        ...state,
        molecule: next,
        past: [...state.past, state.molecule].slice(-HISTORY_LIMIT),
        future: rest,
        selectedAtoms: pruneSelection(state.selectedAtoms, next),
      };
    }

    case 'clear':
      return state.molecule.atoms.length === 0 ? state : commit(state, emptyMolecule());

    case 'deleteSelection':
      if (state.selectedAtoms.length === 0) return state;
      return commit(state, deleteAtoms(state.molecule, state.selectedAtoms));

    case 'copySelection': {
      if (state.selectedAtoms.length === 0) return state;
      return { ...state, clipboard: extractFragment(state.molecule, state.selectedAtoms) };
    }

    case 'paste': {
      if (!state.clipboard || state.clipboard.atoms.length === 0) return state;
      const { molecule, atomIds } = insertFragment(
        state.molecule,
        state.clipboard,
        action.offset ?? PASTE_OFFSET,
      );
      // Yapistirilan parca secili gelsin ki hemen tasinabilsin.
      return { ...commit(state, molecule), selectedAtoms: atomIds };
    }

    case 'selectAll':
      return { ...state, selectedAtoms: state.molecule.atoms.map((a) => a.id) };

    case 'setTool':
      return { ...state, tool: action.tool };
    case 'setElement':
      // Element secmek dogal olarak atom aracina gecmek demek.
      return { ...state, element: action.element, tool: 'atom' };
    case 'setBondOrder':
      return { ...state, bondOrder: action.order, tool: 'bond' };
    case 'setTemplate':
      return { ...state, templateId: action.templateId, tool: 'template' };
    case 'setGroup':
      return { ...state, groupId: action.groupId, tool: 'group' };
    case 'setSelection':
      return { ...state, selectedAtoms: action.atomIds };
  }
}

/** Molekulu gecmise yazarak degistirir. */
function commit(state: EditorState, molecule: Molecule): EditorState {
  if (molecule === state.molecule) return state;
  return {
    ...state,
    molecule,
    past: [...state.past, state.molecule].slice(-HISTORY_LIMIT),
    future: [], // yeni dal acildi
    selectedAtoms: pruneSelection(state.selectedAtoms, molecule),
  };
}

/** Silinen atomlar secimde kalmasin. */
function pruneSelection(selected: string[], mol: Molecule): string[] {
  if (selected.length === 0) return selected;
  const alive = new Set(mol.atoms.map((a) => a.id));
  const next = selected.filter((id) => alive.has(id));
  return next.length === selected.length ? selected : next;
}

export const canUndo = (state: EditorState): boolean => state.past.length > 0;
export const canRedo = (state: EditorState): boolean => state.future.length > 0;
