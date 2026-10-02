import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  applySetting,
  SETTINGS,
  groupsOf,
  nextChoice,
  parseSettings,
  parseWith,
} from './settings';
import type { ChoiceDef, SettingDef } from './settings';

describe('şema', () => {
  it('anahtarlar benzersiz', () => {
    const keys = SETTINGS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('her seçim ayarının varsayılanı kendi seçenekleri arasında', () => {
    for (const def of SETTINGS as readonly SettingDef[]) {
      if (def.type === 'choice') {
        expect(def.options.map((o) => o.value), def.key).toContain(def.default);
      }
    }
  });

  it('her ayarın etiketi ve açıklaması var', () => {
    for (const def of SETTINGS) {
      expect(def.label.trim(), def.key).not.toBe('');
      expect(def.help.trim(), def.key).not.toBe('');
    }
  });
});

describe('parseSettings', () => {
  it('boş veride varsayılanları verir', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('bozuk')).toEqual(DEFAULT_SETTINGS);
  });

  it('geçerli değerleri korur', () => {
    const s = parseSettings({ theme: 'dark', carbonLabels: 'terminal', carbonHydrogens: 'hide' });
    expect(s).toMatchObject({ theme: 'dark', carbonLabels: 'terminal', carbonHydrogens: 'hide' });
  });

  it('geçersiz değeri yalnız o alanda varsayılana düşürür', () => {
    const s = parseSettings({ theme: 'mor', aromaticCircles: true });
    expect(s.theme).toBe('auto');
    expect(s.aromaticCircles).toBe(true);
  });

  it('tanınmayan alanları atar', () => {
    expect(parseSettings({ eskiBirAyar: 1 })).not.toHaveProperty('eskiBirAyar');
  });

  describe('eski tercihlerden geçiş', () => {
    it('showCarbons: true → carbonLabels: all', () => {
      expect(parseSettings({ showCarbons: true }).carbonLabels).toBe('all');
    });

    it('showCarbons: false → varsayılan (gizli)', () => {
      expect(parseSettings({ showCarbons: false }).carbonLabels).toBe('hidden');
    });

    it('yeni alan varsa eskisi onu ezmez', () => {
      expect(parseSettings({ showCarbons: true, carbonLabels: 'terminal' }).carbonLabels).toBe(
        'terminal',
      );
    });
  });
});

describe('parseWith — sayı türü', () => {
  // Şemada henüz sayı ayarı yok; tür desteğini deneme şemasıyla sınıyoruz.
  const schema: SettingDef[] = [
    { key: 'bagUzunlugu', group: 'x', label: 'x', help: 'x', type: 'number', min: 20, max: 80, step: 5, default: 40 },
  ];

  it('aralık dışını sınırlar içine çeker', () => {
    expect(parseWith(schema, { bagUzunlugu: 500 })).toEqual({ bagUzunlugu: 80 });
    expect(parseWith(schema, { bagUzunlugu: 3 })).toEqual({ bagUzunlugu: 20 });
  });

  it('sayı olmayan değerde varsayılana düşer', () => {
    expect(parseWith(schema, { bagUzunlugu: 'uzun' })).toEqual({ bagUzunlugu: 40 });
    expect(parseWith(schema, { bagUzunlugu: Number.NaN })).toEqual({ bagUzunlugu: 40 });
  });
});

describe('yardımcılar', () => {
  it('groupsOf şema sırasını korur', () => {
    expect(groupsOf(SETTINGS).map(([g]) => g)).toEqual(['Görünüm', 'Etiketler']);
  });

  it('nextChoice sona gelince başa döner', () => {
    const tema = SETTINGS.find((s) => s.key === 'theme') as ChoiceDef;
    expect(nextChoice(tema, 'auto')).toBe('light');
    expect(nextChoice(tema, 'dark')).toBe('auto');
  });
});

describe('applySetting', () => {
  it('geçerli değeri uygular, öbür ayarlara dokunmaz', () => {
    const s = applySetting(DEFAULT_SETTINGS, 'carbonLabels', 'terminal');
    expect(s.carbonLabels).toBe('terminal');
    expect(s.theme).toBe(DEFAULT_SETTINGS.theme);
  });

  it('geçersiz değeri ve bilinmeyen anahtarı yok sayar', () => {
    expect(applySetting(DEFAULT_SETTINGS, 'carbonLabels', 'yarisi')).toBe(DEFAULT_SETTINGS);
    expect(applySetting(DEFAULT_SETTINGS, 'yokBoyle', true)).toBe(DEFAULT_SETTINGS);
    expect(applySetting(DEFAULT_SETTINGS, 'aromaticCircles', 'evet')).toBe(DEFAULT_SETTINGS);
  });
});
