import type { JSMol, RDKitModule } from '@rdkit/rdkit';
import { FUNCTIONAL_GROUPS } from '../model/functionalGroups';

/**
 * RDKit.js (WASM) koprusu.
 *
 * Onemli: JSMol nesneleri WASM heap'inde yasar ve cop toplayici tarafindan
 * temizlenmez. Bu yuzden dosya disina cikan tek erisim yolu `withMol` olmali;
 * ciplak get_mol cagrisi sizinti demektir (canli SMILES her cizim
 * degisikliginde calisiyor, sizinti hizla birikir).
 */

let modulePromise: Promise<RDKitModule> | null = null;

/** WASM'i tembel baslatir. Birden fazla cagri ayni promise'i paylasir. */
export function initRdkit(): Promise<RDKitModule> {
  if (!modulePromise) {
    modulePromise = window
      .initRDKitModule({ locateFile: () => '/RDKit_minimal.wasm' })
      .then((rdkit) => {
        // Halkali yapilarda belirgin sekilde daha temiz duzen uretir.
        rdkit.prefer_coordgen(true);
        return rdkit;
      })
      .catch((err) => {
        modulePromise = null; // sonraki denemeye izin ver
        throw err;
      });
  }
  return modulePromise;
}

/**
 * Bir molekul uzerinde islem yapip belleği garanti serbest birakir.
 *
 * @param input SMILES, SMARTS veya molblock
 * @param fn molekul uzerinde calisacak fonksiyon
 * @param lenient true ise sanitize kapatilarak yarim/gecersiz yapilar da okunur
 * @returns fn'in sonucu, molekul ayristirilamazsa null
 */
export function withMol<T>(
  rdkit: RDKitModule,
  input: string,
  fn: (mol: JSMol) => T,
  lenient = false,
): T | null {
  let mol: JSMol | null = null;
  try {
    mol = rdkit.get_mol(input);
    if (!mol && lenient) {
      mol = rdkit.get_mol(input, JSON.stringify({ sanitize: false }));
    }
    if (!mol) return null;
    return fn(mol);
  } catch {
    return null;
  } finally {
    mol?.delete();
  }
}

export type Descriptors = {
  amw: number;
  exactmw: number;
  CrippenClogP: number;
  tpsa: number;
  NumRings: number;
  NumHeavyAtoms: number;
  NumRotatableBonds: number;
  lipinskiHBA: number;
  lipinskiHBD: number;
};

/**
 * CIP stereo etiketleri. Indeksler molblock'taki atom sirasina gore —
 * yani bizim `molecule.atoms` dizisiyle ayni sirada.
 */
export type StereoTags = {
  /** [atomIndeksi, "(R)" | "(S)" | "(?)"] */
  atoms: [number, string][];
  /** [atomIndeksi1, atomIndeksi2, "(E)" | "(Z)"] */
  bonds: [number, number, string][];
};

export type MoleculeInfo = {
  /** Yapinin RDKit tarafindan gecerli bulunup bulunmadigi */
  valid: boolean;
  smiles: string | null;
  inchi: string | null;
  inchiKey: string | null;
  descriptors: Partial<Descriptors> | null;
  stereo: StereoTags | null;
  /** Bulunan fonksiyonel gruplar; atom indeksleri molblock sirasinda */
  groups: FoundGroup[] | null;
};

export type FoundGroup = {
  id: string;
  /** Her eslesme bir atom indeksi listesi */
  matches: number[][];
};

/** Bir molblock icin tum tanimlayici ve ozellikleri tek geciste hesaplar. */
export function analyze(rdkit: RDKitModule, molblock: string): MoleculeInfo {
  const result = withMol(rdkit, molblock, (mol) => {
    const inchi = safe(() => mol.get_inchi());
    return {
      valid: true,
      smiles: safe(() => mol.get_smiles()),
      inchi,
      inchiKey: inchi ? safe(() => rdkit.get_inchikey_for_inchi(inchi)) : null,
      descriptors: safe(() => JSON.parse(mol.get_descriptors()) as Descriptors),
      stereo: safe(() => parseStereoTags(mol.get_stereo_tags())),
      groups: safe(() => findFunctionalGroups(rdkit, mol)),
    } satisfies MoleculeInfo;
  });

  return (
    result ?? {
      valid: false,
      smiles: null,
      inchi: null,
      inchiKey: null,
      descriptors: null,
      stereo: null,
      groups: null,
    }
  );
}

