import { describe, expect, it, vi } from 'vitest';
import { PubChemError, compoundUrl, lookupPubChem } from './pubchem';

/** Sahte fetch: verilen durum ve gövdeyi döner, istenen adresi kaydeder. */
function fake(status: number, body: unknown) {
  const fn = vi.fn(async (_url: string | URL | Request) =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }),
  );
  return fn as unknown as typeof fetch & typeof fn;
}

const ASPIRIN = {
  PropertyTable: {
    Properties: [
      {
        CID: 2244,
        MolecularFormula: 'C9H8O4',
        SMILES: 'CC(=O)OC1=CC=CC=C1C(=O)O',
        IUPACName: '2-acetyloxybenzoic acid',
        Title: 'Aspirin',
      },
    ],
  },
};

describe('lookupPubChem', () => {
  it('bulunan bileşeni döner', async () => {
    const hit = await lookupPubChem('aspirin', { fetch: fake(200, ASPIRIN) });
    expect(hit).toEqual({
      cid: 2244,
      smiles: 'CC(=O)OC1=CC=CC=C1C(=O)O',
      title: 'Aspirin',
      iupacName: '2-acetyloxybenzoic acid',
      formula: 'C9H8O4',
    });
  });

  it('eski IsomericSMILES alanına da düşer', async () => {
    const eski = { PropertyTable: { Properties: [{ CID: 176, IsomericSMILES: 'CC(=O)O' }] } };
    expect((await lookupPubChem('acetic acid', { fetch: fake(200, eski) }))?.smiles).toBe('CC(=O)O');
  });

  it('adı adrese güvenli biçimde kodlar', async () => {
    const f = fake(200, ASPIRIN);
    await lookupPubChem('  acetic acid/2 ', { fetch: f });
    expect(String(f.mock.calls[0][0])).toContain('/name/acetic%20acid%2F2/property/');
  });

  it('bulunamayan adda null döner', async () => {
    const yok = { Fault: { Code: 'PUGREST.NotFound', Message: 'No CID found' } };
    expect(await lookupPubChem('kafein', { fetch: fake(404, yok) })).toBeNull();
  });

  it('sunucu hatasında PubChemError fırlatır', async () => {
    await expect(lookupPubChem('x', { fetch: fake(503, 'meşgul') })).rejects.toBeInstanceOf(PubChemError);
  });

  it('ağ hatasında PubChemError fırlatır', async () => {
    const kopuk = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    await expect(lookupPubChem('x', { fetch: kopuk })).rejects.toThrow('ulaşılamadı');
  });

  it('yapısız yanıtta PubChemError fırlatır', async () => {
    await expect(
      lookupPubChem('x', { fetch: fake(200, { PropertyTable: { Properties: [{ CID: 1 }] } }) }),
    ).rejects.toBeInstanceOf(PubChemError);
  });

  it('iptal edilirse iptali olduğu gibi iletir', async () => {
    const iptal = (async () => {
      throw new DOMException('iptal', 'AbortError');
    }) as unknown as typeof fetch;
    await expect(lookupPubChem('x', { fetch: iptal })).rejects.toMatchObject({ name: 'AbortError' });
  });
});

it('compoundUrl PubChem sayfasını verir', () => {
  expect(compoundUrl(2244)).toBe('https://pubchem.ncbi.nlm.nih.gov/compound/2244');
});
