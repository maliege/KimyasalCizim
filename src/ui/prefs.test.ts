import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, parsePrefs } from './prefs';

describe('parsePrefs', () => {
  it('geçerli tercihleri korur', () => {
    expect(parsePrefs({ theme: 'dark', aromaticCircles: true })).toEqual({
      theme: 'dark',
      aromaticCircles: true,
    });
  });

  it('bozuk ya da eksik veride varsayılana düşer', () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('metin')).toEqual(DEFAULT_PREFS);
    expect(parsePrefs({ theme: 'mor', aromaticCircles: 'evet' })).toEqual(DEFAULT_PREFS);
  });
});
