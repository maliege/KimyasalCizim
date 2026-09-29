import { beforeAll, describe, expect, it } from 'vitest';
import type { RDKitLoader, RDKitModule } from '@rdkit/rdkit';
import { identify } from './RdkitService';
import { EXERCISES, evaluate, formulaFromInchi } from '../model/exercises';

/**
 * Alistirma degerlendirmesinin gercek RDKit ile testi. InChIKey bloklarinin
 * (iskelet / stereo / protonlanma) varsaydigimiz gibi davrandigini kanitlar.
 */

let rdkit: RDKitModule;

beforeAll(async () => {
  const mod = (await import('@rdkit/rdkit')) as unknown as { default: RDKitLoader };
  rdkit = await mod.default();
}, 30_000);

const id = (smiles: string) => {
  const result = identify(rdkit, smiles);
  if (!result) throw new Error(`Kimlik üretilemedi: ${smiles}`);
  return result;
};

/** "cizilen" SMILES'i hedefle karsilastir. */
const judge = (drawn: string, target: string) => evaluate(id(drawn), id(target), false);

describe('görev listesi', () => {
  it.each(EXERCISES.map((e) => [e.id, e.smiles]))('%s hedefi RDKit ile okunabiliyor', (_, smiles) => {
    expect(identify(rdkit, smiles)).not.toBeNull();
  });

  it('görevler birbirinden farklı yapılar', () => {
    const keys = EXERCISES.map((e) => id(e.smiles).inchiKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('değerlendirme', () => {
  it('aynı yapı farklı SMILES yazımıyla da doğru sayılır', () => {
    // Öğrencinin çizdiği atom sırası hedefinkiyle aynı olmak zorunda değil.
    expect(judge('OCC', 'CCO')).toEqual({ kind: 'dogru' });
    expect(judge('OC(=O)C', 'CC(=O)O')).toEqual({ kind: 'dogru' });
  });

  it('Kekulé ve aromatik yazım aynı sayılır', () => {
    // Tuvalde benzen hep bir atlamalı ikili bağlarla çizilir.
    expect(judge('C1=CC=CC=C1', 'c1ccccc1')).toEqual({ kind: 'dogru' });
  });

  it('D-alanin, L-alanin hedefinde stereo hatası verir', () => {
    expect(judge('C[C@@H](N)C(=O)O', 'C[C@H](N)C(=O)O')).toEqual({ kind: 'stereo' });
  });

  it('stereosu belirtilmemiş alanin de stereo hatası verir', () => {
    expect(judge('CC(N)C(=O)O', 'C[C@H](N)C(=O)O')).toEqual({ kind: 'stereo' });
  });

  it('asetat, asetik asit hedefinde protonlanma hatası verir', () => {
    expect(judge('CC(=O)[O-]', 'CC(=O)O')).toEqual({ kind: 'protonlanma' });
  });

  it('dimetil eter, etanol hedefinde izomer olarak tanınır', () => {
    expect(judge('COC', 'CCO')).toEqual({ kind: 'izomer', formula: 'C2H6O' });
  });

  it('propan-1-ol, propan-2-ol hedefinde izomerdir', () => {
    expect(judge('CCCO', 'CC(C)O')).toEqual({ kind: 'izomer', formula: 'C3H8O' });
  });

  it('bambaşka yapı yanlış sayılır ve çizilenin formülü verilir', () => {
    expect(judge('C', 'CCO')).toEqual({ kind: 'yanlis', drawnFormula: 'CH4' });
  });
});

describe('formulaFromInchi', () => {
  it('InChI’nin formül katmanını okur', () => {
    expect(formulaFromInchi(id('CCO').inchi)).toBe('C2H6O');
    expect(formulaFromInchi(id('c1ccccc1').inchi)).toBe('C6H6');
  });
});
