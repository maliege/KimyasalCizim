import { molecularFormula } from '../model/valence';
import type { MoleculeInfo } from '../rdkit/RdkitService';
import type { RdkitState } from '../rdkit/useRdkit';
import type { Molecule } from '../model/types';
import ExportBar from './ExportBar';

type Props = {
  molecule: Molecule;
  info: MoleculeInfo | null;
  pending: boolean;
  status: RdkitState['status'];
  onImport: (molecule: Molecule) => void;
  svgRef: React.RefObject<SVGSVGElement | null>;
};

export default function InfoPanel({
  molecule,
  info,
  pending,
  status,
  onImport,
  svgRef,
}: Props) {
  const empty = molecule.atoms.length === 0;
  const formula = molecularFormula(molecule);

  return (
    <aside style={styles.panel}>
      <ExportBar molecule={molecule} onImport={onImport} svgRef={svgRef} />

      <h2 style={styles.title}>Molekül bilgisi</h2>

      {status === 'loading' && <p style={styles.muted}>Kimya motoru yükleniyor…</p>}
      {status === 'error' && (
        <p style={styles.error}>Kimya motoru yüklenemedi. Çizim çalışır, hesaplama yapılamaz.</p>
      )}

      {empty ? (
        <p style={styles.muted}>Tuval boş. Çizmeye başlayın.</p>
      ) : (
        <>
          <Field label="Kapalı formül" value={formula} mono />

          {info && !info.valid && (
            <p style={styles.error}>
              Yapı kimyasal olarak geçerli değil (valans hatası olabilir). Çizime devam
              edebilirsiniz.
            </p>
          )}

          <Field
            label="SMILES"
            value={info?.smiles ?? (pending ? 'hesaplanıyor…' : '—')}
            mono
            copyable
          />
          <Field
            label="InChI"
            value={info?.inchi ?? (pending ? 'hesaplanıyor…' : '—')}
            mono
            copyable
            small
          />
          <Field label="InChIKey" value={info?.inchiKey ?? '—'} mono copyable small />

          {info?.descriptors && (
            <>
              <h3 style={styles.subtitle}>Hesaplanan özellikler</h3>
              <dl style={styles.dl}>
                <Row label="Molekül ağırlığı" value={fmt(info.descriptors.amw, 2, ' g/mol')} />
                <Row label="Tam kütle" value={fmt(info.descriptors.exactmw, 4)} />
                <Row label="Ağır atom sayısı" value={fmt(info.descriptors.NumHeavyAtoms, 0)} />
                <Row label="Halka sayısı" value={fmt(info.descriptors.NumRings, 0)} />
                <Row label="Dönebilen bağ" value={fmt(info.descriptors.NumRotatableBonds, 0)} />
                <Row label="LogP (Crippen)" value={fmt(info.descriptors.CrippenClogP, 2)} />
                <Row label="TPSA" value={fmt(info.descriptors.tpsa, 1, ' Å²')} />
                <Row label="H bağı verici / alıcı" value={
                  `${fmt(info.descriptors.lipinskiHBD, 0)} / ${fmt(info.descriptors.lipinskiHBA, 0)}`
                } />
              </dl>
            </>
          )}
        </>
      )}
    </aside>
  );
}

function Field({
  label,
  value,
  mono,
  copyable,
  small,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
  small?: boolean;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={styles.fieldHeader}>
        <span style={styles.fieldLabel}>{label}</span>
        {copyable && value && value !== '—' && (
          <button
            type="button"
            style={styles.copyButton}
            title="Panoya kopyala"
            onClick={() => void navigator.clipboard.writeText(value)}
          >
            kopyala
          </button>
        )}
      </div>
      <div
        style={{
          ...styles.fieldValue,
          fontFamily: mono ? 'ui-monospace, Consolas, monospace' : 'inherit',
          fontSize: small ? 10 : 12,
        }}
      >
        {value}
      </div>
    </div>
  );
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <>
    <dt style={styles.dt}>{label}</dt>
    <dd style={styles.dd}>{value}</dd>
  </>
);

const fmt = (n: number | undefined, digits: number, suffix = ''): string =>
  n === undefined ? '—' : n.toFixed(digits) + suffix;

const styles: Record<string, React.CSSProperties> = {
  panel: {
    width: 260,
    flexShrink: 0,
    padding: 12,
    background: 'var(--panel)',
    borderLeft: '1px solid var(--border)',
    overflowY: 'auto',
  },
  title: { fontSize: 13, margin: '16px 0 10px' },
  subtitle: { fontSize: 11, textTransform: 'uppercase', color: 'var(--muted)', margin: '14px 0 6px' },
  muted: { fontSize: 12, color: 'var(--muted)' },
  error: { fontSize: 11, color: 'var(--danger)', lineHeight: 1.5 },
  fieldHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' },
  fieldLabel: { fontSize: 10, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: 0.4 },
  copyButton: {
    fontSize: 10,
    padding: '1px 5px',
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 4,
    cursor: 'pointer',
    color: 'var(--muted)',
  },
  fieldValue: {
    marginTop: 2,
    padding: '4px 6px',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    wordBreak: 'break-all',
    lineHeight: 1.5,
  },
  dl: { display: 'grid', gridTemplateColumns: '1fr auto', gap: '3px 8px', margin: 0, fontSize: 11 },
  dt: { color: 'var(--muted)' },
  dd: { margin: 0, textAlign: 'right', fontFamily: 'ui-monospace, Consolas, monospace' },
};
