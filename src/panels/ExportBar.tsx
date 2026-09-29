import { useRef, useState } from 'react';
import { centerMolecule, fromMolfile, toMolfile, MolfileError } from '../model/molfile';
import { cleanupCoords, molblockFromSmiles } from '../rdkit/RdkitService';
import { useRdkit } from '../rdkit/useRdkit';
import type { Molecule } from '../model/types';
import ExampleGallery from './ExampleGallery';
import { resolveThemeVars } from '../render/theme';
import { buildShareUrl } from '../editor/shareLink';

type Props = {
  molecule: Molecule;
  /** RDKit'in kanonik SMILES'i; yoksa (bos ya da gecersiz yapi) paylasim kapali */
  smiles?: string | null;
  onImport: (molecule: Molecule) => void;
  svgRef: React.RefObject<SVGSVGElement | null>;
};

export default function ExportBar({ molecule, smiles: currentSmiles, onImport, svgRef }: Props) {
  const { status, rdkit } = useRdkit();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [smiles, setSmiles] = useState('');
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [shared, setShared] = useState<'kopyalandi' | 'paylasildi' | null>(null);
  const empty = molecule.atoms.length === 0;

  /** Tuvalin merkezi — iceri aktarilan yapiyi oraya oturtuyoruz. */
  const canvasCenter = () => {
    const canvas = svgRef.current;
    return { x: (canvas?.clientWidth ?? 600) / 2, y: (canvas?.clientHeight ?? 400) / 2 };
  };

  /** SMILES'i tuvale yukler. @returns basarili oldu mu */
  function loadSmiles(input: string): boolean {
    if (status !== 'ready') {
      setError('Kimya motoru henüz hazır değil.');
      return false;
    }
    const molblock = molblockFromSmiles(rdkit, input);
    if (!molblock) {
      setError('SMILES çözümlenemedi. Yazımı kontrol edin.');
      return false;
    }
    setError(null);
    onImport(centerMolecule(fromMolfile(molblock), canvasCenter()));
    return true;
  }

  /**
   * Paylasim baglantisi: telefonda isletim sisteminin paylasim penceresi
   * (WhatsApp, e-posta…), masaustunde panoya kopyalama. Masaustu tarayicilarin
   * cogu da navigator.share sunuyor ama orada kullanicinin bekledigi pano.
   */
  async function handleShare() {
    if (!currentSmiles) return;
    const url = buildShareUrl(window.location.href, currentSmiles);
    const touch = window.matchMedia('(pointer: coarse)').matches;
    try {
      if (touch && navigator.share) {
        await navigator.share({ title: 'KimyasalÇizim', url });
        setShared('paylasildi');
      } else {
        await navigator.clipboard.writeText(url);
        setShared('kopyalandi');
      }
      setError(null);
    } catch (err) {
      // Kullanici paylasim penceresini kapattiysa hata degil.
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError('Bağlantı kopyalanamadı: ' + url);
    }
    setTimeout(() => setShared(null), 2000);
  }

  function handleSmiles() {
    const input = smiles.trim();
    if (input && loadSmiles(input)) setSmiles('');
  }

  function handleCleanup() {
    if (status !== 'ready') return;
    const cleaned = cleanupCoords(rdkit, toMolfile(molecule));
    if (!cleaned) {
      setError('Yapı düzenlenemedi — geçerli bir molekül olmayabilir.');
      return;
    }
    setError(null);
    onImport(centerMolecule(fromMolfile(cleaned), canvasCenter()));
  }

  async function handleImport(file: File) {
    try {
      const text = await file.text();
      // RDKit ile gecirmek acik hidrojenleri temizler ve koordinatsiz
      // dosyalara duzen uretir.
      const normalized =
        status === 'ready' ? (cleanupCoords(rdkit, text) ?? text) : text;
      onImport(centerMolecule(fromMolfile(normalized), canvasCenter()));
      setError(null);
    } catch (err) {
      setError(err instanceof MolfileError ? err.message : 'Dosya okunamadı.');
    }
  }

  return (
    <div>
      <div style={styles.row}>
        <button
          type="button"
          style={styles.button}
          disabled={empty || status !== 'ready'}
          title="Koordinatları RDKit ile yeniden düzenle"
          onClick={handleCleanup}
        >
          ✨ Düzenle
        </button>
        <button
          type="button"
          style={styles.button}
          disabled={empty}
          title="SVG olarak indir"
          onClick={() => downloadSvg(svgRef.current)}
        >
          SVG
        </button>
        <button
          type="button"
          style={styles.button}
          disabled={empty}
          title="PNG olarak indir (2× çözünürlük)"
          onClick={() => void downloadPng(svgRef.current)}
        >
          PNG
        </button>
        <button
          type="button"
          style={styles.button}
          disabled={empty}
          title="MDL Molfile olarak indir"
          onClick={() => downloadText(toMolfile(molecule, 'KimyasalCizim'), 'molekul.mol')}
        >
          .mol
        </button>
        <button
          type="button"
          style={styles.button}
          title=".mol dosyası yükle"
          onClick={() => fileRef.current?.click()}
        >
          ⬆ Yükle
        </button>
        <button
          type="button"
          style={styles.button}
          title="Hazır molekül galerisini aç"
          onClick={() => setGalleryOpen(true)}
        >
          Örnekler
        </button>
        <button
          type="button"
          style={styles.button}
          disabled={!currentSmiles}
          title="Bu yapıyı açan bir bağlantı üret"
          onClick={() => void handleShare()}
        >
          {shared === 'kopyalandi' ? '✓ Kopyalandı' : shared === 'paylasildi' ? '✓ Paylaşıldı' : '🔗 Bağlantı'}
        </button>
      </div>

      {galleryOpen && (
        <ExampleGallery
          onPick={(example) => {
            if (loadSmiles(example.smiles)) setGalleryOpen(false);
          }}
          onClose={() => setGalleryOpen(false)}
        />
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".mol,.sdf,chemical/x-mdl-molfile"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImport(file);
          e.target.value = ''; // ayni dosya tekrar secilebilsin
        }}
      />

      <div style={styles.smilesRow}>
        <input
          type="text"
          value={smiles}
          placeholder="SMILES yapıştır…"
          spellCheck={false}
          style={styles.smilesInput}
          onChange={(e) => setSmiles(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSmiles();
          }}
        />
        <button
          type="button"
          style={styles.button}
          disabled={!smiles.trim()}
          title="SMILES'ten yapı oluştur (tuvaldekinin yerine geçer)"
          onClick={handleSmiles}
        >
          Çiz
        </button>
      </div>

      {error && <p style={styles.error}>{error}</p>}
    </div>
  );
}

