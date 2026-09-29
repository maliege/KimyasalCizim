import { bondOrderSum, getAtom } from '../model/molecule';
import { elementName } from '../model/elements';
import { molecularFormula } from '../model/valence';
import { findFunctionalGroup } from '../model/functionalGroups';
import type { GroupHits } from '../rdkit/useMoleculeInfo';
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
  /** Dar ekran: sabit genislikli sutun yerine tam genislik alt panel */
  compact?: boolean;
  /** Degerligi asilmis atomlar */
  errorAtomIds?: string[];
  /** RDKit'in buldugu fonksiyonel gruplar */
  groups?: GroupHits[];
  /** Tuvalde vurgulanan grup */
  activeGroup?: string | null;
  onToggleGroup?: (id: string) => void;
  /** Dar ekranda paneli kapatma dugmesi gosterilir */
  onClose?: () => void;
};

export default function InfoPanel({
  molecule,
  info,
  pending,
  status,
  onImport,
  svgRef,
  compact = false,
  onClose,
  errorAtomIds = [],
  groups = [],
  activeGroup = null,
  onToggleGroup,
}: Props) {
  const empty = molecule.atoms.length === 0;
  const formula = molecularFormula(molecule);

  return (
    <aside style={compact ? styles.panelCompact : styles.panel}>
      {onClose && (
        <button type="button" style={styles.closeRow} onClick={onClose}>
          ▾ Bilgi panelini kapat
        </button>
      )}
      <ExportBar
        molecule={molecule}
        smiles={info?.valid ? info.smiles : null}
        onImport={onImport}
        svgRef={svgRef}
      />

      <h2 style={styles.title}>Molekül bilgisi</h2>

      {status === 'loading' && <p style={styles.muted}>Kimya motoru yükleniyor…</p>}
      {status === 'error' && (
        <p style={styles.error}>Kimya motoru yüklenemedi. Çizim çalışır, hesaplama yapılamaz.</p>
      )}

      {empty ? (
        <p style={styles.muted}>
          Tuval boş. Bağ çizmek için sürükleyin, ya da yukarıdan <strong>Örnekler</strong>’i
          açıp hazır bir yapıyla başlayın.
        </p>
      ) : (
        <>
          <Field label="Kapalı formül" value={formula} mono />

          {errorAtomIds.length > 0 ? (
            // Hangi atomun sorunlu oldugunu soyluyoruz; ogrenci icin asil
            // bilgi bu. Atomlar tuvalde de kirmizi halkayla isaretli.
            <div style={styles.error}>
              <strong>Değerlik aşıldı</strong> (tuvalde kırmızı halkalı):
              <ul style={styles.errorList}>
                {errorAtomIds.map((id) => {
                  const atom = getAtom(molecule, id);
                  if (!atom) return null;
                  return (
                    <li key={id}>
                      {elementName(atom.element)} ({atom.element}) — {bondOrderSum(molecule, id)}{' '}
                      bağ
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            info &&
            !info.valid && (
              <p style={styles.error}>
                Yapı kimyasal olarak geçerli değil. Çizime devam edebilirsiniz.
              </p>
            )
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

          {groups.length > 0 && (
            <>
              <h3 style={styles.subtitle}>Fonksiyonel gruplar</h3>
              <p style={styles.hint}>Tuvalde görmek için tıklayın.</p>
              <div style={styles.chips}>
                {groups.map((g) => {
                  const def = findFunctionalGroup(g.id);
                  if (!def) return null;
                  const active = activeGroup === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onToggleGroup?.(g.id)}
                      style={{
                        ...styles.chip,
                        borderColor: def.color,
                        background: active ? def.color : '#fff',
                        color: active ? '#fff' : 'var(--text)',
                      }}
                    >
                      <span
                        style={{ ...styles.dot, background: active ? '#fff' : def.color }}
                      />
                      {def.name}
                      {g.matches.length > 1 && (
                        <span style={{ opacity: 0.7 }}> ×{g.matches.length}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}

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
  /** Dar ekran: tuvalin altinda, yuksekligi sinirli bir panel. */
  panelCompact: {
    flexShrink: 0,
    maxHeight: '45%',
    padding: 12,
    background: 'var(--panel)',
    borderTop: '1px solid var(--border)',
    overflowY: 'auto',
  },
  closeRow: {
    width: '100%',
    marginBottom: 8,
    padding: '8px 10px',
    fontSize: 12,
    background: '#fff',
    border: '1px solid var(--border)',
    borderRadius: 6,
    cursor: 'pointer',
    color: 'var(--muted)',
  },
  title: { fontSize: 13, margin: '16px 0 10px' },
  hint: { fontSize: 10, color: 'var(--muted)', margin: '0 0 6px' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 4 },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '3px 8px',
    fontSize: 11,
    // border kisayolu: React borderColor ile karisinca uyariyor; rengi ayrica veriyoruz
    borderWidth: 1,
    borderStyle: 'solid',
    borderRadius: 12,
    cursor: 'pointer',
  },
  dot: { width: 7, height: 7, borderRadius: '50%', flexShrink: 0 },
  subtitle: { fontSize: 11, textTransform: 'uppercase', color: 'var(--muted)', margin: '14px 0 6px' },
  muted: { fontSize: 12, color: 'var(--muted)' },
  errorList: { margin: '4px 0 0', paddingLeft: 18 },
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
