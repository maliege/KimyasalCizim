import { Fragment, useEffect, useRef } from 'react';
import {
  ACTINIDES,
  LANTHANIDES,
  MAIN_BLOCK,
  atomicNumber,
  blockAt,
  elementName,
} from '../model/elements';
import type { Block } from '../model/elements';
import { hasKnownValence } from '../model/valence';
import { elementColor } from '../render/style';

type Props = {
  /** Su an secili element — tabloda vurgulanir */
  selected: string;
  onPick: (element: string) => void;
  onClose: () => void;
};

/** Elektron bloguna gore hucre arkaplani. */
const BLOCK_BACKGROUND: Record<Block, string> = {
  s: '#fdecec',
  p: '#fdf6e3',
  d: '#e9f1fd',
  f: '#e9f6ec',
};

/**
 * Periyodik tablodan element secme penceresi.
 *
 * Hizli palete 10 element sigiyor; geri kalan 108'e buradan ulasilir.
 */
export default function ElementPicker({ selected, onPick, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Esc ile kapat. Efektin temizleme fonksiyonu C#'taki Dispose gibi:
  // bilesen kalkinca dinleyici de kalkar.
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

  // Acilinca odagi panele al ki klavye tuval kisayollarina gitmesin.
  useEffect(() => panelRef.current?.focus(), []);

  return (
    <div style={styles.backdrop} onPointerDown={onClose} role="presentation">
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-label="Periyodik tablo"
        style={styles.panel}
        // Panel icindeki tiklama arkaplanı kapatmasin.
        onPointerDown={(e) => e.stopPropagation()}
      >
        <header style={styles.header}>
          <strong style={{ fontSize: 13 }}>Periyodik tablo</strong>
          <button type="button" style={styles.close} onClick={onClose} title="Kapat (Esc)">
            ✕
          </button>
        </header>

        <div style={styles.grid}>
          {MAIN_BLOCK.map((period, periodIndex) =>
            period.map((symbol, groupIndex) =>
              symbol ? (
                <Cell
                  key={symbol}
                  symbol={symbol}
                  block={blockAt(periodIndex + 1, groupIndex + 1)}
                  selected={symbol === selected}
                  onPick={onPick}
                />
              ) : (
                <span key={`bosluk-${periodIndex}-${groupIndex}`} />
              ),
            ),
          )}

          {/* f blogu: ana govdedeki La/Ac'in sagindan basla (4.-17. sutunlar) */}
          {[LANTHANIDES, ACTINIDES].map((series, rowIndex) => (
            <Fragment key={`f-${rowIndex}`}>
              <span style={{ gridColumn: '1 / 4', height: rowIndex === 0 ? 10 : undefined }} />
              {series.map((symbol) => (
                <Cell
                  key={symbol}
                  symbol={symbol}
                  block="f"
                  selected={symbol === selected}
                  onPick={onPick}
                />
              ))}
            </Fragment>
          ))}
        </div>

        <p style={styles.note}>
          Geçiş metallerinin değerliği değişken olduğu için onlarda hidrojen otomatik
          hesaplanmaz — istediğiniz hidrojeni elle bağlayın.
        </p>
      </div>
    </div>
  );
}

function Cell({
  symbol,
  block,
  selected,
  onPick,
}: {
  symbol: string;
  block: Block;
  selected: boolean;
  onPick: (element: string) => void;
}) {
  const number = atomicNumber(symbol);
  return (
    <button
      type="button"
      title={`${number} · ${elementName(symbol)}${
        hasKnownValence(symbol) ? '' : ' (değerlik tanımsız)'
      }`}
      onClick={() => onPick(symbol)}
      style={{
        ...styles.cell,
        background: selected ? 'var(--accent-soft)' : BLOCK_BACKGROUND[block],
        border: selected ? '1px solid var(--accent)' : '1px solid var(--border)',
      }}
    >
      <span style={styles.cellNumber}>{number}</span>
      <span style={{ ...styles.cellSymbol, color: elementColor(symbol) }}>{symbol}</span>
    </button>
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
    padding: 14,
    boxShadow: '0 12px 40px rgba(0,0,0,0.22)',
    maxWidth: '100%',
    maxHeight: '100%',
    overflow: 'auto',
    outline: 'none',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 16,
  },
  close: {
    border: '1px solid var(--border)',
    background: '#fff',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 12,
    lineHeight: 1,
    padding: '4px 7px',
    color: 'var(--muted)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(18, 34px)',
    gap: 2,
  },
  cell: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: 34,
    padding: 0,
    borderRadius: 4,
    cursor: 'pointer',
    lineHeight: 1,
  },
  cellNumber: { fontSize: 7, color: 'var(--muted)' },
  cellSymbol: { fontSize: 12, fontWeight: 600 },
  note: {
    margin: '10px 0 0',
    fontSize: 11,
    color: 'var(--muted)',
    maxWidth: 640,
    lineHeight: 1.5,
  },
};
