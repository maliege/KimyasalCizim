/**
 * Tema renkleri ve disa aktarma kurali.
 *
 * Cizimdeki renkler iki turludur ve yazilisi bunu belirler:
 *
 *   var(--ad, #acikRenk)  → ICERIK (bag, atom etiketi, tuval arkaplani).
 *                           Temaya gore degisir; disa aktarimda yedek degere,
 *                           yani acik temaya cozulur. Belgeye giden gorsel
 *                           her zaman beyaz zemin + koyu murekkep olur.
 *   var(--ad)             → ARAYUZ KATMANI (secim halkasi, vurgu, onizleme).
 *                           Disa aktarimda tamamen cikarilir.
 *
 * Yedek deger parantez icermemeli (rgba() yazmayin): cozucu duz ifade kullanir.
 */

/** Tema degiskenine bagli icerik rengi: `var(--ad, yedek)`. */
export const themed = (name: string, fallback: string): string => `var(--${name}, ${fallback})`;

/** Cizgi ve karbon murekkebi */
export const INK = themed('ink', '#1c2029');
/** Tuval arkaplani; etiket haleleri de bununla boyanir ki zeminle kaynassin */
export const CANVAS_BG = themed('canvas-bg', '#ffffff');

const WITH_FALLBACK = /var\(--[\w-]+,\s*([^()]+?)\)/g;

/**
 * Disa aktarim icin: `var(--ad, yedek)` ifadelerini yedek degerle degistirir.
 * Yedegi olmayan `var(--ad)` ifadelerine dokunmaz — onlar arayuz katmanidir
 * ve ayri bir adimda silinir.
 */
export function resolveThemeVars(value: string): string {
  return value.replace(WITH_FALLBACK, (_, fallback: string) => fallback.trim());
}

export type ThemeChoice = 'auto' | 'light' | 'dark';

export const THEME_LABELS: Record<ThemeChoice, string> = {
  auto: 'Otomatik',
  light: 'Açık',
  dark: 'Koyu',
};

/** Otomatik → Açık → Koyu → Otomatik */
export function nextTheme(current: ThemeChoice): ThemeChoice {
  return current === 'auto' ? 'light' : current === 'light' ? 'dark' : 'auto';
}
