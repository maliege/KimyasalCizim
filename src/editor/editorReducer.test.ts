import { describe, expect, it } from 'vitest';
import { addAtom, emptyMolecule } from '../model/molecule';
import { canRedo, canUndo, editorReducer, initialEditorState } from './editorReducer';
import type { EditorAction, EditorState } from './editorReducer';

const run = (state: EditorState, ...actions: EditorAction[]): EditorState =>
  actions.reduce(editorReducer, state);

const withAtom = (state: EditorState, element: string): EditorState =>
  editorReducer(state, {
    type: 'commit',
    molecule: addAtom(state.molecule, { element, x: 0, y: 0 }).molecule,
  });

describe('editorReducer geçmişi', () => {
  it('commit ile geri alma mümkün olur', () => {
    const state = withAtom(initialEditorState, 'C');
    expect(canUndo(state)).toBe(true);
    expect(state.molecule.atoms).toHaveLength(1);

    const undone = editorReducer(state, { type: 'undo' });
    expect(undone.molecule.atoms).toHaveLength(0);
    expect(canRedo(undone)).toBe(true);

    const redone = editorReducer(undone, { type: 'redo' });
    expect(redone.molecule.atoms).toHaveLength(1);
  });

  it('preview geçmişe yazmaz', () => {
    const moved = editorReducer(initialEditorState, {
      type: 'preview',
      molecule: addAtom(emptyMolecule(), { element: 'C', x: 5, y: 5 }).molecule,
    });
    expect(moved.molecule.atoms).toHaveLength(1);
    expect(canUndo(moved)).toBe(false);
  });

  it('yeni commit ileri geçmişi siler', () => {
    const state = run(withAtom(initialEditorState, 'C'), { type: 'undo' });
    expect(canRedo(state)).toBe(true);

    const branched = withAtom(state, 'N');
    expect(canRedo(branched)).toBe(false);
    expect(branched.molecule.atoms[0].element).toBe('N');
  });

  it('boş geçmişte undo/redo durumu değiştirmez', () => {
    expect(editorReducer(initialEditorState, { type: 'undo' })).toBe(initialEditorState);
    expect(editorReducer(initialEditorState, { type: 'redo' })).toBe(initialEditorState);
  });

  it('aynı molekülü commit etmek geçmişi kirletmez', () => {
    const state = editorReducer(initialEditorState, {
      type: 'commit',
      molecule: initialEditorState.molecule,
    });
    expect(canUndo(state)).toBe(false);
  });

  it('temizleme geri alınabilir', () => {
    const state = editorReducer(withAtom(initialEditorState, 'C'), { type: 'clear' });
    expect(state.molecule.atoms).toHaveLength(0);
    expect(editorReducer(state, { type: 'undo' }).molecule.atoms).toHaveLength(1);
  });
});

describe('editorReducer seçim', () => {
  it('silinen atomu seçimden düşürür', () => {
    let state = withAtom(initialEditorState, 'C');
    const atomId = state.molecule.atoms[0].id;
    state = editorReducer(state, { type: 'setSelection', atomIds: [atomId] });
    expect(state.selectedAtoms).toEqual([atomId]);

    state = editorReducer(state, { type: 'commit', molecule: emptyMolecule() });
    expect(state.selectedAtoms).toEqual([]);
  });
});

describe('editorReducer araç seçimi', () => {
  it('element seçmek atom aracına geçirir', () => {
    const state = editorReducer(initialEditorState, { type: 'setElement', element: 'O' });
    expect(state.element).toBe('O');
    expect(state.tool).toBe('atom');
  });

  it('bağ derecesi seçmek bağ aracına geçirir', () => {
    const state = editorReducer(
      { ...initialEditorState, tool: 'erase' },
      { type: 'setBondOrder', order: 2 },
    );
    expect(state.bondOrder).toBe(2);
    expect(state.tool).toBe('bond');
  });
});
