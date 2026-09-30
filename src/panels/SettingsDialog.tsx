import { useEffect, useRef } from 'react';
import { SETTINGS, groupsOf } from '../ui/settings';
import type { SettingDef, Settings } from '../ui/settings';

type Props = {
  settings: Settings;
  /** Deger App'te semaya gore dogrulanir (applySetting) */
  onChange: (key: string, value: unknown) => void;
  onReset: () => void;
  onClose: () => void;
};

/**
 * Tum gorunum ayarlari. Pencere semadan uretilir: yeni bir ayar SETTINGS'e
 * eklendiginde burada kendiliginden gorunur. Degisiklikler aninda uygulanir;
 * ayri bir "Uygula" adimi yok, tuval arkada canli degisir.
 */
export default function SettingsDialog({ settings, onChange, onReset, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const values = settings as Record<string, unknown>;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Pencere acikken hicbir tus arkadaki tuvale ulasmasin: yoksa ornegin
      // 'c' araci degistirir, Ctrl+Z cizimi geri alirdi. Olay pencerede
      // (yakalama asamasinda) durdurulur; dugmelerin Enter/Bosluk ve Tab
      // gibi varsayilan davranislari etkilenmez.
      e.stopPropagation();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  useEffect(() => panelRef.current?.focus(), []);

  return (
    <div style={styles.backdrop} onPointerDown={onClose} role="presentation">
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-label="Ayarlar"
        style={styles.panel}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <header style={styles.header}>
          <div>
            <strong style={{ fontSize: 14 }}>Ayarlar</strong>
            <p style={styles.subtitle}>Değişiklikler anında uygulanır ve bu cihazda saklanır.</p>
          </div>
          <button type="button" style={styles.close} onClick={onClose} title="Kapat (Esc)">
            ✕
          </button>
        </header>

        {groupsOf(SETTINGS).map(([group, defs]) => (
          <section key={group} style={{ marginBottom: 16 }}>
            <h3 style={styles.groupTitle}>{group}</h3>
            {defs.map((def) => (
              <SettingRow
                key={def.key}
                def={def}
                value={values[def.key]}
                onChange={(v) => onChange(def.key, v)}
              />
            ))}
          </section>
        ))}

        <footer style={styles.footer}>
          <button type="button" style={styles.button} onClick={onReset}>
            Varsayılana dön
          </button>
          <button type="button" style={styles.primary} onClick={onClose}>
            Tamam
          </button>
        </footer>
      </div>
    </div>
  );
}

function SettingRow({
  def,
  value,
  onChange,
}: {
  def: SettingDef;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const helpId = `ayar-${def.key}-aciklama`;
  return (
    <div style={styles.row}>
      <div style={styles.rowHead}>
        <span id={`ayar-${def.key}`} style={styles.label}>
          {def.label}
        </span>
        {def.type === 'boolean' && (
          <button
            type="button"
            role="switch"
            aria-checked={value === true}
            aria-labelledby={`ayar-${def.key}`}
            aria-describedby={helpId}
            onClick={() => onChange(!value)}
            style={{ ...styles.switch, ...(value === true ? styles.switchOn : {}) }}
          >
            <span style={{ ...styles.knob, ...(value === true ? styles.knobOn : {}) }} />
          </button>
        )}
      </div>

      {def.type === 'choice' && (
        <div
          role="radiogroup"
          aria-labelledby={`ayar-${def.key}`}
          aria-describedby={helpId}
          style={styles.segments}
        >
          {def.options.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange(option.value)}
                style={{ ...styles.segment, ...(selected ? styles.segmentOn : {}) }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}

      {def.type === 'number' && (
        <div style={styles.numberRow}>
          <input
            type="range"
            min={def.min}
            max={def.max}
            step={def.step}
            value={Number(value)}
            aria-labelledby={`ayar-${def.key}`}
            aria-describedby={helpId}
            onChange={(e) => onChange(Number(e.target.value))}
            style={{ flex: 1 }}
          />
          <span style={styles.numberValue}>{String(value)}</span>
        </div>
      )}

      <p id={helpId} style={styles.help}>
        {def.help}
      </p>
    </div>
  );
}

const baseButton: React.CSSProperties = {
  fontSize: 12,
  padding: '6px 12px',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  cursor: 'pointer',
  color: 'var(--text)',
};

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(17, 20, 26, 0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: 16,
  },
  panel: {
    background: 'var(--panel)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: 18,
    boxShadow: '0 12px 40px rgba(0,0,0,0.22)',
    width: 'min(480px, 100%)',
    maxHeight: '100%',
    overflow: 'auto',
    outline: 'none',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 14,
  },
  subtitle: { margin: '4px 0 0', fontSize: 11, color: 'var(--muted)' },
  close: { ...baseButton, padding: '4px 8px', color: 'var(--muted)', flexShrink: 0 },
  groupTitle: {
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: 'var(--muted)',
    margin: '0 0 8px',
  },
  row: { padding: '8px 0', borderTop: '1px solid var(--border)' },
  rowHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  label: { fontSize: 13, fontWeight: 600 },
  help: { fontSize: 11, color: 'var(--muted)', margin: '6px 0 0', lineHeight: 1.5 },
  segments: { display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' },
  segment: { ...baseButton, flex: 1, padding: '5px 8px' },
  segmentOn: {
    background: 'var(--accent-soft)',
    border: '1px solid var(--accent)',
    color: 'var(--accent)',
    fontWeight: 600,
  },
  switch: {
    position: 'relative',
    width: 38,
    height: 22,
    padding: 0,
    borderRadius: 11,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    cursor: 'pointer',
    flexShrink: 0,
  },
  switchOn: { background: 'var(--accent)', border: '1px solid var(--accent)' },
  knob: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 16,
    height: 16,
    borderRadius: '50%',
    background: 'var(--muted)',
    transition: 'left 120ms',
  },
  knobOn: { left: 18, background: '#fff' },
  numberRow: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 },
  numberValue: { fontSize: 12, fontFamily: 'ui-monospace, Consolas, monospace', minWidth: 32 },
  footer: { display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 4 },
  button: baseButton,
  primary: {
    ...baseButton,
    background: 'var(--accent)',
    border: '1px solid var(--accent)',
    color: '#fff',
    fontWeight: 600,
  },
};
