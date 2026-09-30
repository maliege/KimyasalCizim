/**
 * Gorunum ayarlari — tek kaynak.
 *
 * Her ayar asagidaki SETTINGS listesinde bir kayittir. Tip (`Settings`),
 * varsayilan degerler ve dogrulama bu listeden TURETILIR; Ayarlar penceresi
 * ve sol paneldeki hizli dugmeler de ondan uretilir. Yeni bir ayar eklemek =
 * bu listeye bir satir + onu kullanan cizim kodu.
 *
 * Ayarlar cihaza ozeldir: tarayicida saklanir, paylasim baglantisina girmez.
 */

type Base = {
  key: string;
  /** Ayarlar penceresindeki bolum */
  group: string;
  label: string;
  /** Pencerede ayarin altindaki kisa aciklama */
  help: string;
  /** true ise sol panelde de tek tiklik dugme olarak gorunur */
  quick?: boolean;
  /** Dar sol panel icin kisa ad (yoksa label) */
  short?: string;
};

export type BooleanDef = Base & { type: 'boolean'; default: boolean };
export type ChoiceDef = Base & {
  type: 'choice';
  options: readonly { value: string; label: string }[];
  default: string;
};
export type NumberDef = Base & {
  type: 'number';
  min: number;
  max: number;
  step: number;
  default: number;
};
export type SettingDef = BooleanDef | ChoiceDef | NumberDef;

export const SETTINGS = [
  {
    key: 'theme',
    group: 'Görünüm',
    label: 'Tema',
    help: 'Otomatik, sistemin açık/koyu tercihini izler. Dışa aktarılan görseller her zaman açık temadır.',
    type: 'choice',
    options: [
      { value: 'auto', label: 'Otomatik' },
      { value: 'light', label: 'Açık' },
      { value: 'dark', label: 'Koyu' },
    ],
    default: 'auto',
    quick: true,
  },
  {
    key: 'aromaticCircles',
    group: 'Görünüm',
    label: 'Aromatik daire',
    help: 'Aromatik halkaları bir atlamalı ikili bağlar yerine içte daireyle gösterir.',
    type: 'boolean',
    default: false,
    quick: true,
  },
  {
    key: 'carbonLabels',
    group: 'Etiketler',
    label: 'Karbon etiketleri',
    help: 'Gizli: iskelet gösterim. Uçlar: yalnız zincir uçlarındaki karbonlar (CH₃). Hepsi: her karbon yazılır.',
    type: 'choice',
    options: [
      { value: 'hidden', label: 'Gizli' },
      { value: 'terminal', label: 'Uçlar' },
      { value: 'all', label: 'Hepsi' },
    ],
    default: 'hidden',
    quick: true,
    short: 'Karbonlar',
  },
  {
    key: 'carbonHydrogens',
    group: 'Etiketler',
    label: 'Karbonlarda hidrojen',
    help: 'Yazılan karbonlarda hidrojenleri gösterir (CH₂) ya da gizler (C). OH, NH₂ gibi heteroatomlar her zaman hidrojenleriyle yazılır; gizlemek onları radikal gibi gösterirdi.',
    type: 'choice',
    options: [
      { value: 'show', label: 'Göster' },
      { value: 'hide', label: 'Gizle' },
    ],
    default: 'show',
  },
] as const satisfies readonly SettingDef[];

// --- Semadan turetilen tipler ---

type ValueOf<D> = D extends { type: 'boolean' }
  ? boolean
  : D extends { type: 'number' }
    ? number
    : D extends { type: 'choice'; options: readonly { value: infer V }[] }
      ? V
      : never;

/** Tum ayarlar: anahtarlar ve deger tipleri SETTINGS'ten gelir. */
export type Settings = {
  [D in (typeof SETTINGS)[number] as D['key']]: ValueOf<D>;
};
export type SettingKey = keyof Settings;

// --- Dogrulama ---

/** Disaridan gelen tek bir degeri dogrular; gecersizse undefined. */
export function validate(def: SettingDef, value: unknown): unknown {
  switch (def.type) {
    case 'boolean':
      return typeof value === 'boolean' ? value : undefined;
    case 'choice':
      return def.options.some((o) => o.value === value) ? value : undefined;
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
        ? Math.min(def.max, Math.max(def.min, value))
        : undefined;
  }
}

/** Semanin varsayilan degerleri. */
export function defaultsOf(schema: readonly SettingDef[]): Record<string, unknown> {
  return Object.fromEntries(schema.map((d) => [d.key, d.default]));
}

/**
 * Kayitli veriyi semaya gore okur: gecersiz ya da eksik alan varsayilana
 * duser, taninmayan alan atilir.
 */
export function parseWith(schema: readonly SettingDef[], data: unknown): Record<string, unknown> {
  const raw = (typeof data === 'object' && data !== null ? data : {}) as Record<string, unknown>;
  return Object.fromEntries(
    schema.map((def) => [def.key, validate(def, raw[def.key]) ?? def.default]),
  );
}

export const DEFAULT_SETTINGS = defaultsOf(SETTINGS) as Settings;

/**
 * Asil semayla okur ve eski bicimleri tasir.
 *
 * Gecis: bu sistemden once "Karbonlari goster" acik/kapali bir tercihti
 * (showCarbons: true). Acik olanlar carbonLabels: 'all' olarak okunur ki
 * kullanicinin kayitli ayari kaybolmasin.
 */
export function parseSettings(data: unknown): Settings {
  const raw = (typeof data === 'object' && data !== null ? data : {}) as Record<string, unknown>;
  const migrated =
    raw.carbonLabels === undefined && raw.showCarbons === true
      ? { ...raw, carbonLabels: 'all' }
      : raw;
  return parseWith(SETTINGS, migrated) as Settings;
}

/**
 * Tek ayari DOGRULAYARAK degistirir; bilinmeyen anahtar ya da gecersiz deger
 * yok sayilir. Arayuz (pencere, hizli dugmeler) ayari duz anahtar-deger olarak
 * gonderir; tip guvenligi burada, semaya gore saglanir.
 */
export function applySetting(settings: Settings, key: string, value: unknown): Settings {
  const def = (SETTINGS as readonly SettingDef[]).find((d) => d.key === key);
  if (!def) return settings;
  const valid = validate(def, value);
  return valid === undefined ? settings : ({ ...settings, [key]: valid } as Settings);
}

// --- Saklama ---

/** Eski tercihlerle ayni anahtar: gecis, kayitli ayarlari yerinde okur. */
const KEY = 'kimyasalcizim:tercihler:v1';

export function loadSettings(): Settings {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? parseSettings(JSON.parse(raw)) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* gizli sekme ya da kapali depolama: ayar yalniz bu oturumda gecerli */
  }
}

/** Pencere ve hizli dugmeler icin: semayi gruplarina ayirir, sirayi korur. */
export function groupsOf(schema: readonly SettingDef[]): [string, SettingDef[]][] {
  const groups = new Map<string, SettingDef[]>();
  for (const def of schema) groups.set(def.group, [...(groups.get(def.group) ?? []), def]);
  return [...groups];
}

/** Secim ayarinda siradaki secenek (hizli dugme tiklandikca doner). */
export function nextChoice(def: ChoiceDef, current: string): string {
  const i = def.options.findIndex((o) => o.value === current);
  return def.options[(i + 1) % def.options.length].value;
}
