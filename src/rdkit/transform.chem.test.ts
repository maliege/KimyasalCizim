import { beforeAll, describe, expect, it } from 'vitest';
import type { RDKitLoader, RDKitModule } from '@rdkit/rdkit';
import { identify, molblockFromSmiles } from './RdkitService';
import { fromMolfile, toMolfile } from '../model/molfile';
import { transformAtoms } from '../model/transform';
import type { Molecule } from '../model/types';

/**
 * Asil iddia: aynalama cizimi degistirir, MOLEKULU degistirmez.
 * Kama/kesikli takasi olmadan ayni islem enantiyomer uretir; bunu da
 * gosteriyoruz ki takasin neden gerekli oldugu belgelensin.
 */

let rdkit: RDKitModule;

beforeAll(async () => {
  const mod = (await import('@rdkit/rdkit')) as unknown as { default: RDKitLoader };
  rdkit = await mod.default();
}, 30_000);

const L_ALANIN = 'C[C@H](N)C(=O)O';

/** SMILES → bizim modelimiz (RDKit koordinatlari ve kama baglariyla). */
const load = (smiles: string): Molecule => fromMolfile(molblockFromSmiles(rdkit, smiles)!);

const keyOf = (mol: Molecule) => identify(rdkit, toMolfile(mol))!.inchiKey;
const cipOf = (mol: Molecule) =>
  JSON.parse(rdkit.get_mol(toMolfile(mol))!.get_stereo_tags()).CIP_atoms.map(
    ([, label]: [number, string]) => label,
  );

describe('stereokimya dönüşümler altında', () => {
  it('başlangıçta L-alanin (S) olarak okunuyor', () => {
    const mol = load(L_ALANIN);
    expect(mol.bonds.some((b) => b.stereo !== 'none')).toBe(true);
    expect(cipOf(mol)).toEqual(['(S)']);
  });

  it.each([
    ['yatay aynalama', { kind: 'flip', axis: 'horizontal' } as const],
    ['dikey aynalama', { kind: 'flip', axis: 'vertical' } as const],
    ['30° döndürme', { kind: 'rotate', degrees: 30 } as const],
    ['180° döndürme', { kind: 'rotate', degrees: 180 } as const],
  ])('%s molekülü değiştirmez', (_, op) => {
    const mol = load(L_ALANIN);
    const after = transformAtoms(mol, [], op);
    expect(keyOf(after)).toBe(keyOf(mol));
    expect(cipOf(after)).toEqual(['(S)']);
  });

  it('kama/kesikli takası olmadan aynalama enantiyomer üretirdi', () => {
    const mol = load(L_ALANIN);
    const flipped = transformAtoms(mol, [], { kind: 'flip', axis: 'horizontal' });
    // Takası elle geri al: koordinatlar aynalı, stereo işaretleri orijinal.
    const naive: Molecule = { ...flipped, bonds: mol.bonds };
    expect(keyOf(naive)).not.toBe(keyOf(mol));
    expect(cipOf(naive)).toEqual(['(R)']);
  });
});
