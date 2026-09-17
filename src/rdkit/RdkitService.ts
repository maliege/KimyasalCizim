import type { JSMol, RDKitModule } from '@rdkit/rdkit';

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

function safe<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}
