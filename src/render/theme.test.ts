import { describe, expect, it } from 'vitest';
import { CANVAS_BG, INK, nextTheme, resolveThemeVars, themed } from './theme';
import { elementColor } from './style';

describe('resolveThemeVars — dışa aktarma', () => {
  it('yedekli değişkeni yedeğe çözer', () => {
    expect(resolveThemeVars(INK)).toBe('#1c2029');
    expect(resolveThemeVars(CANVAS_BG)).toBe('#ffffff');
  });

  it('yedeksiz arayüz değişkenine dokunmaz (ayrıca silinecek)', () => {
    expect(resolveThemeVars('var(--accent)')).toBe('var(--accent)');
  });

  it('bir stil dizgesindeki birden çok değişkeni çözer', () => {
    const style = `display: block; background: ${CANVAS_BG}; color: ${INK};`;
    expect(resolveThemeVars(style)).toBe('display: block; background: #ffffff; color: #1c2029;');
  });

  it('düz renklere dokunmaz', () => {
    expect(resolveThemeVars('#d92020')).toBe('#d92020');
  });

  it('tüm element renkleri dışa aktarımda düz renge çözülür', () => {
    // Çözülmeyen biri kalsaydı dışa aktarıcı o etiketi "arayüz katmanı"
    // sanıp silerdi — atom etiketleri görselden kaybolurdu.
    for (const el of ['C', 'H', 'N', 'O', 'S', 'Cl', 'Fe', 'Xx']) {
      expect(resolveThemeVars(elementColor(el)), el).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('themed() yardımcısı doğru biçimi üretir', () => {
    expect(themed('el-N', '#2050d0')).toBe('var(--el-N, #2050d0)');
  });
});

describe('nextTheme', () => {
  it('Otomatik → Açık → Koyu → Otomatik döner', () => {
    expect(nextTheme('auto')).toBe('light');
    expect(nextTheme('light')).toBe('dark');
    expect(nextTheme('dark')).toBe('auto');
  });
});
