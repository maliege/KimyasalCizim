import { createContext, useContext, useState } from 'react';
import { TEMPLATES } from '../model/templates';
import { GROUPS } from '../model/groups';
import { elementName } from '../model/elements';
import { canRedo, canUndo } from '../editor/editorReducer';
import type { EditorAction, EditorState, ToolId } from '../editor/editorReducer';
import type { BondOrder } from '../model/types';
import { elementColor } from '../render/style';
import ElementPicker from './ElementPicker';
import type { TransformOp } from '../model/transform';
import { THEME_LABELS } from '../render/theme';
import type { ThemeChoice } from '../render/theme';

type Props = {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
  onZoom: (factor: number) => void;
  onFit: () => void;
  /** Dar ekran: dikey panel yerine yatay kaydirilabilir serit */
  compact?: boolean;
  theme: ThemeChoice;
  onCycleTheme: () => void;
  aromaticCircles: boolean;
  onToggleAromatic: () => void;
};

const TOOLS: { id: ToolId; label: string; hint: string }[] = [
  { id: 'select', label: '⭠⭢', hint: 'Seç ve taşı (S) — boş alanda sürükleyerek kutu seçimi' },
  { id: 'chain', label: '╱╲╱', hint: 'Zincir (c): sürükledikçe uzayan zikzak karbon zinciri' },
  { id: 'erase', label: '⌫', hint: 'Sil (E)' },
  { id: 'chargePlus', label: '＋', hint: 'Yükü artır' },
  { id: 'chargeMinus', label: '－', hint: 'Yükü azalt' },
  { id: 'isotope', label: '¹³C', hint: 'İzotop: atoma tıkladıkça değişir (¹²C → ¹³C → ¹⁴C → ¹²C)' },
  { id: 'wedge', label: '◤', hint: 'Kama bağ, öne doğru (W)' },
  { id: 'hash', label: '⦀', hint: 'Kesikli bağ, arkaya (H)' },
];

const BOND_ORDERS: { order: BondOrder; label: string; hint: string }[] = [
  { order: 1, label: '—', hint: 'Tekli bağ' },
  { order: 2, label: '═', hint: 'İkili bağ' },
  { order: 3, label: '≡', hint: 'Üçlü bağ' },
];

const ELEMENTS = ['C', 'N', 'O', 'S', 'P', 'F', 'Cl', 'Br', 'I', 'H'];

/** 30° adimlar cizimi aci izgarasinda tutar (bag araci da 30°'ye yakalar). */
const TRANSFORMS: { label: string; hint: string; op: TransformOp }[] = [
  { label: '⟲', hint: '30° sola döndür', op: { kind: 'rotate', degrees: -30 } },
  { label: '⟳', hint: '30° sağa döndür', op: { kind: 'rotate', degrees: 30 } },
  { label: '⇆', hint: 'Yatay aynala', op: { kind: 'flip', axis: 'horizontal' } },
  { label: '⇅', hint: 'Dikey aynala', op: { kind: 'flip', axis: 'vertical' } },
];

/**
 * Dokunma hedefi buyutulsun mu?
 *
 * Context kullaniyoruz cunku bu bayrak 13 ayri Button'a ulasmali ve hepsi
 * kardes; her birine prop gecirmek gurultu olurdu. C#'taki "ambient
 * context" fikrinin React karsiligi.
 */
const TouchTargets = createContext(false);

