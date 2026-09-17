import type { Molecule } from '../model/types';
import type { Point } from '../model/geometry';

/**
 * Tuvalin gorunum penceresi.
 *
 * SVG viewBox'i surer: (x, y) dunya koordinatinda sol ust kose, scale ise
 * piksel/dunya birimi orani. Tum fare koordinatlari bu pencereden gecirilerek
 * dunya koordinatina cevrilir.
 */
export type Viewport = { x: number; y: number; scale: number };

export const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, scale: 1 };

export const MIN_SCALE = 0.2;
export const MAX_SCALE = 5;

const clampScale = (scale: number): number => Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));

export const viewBoxOf = (vp: Viewport, width: number, height: number): string =>
  `${vp.x} ${vp.y} ${width / vp.scale} ${height / vp.scale}`;

/** Tuvale gore piksel konumunu dunya koordinatina cevirir. */
export const toWorld = (vp: Viewport, px: number, py: number): Point => ({
  x: vp.x + px / vp.scale,
  y: vp.y + py / vp.scale,
});

/** Dunya koordinatini tuvale gore piksel konumuna cevirir. */
export const toScreen = (vp: Viewport, point: Point): Point => ({
  x: (point.x - vp.x) * vp.scale,
  y: (point.y - vp.y) * vp.scale,
});

/**
 * Imlec altindaki noktayi sabit tutarak yakinlastirir/uzaklastirir.
 * Tekerlek zoom'unun dogal hissettirmesi bu sabitlemeye bagli.
 */
export function zoomAt(vp: Viewport, px: number, py: number, factor: number): Viewport {
  const scale = clampScale(vp.scale * factor);
  if (scale === vp.scale) return vp;

  const anchor = toWorld(vp, px, py);
  return { x: anchor.x - px / scale, y: anchor.y - py / scale, scale };
}

/** Tuvali ekran pikseli kadar kaydirir (surukleme yonunde icerik hareket eder). */
export const panBy = (vp: Viewport, dxPx: number, dyPx: number): Viewport => ({
  ...vp,
  x: vp.x - dxPx / vp.scale,
  y: vp.y - dyPx / vp.scale,
});

/**
 * Molekulu tuvale ortalayip sigdirir. Bos molekulde varsayilana doner.
 *
 * Buyutme 1:1 ile sinirlidir — yapilar zaten dogal boyutta (BOND_LENGTH)
 * cizildigi icin tek bagli bir molekulu ekrana yaymak okunakli degil,
 * sadece kafa karistirir. "Sigdir" ya kucultur ya da %100'de birakir.
 */
export function fitTo(mol: Molecule, width: number, height: number, padding = 60): Viewport {
  if (mol.atoms.length === 0) return DEFAULT_VIEWPORT;

  const xs = mol.atoms.map((a) => a.x);
  const ys = mol.atoms.map((a) => a.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  // Tek atomda genislik sifir olur; bolmeyi korumak icin taban deger.
  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);

  const scale = clampScale(
    Math.min(1, (width - padding * 2) / spanX, (height - padding * 2) / spanY),
  );

  // Molekulun merkezini tuvalin merkezine oturt.
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  return {
    x: centerX - width / (2 * scale),
    y: centerY - height / (2 * scale),
    scale,
  };
}
