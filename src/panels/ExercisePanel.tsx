import { EXERCISES, LEVEL_LABELS } from '../model/exercises';
import type { Exercise, Level, Verdict } from '../model/exercises';

type Props = {
  exercise: Exercise;
  verdict: Verdict | null;
  hintVisible: boolean;
  /** Hedefin kapali formulu — ipucuyla birlikte gosterilir */
  targetFormula: string | null;
  solved: Set<string>;
  compact: boolean;
  onPick: (id: string) => void;
  onCheck: () => void;
  onHint: () => void;
  onNext: () => void;
  onShare: () => void;
  onExit: () => void;
  shareState: 'kopyalandi' | null;
};

/**
 * Alistirma seridi: gorev, kontrol, ipucu ve sonuc.
 *
 * Kontrol bilerek bir dugmeye bagli, canli degil: ogrenci her atomda
 * "yanlis" gormesin, hazir oldugunda kendisi sorsun.
 */
export default function ExercisePanel({
  exercise,
  verdict,
  hintVisible,
  targetFormula,
  solved,
  compact,
  onPick,
  onCheck,
  onHint,
  onNext,
  onShare,
  onExit,
  shareState,
}: Props) {
  const levels = Object.keys(LEVEL_LABELS) as Level[];

  return (
    <section style={styles.strip} aria-label="Alıştırma">
      <div style={styles.row}>
        <span style={styles.badge}>Alıştırma</span>
        <label style={styles.task}>
          <span style={styles.srOnly}>Görev seç</span>
          <select
            value={exercise.id}
            onChange={(e) => onPick(e.target.value)}
            style={styles.select}
          >
            {levels.map((level) => (
              <optgroup key={level} label={LEVEL_LABELS[level]}>
                {EXERCISES.filter((e) => e.level === level).map((e) => (
                  <option key={e.id} value={e.id}>
                    {solved.has(e.id) ? '✓ ' : ''}
                    {e.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        {!compact && <span style={styles.prompt}>yapısını çizin.</span>}

        <span style={styles.spacer} />

        <button type="button" style={styles.primary} onClick={onCheck}>
          Kontrol et
        </button>
        <button type="button" style={styles.button} onClick={onHint} disabled={hintVisible}>
          İpucu
        </button>
        <button type="button" style={styles.button} onClick={onNext} title="Sonraki görev">
          Sonraki →
        </button>
        <button
          type="button"
          style={styles.button}
          onClick={onShare}
          title="Bu görevi açan bağlantıyı kopyala"
        >
          {shareState === 'kopyalandi' ? '✓' : '🔗'}
        </button>
        <button type="button" style={styles.button} onClick={onExit} title="Alıştırmadan çık">
          ✕
        </button>
      </div>

      {hintVisible && (
        <p style={styles.hint}>
          💡 {exercise.hint}
          {targetFormula && (
            <>
              {' '}
              Formül: <code>{targetFormula}</code>
            </>
          )}
        </p>
      )}

      {verdict && <VerdictLine verdict={verdict} onNext={onNext} />}

      <p style={styles.progress}>
        {solved.size} / {EXERCISES.length} görev çözüldü
      </p>
    </section>
  );
}

function VerdictLine({ verdict, onNext }: { verdict: Verdict; onNext: () => void }) {
  const [tone, text] = message(verdict);
  return (
    <p role="status" style={{ ...styles.verdict, ...TONES[tone] }}>
      {text}
      {verdict.kind === 'dogru' && (
        <button type="button" style={styles.nextInline} onClick={onNext}>
          Sonraki görev →
        </button>
      )}
    </p>
  );
}

type Tone = 'good' | 'near' | 'bad' | 'muted';

function message(verdict: Verdict): [Tone, string] {
  switch (verdict.kind) {
    case 'dogru':
      return ['good', 'Doğru! 🎉'];
    case 'stereo':
      return ['near', 'İskelet doğru, ama stereokimya farklı. Kama ve kesikli bağları kontrol edin.'];
    case 'protonlanma':
      return ['near', 'İskelet doğru, ama yük farklı. ＋ ve － araçlarıyla yükleri kontrol edin.'];
    case 'izomer':
      return [
        'near',
        `Formül doğru (${verdict.formula}) ama atomlar farklı bağlanmış — bu bir izomer.`,
      ];
    case 'yanlis':
      return [
        'bad',
        verdict.drawnFormula
          ? `Henüz değil. Çiziminizin formülü: ${verdict.drawnFormula}.`
          : 'Henüz değil.',
      ];
    case 'gecersiz':
      return ['bad', 'Yapı kimyasal olarak geçerli değil — kırmızı halkalı atomlara bakın.'];
    case 'bos':
      return ['muted', 'Önce yapıyı çizin.'];
  }
}

const TONES: Record<Tone, React.CSSProperties> = {
  good: { color: 'var(--good-fg)', background: 'var(--good-bg)', borderColor: 'var(--good-border)' },
  near: { color: 'var(--near-fg)', background: 'var(--near-bg)', borderColor: 'var(--near-border)' },
  bad: { color: 'var(--danger)', background: 'var(--bad-bg)', borderColor: 'var(--bad-border)' },
  muted: { color: 'var(--muted)', background: 'var(--bg)', borderColor: 'var(--border)' },
};

const baseButton: React.CSSProperties = {
  fontSize: 12,
  padding: '5px 10px',
  minHeight: 30,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  cursor: 'pointer',
  color: 'var(--text)',
  flexShrink: 0,
};

const styles: Record<string, React.CSSProperties> = {
  strip: {
    flexShrink: 0,
    padding: '8px 12px',
    background: 'var(--panel)',
    borderBottom: '1px solid var(--border)',
  },
  row: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  badge: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#fff',
    background: 'var(--accent)',
    borderRadius: 4,
    padding: '3px 6px',
  },
  task: { display: 'inline-flex' },
  select: {
    fontSize: 13,
    fontWeight: 600,
    padding: '4px 6px',
    border: '1px solid var(--border)',
    borderRadius: 6,
    background: 'var(--surface)',
    color: 'var(--text)',
  },
  prompt: { fontSize: 13 },
  spacer: { flex: 1 },
  button: baseButton,
  primary: {
    ...baseButton,
    background: 'var(--accent)',
    border: '1px solid var(--accent)',
    color: '#fff',
    fontWeight: 600,
  },
  hint: { fontSize: 12, margin: '8px 0 0', color: 'var(--text)', lineHeight: 1.5 },
  verdict: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    fontSize: 13,
    margin: '8px 0 0',
    padding: '6px 10px',
    borderWidth: 1,
    borderStyle: 'solid',
    borderRadius: 6,
  },
  nextInline: { ...baseButton, fontWeight: 600 },
  progress: { fontSize: 10, color: 'var(--muted)', margin: '6px 0 0' },
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    clip: 'rect(0 0 0 0)',
  },
};
