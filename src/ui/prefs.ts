import type { ThemeChoice } from '../render/theme';

/**
 * Gorunum tercihleri: tema ve aromatik halka gosterimi.
 * Cizimden ayri bir anahtarda tutulur; biri bozulursa digeri etkilenmesin.
 */
export type Prefs = {
  theme: ThemeChoice;
  /** Aromatik halkalar bir atlamali ikili bag yerine icte daireyle cizilsin mi */
  aromaticCircles: boolean;
};

export const DEFAULT_PREFS: Prefs = { theme: 'auto', aromaticCircles: false };

const KEY = 'kimyasalcizim:tercihler:v1';

export function loadPrefs(): Prefs {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    return parsePrefs(JSON.parse(raw));
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: Prefs): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* gizli sekme ya da kapali depolama: tercih yalniz bu oturumda gecerli */
  }
}

/** Disaridan gelen degeri dogrular; taninmayan alanlar varsayilana duser. */
export function parsePrefs(data: unknown): Prefs {
  const d = (typeof data === 'object' && data !== null ? data : {}) as Record<string, unknown>;
  return {
    theme: d.theme === 'light' || d.theme === 'dark' || d.theme === 'auto' ? d.theme : 'auto',
    aromaticCircles: d.aromaticCircles === true,
  };
}
