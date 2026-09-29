import { useEffect, useMemo, useRef } from 'react';
import { CATEGORY_LABELS, examplesByCategory } from '../model/examples';
import type { Example } from '../model/examples';
import { renderSvg } from '../rdkit/RdkitService';
import { useRdkit } from '../rdkit/useRdkit';

type Props = {
  onPick: (example: Example) => void;
  onClose: () => void;
};

/**
 * Hazir molekuller galerisi.
 *
 * Kucuk resimler RDKit ile uretilir ve galeri acikken bir kez hesaplanir
 * (useMemo) — 24 WASM cagrisini her render'da tekrarlamak gereksiz.
 */
export default function ExampleGallery({ onPick, onClose }: Props) {
  const { status, rdkit } = useRdkit();
  const panelRef = useRef<HTMLDivElement>(null);

  const thumbnails = useMemo(() => {
    if (status !== 'ready') return new Map<string, string>();
    const map = new Map<string, string>();
    for (const [, examples] of examplesByCategory()) {
      for (const example of examples) {
        const svg = renderSvg(rdkit, example.smiles, 150, 110);
        if (svg) map.set(example.id, svg);
      }
    }
    return map;
  }, [status, rdkit]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
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
        aria-label="Örnek moleküller"
        style={styles.panel}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <header style={styles.header}>
          <div>
            <strong style={{ fontSize: 13 }}>Örnek moleküller</strong>
            <p style={styles.subtitle}>
              Seçtiğiniz yapı tuvale yüklenir; üzerinde değişiklik yapabilirsiniz.
              Ctrl+Z ile geri alınır.
            </p>
          </div>
          <button type="button" style={styles.close} onClick={onClose} title="Kapat (Esc)">
            ✕
          </button>
        </header>

        {status === 'loading' && <p style={styles.info}>Kimya motoru yükleniyor…</p>}
        {status === 'error' && (
          <p style={styles.error}>Kimya motoru yüklenemedi; örnekler gösterilemiyor.</p>
        )}

        {examplesByCategory().map(([category, examples]) => (
          <section key={category} style={{ marginBottom: 14 }}>
            <h3 style={styles.categoryTitle}>{CATEGORY_LABELS[category]}</h3>
            <div style={styles.grid}>
              {examples.map((example) => (
                <button
                  key={example.id}
                  type="button"
                  style={styles.card}
                  title={`${example.name} — ${example.note}`}
                  onClick={() => onPick(example)}
                >
                  <span
                    style={styles.thumb}
                    // RDKit'in urettigi SVG; kaynak bizim kendi veri
                    // dosyamizdaki SMILES, disaridan gelen icerik degil.
                    dangerouslySetInnerHTML={{ __html: thumbnails.get(example.id) ?? '' }}
                  />
                  <span style={styles.cardName}>{example.name}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

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
    padding: 16,
    boxShadow: '0 12px 40px rgba(0,0,0,0.22)',
    width: 'min(860px, 100%)',
    maxHeight: '100%',
    overflow: 'auto',
    outline: 'none',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 12,
  },
  subtitle: { margin: '4px 0 0', fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 },
  close: {
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 12,
    lineHeight: 1,
    padding: '4px 7px',
    color: 'var(--muted)',
    flexShrink: 0,
  },
  categoryTitle: {
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: 'var(--muted)',
    margin: '0 0 6px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(132px, 1fr))',
    gap: 8,
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    padding: 6,
    // Bilerek beyaz: RDKit kucuk resimleri beyaz zeminli; koyu temada kagit gibi dursun.
    background: '#fff',
    border: '1px solid var(--border)',
    borderRadius: 8,
    cursor: 'pointer',
    color: 'var(--text)',
  },
  thumb: {
    display: 'block',
    width: '100%',
    height: 92,
    overflow: 'hidden',
  },
  cardName: { fontSize: 11, fontWeight: 600 },
  info: { fontSize: 12, color: 'var(--muted)' },
  error: { fontSize: 12, color: 'var(--danger)' },
};
