import { emptyMolecule } from '../model/molecule';
import type { Atom, Bond, Molecule } from '../model/types';

/**
 * Cizimi tarayicida saklar — sekme kapansa da is kaybolmasin.
 *
 * Bicim degisirse anahtardaki surum numarasi artirilir; eski kayitlar
 * o zaman sessizce yok sayilir (bozuk veriyle acilmaktansa bos baslamak
 * yeglenir).
 */
const STORAGE_KEY = 'kimyasalcizim:molekul:v1';

/** localStorage gizli sekmede/kapali depolamada patlayabilir; hep sarmalanir. */
function withStorage<T>(fn: (storage: Storage) => T): T | null {
  try {
    return fn(window.localStorage);
  } catch {
    return null;
  }
}

export function saveMolecule(molecule: Molecule): void {
  withStorage((storage) => {
    if (molecule.atoms.length === 0) {
      storage.removeItem(STORAGE_KEY);
      return;
    }
    storage.setItem(STORAGE_KEY, JSON.stringify(molecule));
  });
}

export function loadMolecule(): Molecule | null {
  const raw = withStorage((storage) => storage.getItem(STORAGE_KEY));
  if (!raw) return null;

  try {
    return parseMolecule(JSON.parse(raw));
  } catch {
    // Bozuk kayit: temizle ve bos basla.
    withStorage((storage) => storage.removeItem(STORAGE_KEY));
    return null;
  }
}

export function clearSavedMolecule(): void {
  withStorage((storage) => storage.removeItem(STORAGE_KEY));
}

/**
 * Disaridan gelen JSON'u dogrular.
 *
 * Kayit baska bir surumden veya elle kurcalanmis olabilir; guvenmeden
 * okuyup beklenmeyen her seyi eliyoruz. Kopuk baglar (var olmayan atoma
 * isaret eden) atilir, cunku cizici onlarda coker.
 */
function parseMolecule(data: unknown): Molecule {
  if (!isRecord(data) || !Array.isArray(data.atoms) || !Array.isArray(data.bonds)) {
    throw new Error('Beklenmeyen kayıt biçimi');
  }

  const atoms: Atom[] = [];
  for (const raw of data.atoms) {
    if (!isRecord(raw)) continue;
    const { id, element, x, y } = raw;
    if (typeof id !== 'string' || typeof element !== 'string') continue;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    atoms.push({
      id,
      element,
      x: x as number,
      y: y as number,
      charge: Number.isFinite(raw.charge) ? (raw.charge as number) : 0,
      ...(Number.isFinite(raw.isotope) ? { isotope: raw.isotope as number } : {}),
      ...(Number.isFinite(raw.explicitH) ? { explicitH: raw.explicitH as number } : {}),
    });
  }

  const known = new Set(atoms.map((a) => a.id));
  const bonds: Bond[] = [];
  for (const raw of data.bonds) {
    if (!isRecord(raw)) continue;
    const { id, a1, a2, order, stereo } = raw;
    if (typeof id !== 'string' || typeof a1 !== 'string' || typeof a2 !== 'string') continue;
    if (!known.has(a1) || !known.has(a2) || a1 === a2) continue;

    bonds.push({
      id,
      a1,
      a2,
      order: order === 2 || order === 3 ? order : 1,
      stereo: stereo === 'wedge' || stereo === 'hash' ? stereo : 'none',
    });
  }

  return atoms.length > 0 ? { atoms, bonds } : emptyMolecule();
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