export default function Toolbar({
  state,
  dispatch,
  onZoom,
  onFit,
  compact = false,
  theme,
  onCycleTheme,
  aromaticCircles,
  onToggleAromatic,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);

  // Hizli palette zaten bulunanlari son kullanilanlarda tekrarlamaya gerek yok.
  const recent = state.recentElements.filter((e) => !ELEMENTS.includes(e));

  const Section = compact ? CompactSection : WideSection;

  return (
    <TouchTargets.Provider value={compact}>
    <aside style={compact ? styles.panelCompact : styles.panel}>
      <Section title="Bağ">
        <div style={styles.grid}>
          {BOND_ORDERS.map(({ order, label, hint }) => (
            <Button
              key={order}
              title={hint}
              active={state.tool === 'bond' && state.bondOrder === order}
              onClick={() => dispatch({ type: 'setBondOrder', order })}
            >
              {label}
            </Button>
          ))}
        </div>
      </Section>

      <Section title="Element">
        <div style={styles.grid}>
          {ELEMENTS.map((element) => (
            <Button
              key={element}
              title={`${elementName(element)} yerleştir`}
              active={state.tool === 'atom' && state.element === element}
              onClick={() => dispatch({ type: 'setElement', element })}
            >
              <span style={{ color: elementColor(element), fontWeight: 600 }}>{element}</span>
            </Button>
          ))}

          {recent.map((element) => (
            <Button
              key={element}
              title={`${elementName(element)} yerleştir (son kullanılan)`}
              active={state.tool === 'atom' && state.element === element}
              onClick={() => dispatch({ type: 'setElement', element })}
            >
              <span style={{ color: elementColor(element), fontWeight: 600 }}>{element}</span>
            </Button>
          ))}

          <Button
            title="Periyodik tablodan seç"
            active={pickerOpen}
            onClick={() => setPickerOpen(true)}
            grow
          >
            <span style={{ fontSize: 11 }}>Tümü…</span>
          </Button>
        </div>
      </Section>

      {pickerOpen && (
        <ElementPicker
          selected={state.element}
          onPick={(element) => {
            dispatch({ type: 'setElement', element });
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}

      <Section title="Araçlar">
        <div style={styles.grid}>
          {TOOLS.map(({ id, label, hint }) => (
            <Button
              key={id}
              title={hint}
              active={state.tool === id}
              onClick={() => dispatch({ type: 'setTool', tool: id })}
            >
              {label}
            </Button>
          ))}
        </div>
      </Section>

      <Section title="Gruplar">
        <div style={styles.grid}>
          {GROUPS.map((group) => (
            <Button
              key={group.id}
              title={`${group.label} (${group.formula}) — bir atoma veya boş alana tıklayın`}
              active={state.tool === 'group' && state.groupId === group.id}
              onClick={() => dispatch({ type: 'setGroup', groupId: group.id })}
              grow
            >
              <span style={{ fontSize: 11 }}>{group.formula}</span>
            </Button>
          ))}
        </div>
      </Section>

      <Section title="Halkalar">
        <div style={compact ? styles.grid : styles.templateList}>
          {TEMPLATES.map((template) => (
            <Button
              key={template.id}
              title={`${template.label} — boş alana, bir atoma (spiro) veya bağa (kaynaşık) tıklayın`}
              active={state.tool === 'template' && state.templateId === template.id}
              onClick={() => dispatch({ type: 'setTemplate', templateId: template.id })}
              wide={!compact}
            >
              {template.label}
            </Button>
          ))}
        </div>
      </Section>

      <Section title="Dönüştür">
        <div style={styles.grid}>
          {TRANSFORMS.map(({ label, hint, op }) => (
            <Button
              key={hint}
              title={`${hint} — seçimi, seçim yoksa tüm yapıyı`}
              disabled={state.molecule.atoms.length === 0}
              onClick={() => dispatch({ type: 'transform', op })}
            >
              {label}
            </Button>
          ))}
        </div>
      </Section>

      <Section title="Görünüm">
        <div style={styles.grid}>
          <Button title="Yakınlaştır" onClick={() => onZoom(1.25)}>
            ＋
          </Button>
          <Button title="Uzaklaştır" onClick={() => onZoom(0.8)}>
            －
          </Button>
          <Button title="Tuvale sığdır" onClick={onFit} grow>
            <span style={{ fontSize: 11 }}>Sığdır</span>
          </Button>
          <Button
            title="Aromatik halkaları içte daireyle göster (Kekulé yerine)"
            active={aromaticCircles}
            onClick={onToggleAromatic}
            grow
          >
            <span style={{ fontSize: 11 }}>⌬ Daire</span>
          </Button>
          <Button title="Tema: Otomatik → Açık → Koyu" onClick={onCycleTheme} grow>
            <span style={{ fontSize: 11 }}>
              {theme === 'dark' ? '☾' : theme === 'light' ? '☀' : '◐'} {THEME_LABELS[theme]}
            </span>
          </Button>
        </div>
      </Section>

      <Section title="Geçmiş">
        <div style={styles.grid}>
          <Button
            title="Geri al (Ctrl+Z)"
            disabled={!canUndo(state)}
            onClick={() => dispatch({ type: 'undo' })}
          >
            ↶
          </Button>
          <Button
            title="İleri al (Ctrl+Y)"
            disabled={!canRedo(state)}
            onClick={() => dispatch({ type: 'redo' })}
          >
            ↷
          </Button>
          <Button title="Tuvali temizle" onClick={() => dispatch({ type: 'clear' })}>
            🗑
          </Button>
        </div>
      </Section>
    </aside>
    </TouchTargets.Provider>
  );
}

type SectionProps = { title: string; children: React.ReactNode };

/** Genis ekran: basliklı dikey blok. */
function WideSection({ title, children }: SectionProps) {
  return (
    <section style={{ marginBottom: 16 }}>
      <h2 style={styles.sectionTitle}>{title}</h2>
      {children}
    </section>
  );
}

/**
 * Dar ekran: baslik solda kucuk bir etiket, butonlar yaninda.
 * Bloklar yatay seritte yan yana dizilir ve serit kaydirilabilir.
 */
function CompactSection({ title, children }: SectionProps) {
  return (
    <section style={styles.compactSection}>
      <h2 style={styles.compactSectionTitle}>{title}</h2>
      {children}
    </section>
  );
}

function Button({
  children,
  onClick,
  active,
  title,
  disabled,
  wide,
  grow,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  title: string;
  disabled?: boolean;
  wide?: boolean;
  grow?: boolean;
}) {
  const touch = useContext(TouchTargets);
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...styles.button,
        ...(touch ? styles.buttonTouch : {}),
        ...(wide ? styles.buttonWide : {}),
        ...(grow ? styles.buttonGrow : {}),
        ...(active ? styles.buttonActive : {}),
        ...(disabled ? styles.buttonDisabled : {}),
      }}
    >
      {children}
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    width: 168,
    flexShrink: 0,
    padding: 12,
    background: 'var(--panel)',
    borderRight: '1px solid var(--border)',
    overflowY: 'auto',
  },
  /** Dar ekran: tuvalin altinda yatay kaydirilabilir serit. */
  panelCompact: {
    flexShrink: 0,
    display: 'flex',
    gap: 14,
    padding: '8px 10px',
    // Centikli telefonlarda ana ekran cubugu seridi ortmesin.
    paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
    background: 'var(--panel)',
    borderTop: '1px solid var(--border)',
    overflowX: 'auto',
    // Parmakla kaydirmaya izin ver; tuvalde touchAction 'none'.
    touchAction: 'pan-x',
  },
  compactSection: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  compactSectionTitle: {
    fontSize: 9,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: 'var(--muted)',
    margin: 0,
    writingMode: 'vertical-rl',
    transform: 'rotate(180deg)',
    maxHeight: 62,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: 'var(--muted)',
    margin: '0 0 6px',
  },
  grid: { display: 'flex', flexWrap: 'wrap', gap: 4 },
  templateList: { display: 'flex', flexDirection: 'column', gap: 4 },
  button: {
    minWidth: 34,
    height: 30,
    padding: '0 6px',
    fontSize: 14,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    cursor: 'pointer',
    color: 'var(--text)',
  },
  /** Parmak icin onerilen en kucuk hedef ~44px. */
  buttonTouch: { minWidth: 42, height: 42, fontSize: 15 },
  buttonWide: { width: '100%', fontSize: 12, textAlign: 'left' },
  buttonGrow: { flex: 1 },
  buttonActive: {
    background: 'var(--accent-soft)',
    border: '1px solid var(--accent)',
    color: 'var(--accent)',
    fontWeight: 600,
  },
  buttonDisabled: { opacity: 0.4, cursor: 'default' },
};
