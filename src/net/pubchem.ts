/**
 * PubChem PUG REST ile isimden yapi.
 *
 * Tarayicidan dogrudan cagriliyor (PubChem CORS'a izin veriyor), sunucu
 * tarafi yok. Sorgulanan ad NCBI'ye (ABD) gider; baska hicbir veri gitmez.
 */

const BASE = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name';

export type PubChemHit = {
  cid: number;
  smiles: string;
  /** PubChem'deki yaygin ad ("Aspirin") */
  title: string | null;
  iupacName: string | null;
  formula: string | null;
};

/** Ag hatasi ya da beklenmeyen yanit (bulunamadi DEGIL — o null doner). */
export class PubChemError extends Error {}

export const compoundUrl = (cid: number): string =>
  `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`;

/**
 * Adi PubChem'de arar.
 * @returns ilk eslesme; ad bulunamazsa null
 * @throws PubChemError ag hatasi, zaman asimi ya da bozuk yanitta
 */
export async function lookupPubChem(
  name: string,
  options: { fetch?: typeof fetch; signal?: AbortSignal } = {},
): Promise<PubChemHit | null> {
  const doFetch = options.fetch ?? fetch;
  // SMILES yeni ad; IsomericSMILES 2025'te kaldirildi ama istenirse sessizce
  // dusuruluyor. Ikisini de istiyoruz ki API geri donerse de calissin.
  const url =
    `${BASE}/${encodeURIComponent(name.trim())}` +
    '/property/SMILES,IsomericSMILES,IUPACName,MolecularFormula,Title/JSON';

  let response: Response;
  try {
    response = await doFetch(url, { signal: options.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new PubChemError('PubChem’e ulaşılamadı.');
  }

  if (response.status === 404) return null;
  if (!response.ok) throw new PubChemError(`PubChem yanıt vermedi (HTTP ${response.status}).`);

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new PubChemError('PubChem yanıtı okunamadı.');
  }

  const first = (data as { PropertyTable?: { Properties?: Record<string, unknown>[] } })
    .PropertyTable?.Properties?.[0];
  const smiles = str(first?.SMILES) ?? str(first?.IsomericSMILES);
  const cid = typeof first?.CID === 'number' ? first.CID : null;
  if (!first || !smiles || cid === null) throw new PubChemError('PubChem yanıtında yapı yok.');

  return {
    cid,
    smiles,
    title: str(first.Title),
    iupacName: str(first.IUPACName),
    formula: str(first.MolecularFormula),
  };
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