// --- disa aktarma yardimcilari ---

function serializeSvg(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  // CSS degiskenleri disa aktarilan dosyada cozulmez; sabit renge cevir.
  // 1) Icerik renkleri: var(--ad, yedek) → yedek. Belgeye giden gorsel her
  //    zaman acik tema olur (beyaz zemin, koyu murekkep), ekranda hangi tema
  //    acik olursa olsun.
  for (const node of [clone, ...clone.querySelectorAll('*')]) {
    for (const attr of ['stroke', 'fill', 'style']) {
      const value = node.getAttribute(attr);
      if (value?.includes('var(')) node.setAttribute(attr, resolveThemeVars(value));
    }
  }
  // 2) Geriye kalan yedeksiz var(--ad) ifadeleri arayuz katmanidir (secim,
  //    vurgu, onizleme): gorselden cikarilir.
  clone.querySelectorAll('[stroke^="var("], [fill^="var("]').forEach((node) => node.remove());
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  return new XMLSerializer().serializeToString(clone);
}

function downloadSvg(svg: SVGSVGElement | null) {
  if (!svg) return;
  downloadText(serializeSvg(svg), 'molekul.svg', 'image/svg+xml');
}

async function downloadPng(svg: SVGSVGElement | null, scale = 2) {
  if (!svg) return;
  const source = serializeSvg(svg);
  const width = svg.clientWidth || Number(svg.getAttribute('width'));
  const height = svg.clientHeight || Number(svg.getAttribute('height'));

  const image = new Image();
  const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml' }));
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('SVG rasterleştirilemedi'));
      image.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (blob) downloadBlob(blob, 'molekul.png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

function downloadText(text: string, filename: string, type = 'text/plain') {
  downloadBlob(new Blob([text], { type }), filename);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const styles: Record<string, React.CSSProperties> = {
  row: { display: 'flex', flexWrap: 'wrap', gap: 4 },
  smilesRow: { display: 'flex', gap: 4, marginTop: 6 },
  smilesInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    fontFamily: 'ui-monospace, Consolas, monospace',
    padding: '4px 6px',
    border: '1px solid var(--border)',
    borderRadius: 6,
    color: 'var(--text)',
  },
  button: {
    fontSize: 11,
    padding: '4px 8px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    cursor: 'pointer',
    color: 'var(--text)',
  },
  error: { fontSize: 11, color: 'var(--danger)', marginTop: 6, lineHeight: 1.4 },
};