/** RDKit'in `{"CIP_atoms":[[1,"(S)"]],"CIP_bonds":[[1,2,"(E)"]]}` ciktisini cozer. */
function parseStereoTags(raw: string): StereoTags {
  const parsed = JSON.parse(raw) as {
    CIP_atoms?: [number, string][];
    CIP_bonds?: [number, number, string][];
  };
  return { atoms: parsed.CIP_atoms ?? [], bonds: parsed.CIP_bonds ?? [] };
}

/**
 * SMILES'ten 2B koordinatli bir molblock uretir.
 * @returns V2000 molblock, SMILES cozulemezse null
 */
export function molblockFromSmiles(rdkit: RDKitModule, smiles: string): string | null {
  return withMol(rdkit, smiles.trim(), (mol) => mol.get_new_coords(true));
}

/**
 * RDKit'in kendi cizicisiyle SVG uretir.
 *
 * Tuval icin kendi cizicimizi kullaniyoruz; bu yalniz galerideki kucuk
 * resimler icin — tek cagrida kendi kendine yeten bir SVG verdigi icin
 * onizleme uretmenin en ucuz yolu.
 */
export function renderSvg(
  rdkit: RDKitModule,
  input: string,
  width = 160,
  height = 120,
): string | null {
  return withMol(rdkit, input, (mol) => mol.get_svg(width, height));
}

/**
 * Koordinatlari yeniden uretir (clean-up).
 * @returns yeni koordinatli V2000 molblock, basarisizsa null
 */
export function cleanupCoords(rdkit: RDKitModule, molblock: string): string | null {
  return withMol(
    rdkit,
    molblock,
    (mol) => {
      const fresh = mol.get_new_coords(true);
      // normalize/straighten yeni koordinatlar uzerinde calissin diye
      // molblock'u tekrar okuyoruz.
      return (
        withMol(rdkit, fresh, (m2) => {
          m2.normalize_depiction();
          m2.straighten_depiction();
          return m2.get_molblock();
        }) ?? fresh
      );
    },
    true,
  );
}

/**
 * Sorgu molekulleri (SMARTS) onbellegi.
 *
 * Desenler sabit, bu yuzden her analizde ~20 WASM nesnesi yaratip silmek
 * yerine her RDKit ornegi icin bir kez olusturup tutuyoruz. Sayi sinirli
 * (desen sayisi kadar) oldugu icin bu bir sizinti degil. WeakMap: testler
 * ayri bir RDKit ornegi kullanirsa onbellekler karismasin.
 */
const queryCache = new WeakMap<RDKitModule, Map<string, JSMol | null>>();

function queryMol(rdkit: RDKitModule, smarts: string): JSMol | null {
  let cache = queryCache.get(rdkit);
  if (!cache) {
    cache = new Map();
    queryCache.set(rdkit, cache);
  }
  if (!cache.has(smarts)) cache.set(smarts, rdkit.get_qmol(smarts));
  return cache.get(smarts) ?? null;
}

/** Molekuldeki fonksiyonel gruplari bulur; hic eslesmeyen gruplar listelenmez. */
export function findFunctionalGroups(rdkit: RDKitModule, mol: JSMol): FoundGroup[] {
  const found: FoundGroup[] = [];

  for (const group of FUNCTIONAL_GROUPS) {
    const seen = new Set<string>();
    const matches: number[][] = [];

    for (const smarts of group.smarts) {
      const query = queryMol(rdkit, smarts);
      if (!query) continue;
      for (const atoms of parseMatches(mol.get_substruct_matches(query))) {
        // Ayni atom kumesi farkli desenden ya da siradan tekrar gelebilir.
        const key = [...atoms].sort((a, b) => a - b).join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        matches.push(atoms);
      }
    }
    if (matches.length > 0) found.push({ id: group.id, matches });
  }
  return found;
}

/**
 * get_substruct_matches ciktisini cozer.
 * Dikkat: eslesme yokken bos dizi degil "{}" doner.
 */
function parseMatches(raw: string): number[][] {
  const parsed = JSON.parse(raw) as { atoms: number[] }[] | Record<string, never>;
  return Array.isArray(parsed) ? parsed.map((m) => m.atoms) : [];
}

/** SMILES icin gruplari bulur (testler ve tek seferlik kullanim icin). */
export function functionalGroupsOfSmiles(rdkit: RDKitModule, smiles: string): FoundGroup[] | null {
  return withMol(rdkit, smiles, (mol) => findFunctionalGroups(rdkit, mol));
}

function safe<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}
