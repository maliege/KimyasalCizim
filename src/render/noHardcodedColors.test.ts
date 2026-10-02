import { describe, expect, it } from 'vitest';

/**
 * Cizim bilesenlerinde tema disi sabit renk kalmasin.
 *
 * Koyu temada beyaz etiket haleleri boyle bir sabitten ciktı: JSX'te
 * fill="#fff" yazilmisti ve tek tirnakli arama onu kacirmisti. Icerik renkleri
 * theme.ts'teki INK / CANVAS_BG ya da elementColor() ile gelmeli; boylece hem
 * koyu temaya uyar hem de disa aktarimda acik temaya cozulur.
 */

// Vite'in glob'u: dosya iceriklerini ham metin olarak getirir (Node tipi gerekmez).
const sources = import.meta.glob('./*.tsx', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>;

/** Tema disi kalmamasi gereken renkler: saf beyaz/siyah ve cizim murekkebi. */
const FORBIDDEN = /["'`]#(?:fff|ffffff|000|000000|1c2029)["'`]/gi;

describe('çizim bileşenlerinde sabit renk yok', () => {
  it('en az bir bileşen tarandı', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(2);
  });

  it.each(Object.entries(sources))('%s', (_, source) => {
    expect(source.match(FORBIDDEN) ?? []).toEqual([]);
  });
});
