import { beforeAll, describe, expect, it } from 'vitest';
import type { RDKitLoader, RDKitModule } from '@rdkit/rdkit';
import { functionalGroupsOfSmiles } from './RdkitService';

/**
 * Fonksiyonel grup desenlerinin GERCEK RDKit ile testi.
 *
 * RDKit.js Node'da da calisiyor; bu sayede SMARTS desenleri tarayiciya
 * gerek kalmadan dogrulanabiliyor. Asil risk ortusmeler: esterin C=O'su
 * keton, asidin OH'si alkol, amidin azotu amin olarak sayilmamali.
 */

let rdkit: RDKitModule;

beforeAll(async () => {
  // Paketin varsayilan disa aktarimi yukleyici fonksiyondur; tip tanimi
  // bunu bildirmedigi icin donusum gerekiyor.
  const mod = (await import('@rdkit/rdkit')) as unknown as { default: RDKitLoader };
  rdkit = await mod.default();
}, 30_000);

/** Bulunan grup kimlikleri, alfabetik. */
function groups(smiles: string): string[] {
  const found = functionalGroupsOfSmiles(rdkit, smiles);
  if (!found) throw new Error(`SMILES okunamadı: ${smiles}`);
  return found.map((g) => g.id).sort();
}

/** Bir grubun kac kez eslestigi. */
function count(smiles: string, id: string): number {
  return functionalGroupsOfSmiles(rdkit, smiles)?.find((g) => g.id === id)?.matches.length ?? 0;
}

describe('temel gruplar', () => {
  it.each([
    ['CCO', ['alcohol']],
    ['CC(C)=O', ['ketone']],
    ['CC=O', ['aldehyde']],
    ['C=O', ['aldehyde']],
    ['CCOCC', ['ether']],
    ['CCN', ['amine']],
    ['CC#N', ['nitrile']],
    ['CCS', ['thiol']],
    ['C=C', ['alkene']],
    ['C#C', ['alkyne']],
    ['CC(=O)[O-]', ['carboxylate']],
  ])('%s → %j', (smiles, beklenen) => {
    expect(groups(smiles)).toEqual(beklenen);
  });
});

describe('örtüşmeler — bir atom iki kez sayılmamalı', () => {
  it('asitin OH’si alkol, C=O’su keton sayılmaz', () => {
    expect(groups('CC(=O)O')).toEqual(['carboxylic-acid']);
  });

  it('formik asit aldehit sayılmaz', () => {
    expect(groups('OC=O')).toEqual(['carboxylic-acid']);
  });

  it('esterin C=O’su keton, O’su eter sayılmaz', () => {
    expect(groups('CC(=O)OC')).toEqual(['ester']);
  });

  it('amidin azotu amin sayılmaz', () => {
    expect(groups('CC(=O)NC')).toEqual(['amide']);
  });

  it('nitro azotu amin sayılmaz', () => {
    expect(groups('C[N+](=O)[O-]')).toEqual(['nitro']);
  });

  it('nitrilin üçlü bağı alkin sayılmaz', () => {
    expect(groups('CC#N')).not.toContain('alkyne');
  });

  it('benzen halkası alken sayılmaz', () => {
    expect(groups('c1ccccc1')).toEqual(['aromatic-ring']);
  });

  it('sülfonik asidin OH’si alkol sayılmaz', () => {
    expect(groups('CS(=O)(=O)O')).toEqual(['sulfonic-acid']);
  });

  it('fenolün OH’si alkol sayılmaz', () => {
    expect(groups('Oc1ccccc1')).toEqual(['aromatic-ring', 'phenol']);
  });
});

describe('galerideki moleküller', () => {
  it('aspirin: ester + karboksilik asit + aromatik halka', () => {
    expect(groups('CC(=O)Oc1ccccc1C(=O)O')).toEqual(['aromatic-ring', 'carboxylic-acid', 'ester']);
  });

  it('parasetamol: amid + fenol + aromatik halka', () => {
    expect(groups('CC(=O)Nc1ccc(O)cc1')).toEqual(['amide', 'aromatic-ring', 'phenol']);
  });

  it('vanilin: aldehit + eter + fenol + aromatik halka', () => {
    expect(groups('COc1cc(C=O)ccc1O')).toEqual(['aldehyde', 'aromatic-ring', 'ether', 'phenol']);
  });

  it('kafein: halkadaki C=O’lar da amid olarak bulunur', () => {
    // RDKit bu karbonilleri aromatik sayar; desen [CX3] olsaydı hiç görünmezdi.
    expect(groups('Cn1cnc2c1c(=O)n(C)c(=O)n2C')).toContain('amide');
    expect(groups('Cn1cnc2c1c(=O)n(C)c(=O)n2C')).toContain('aromatic-ring');
  });

  it('kapsaisin: amid + alken + eter + fenol + aromatik', () => {
    expect(groups('COc1cc(CNC(=O)CCCC/C=C/C(C)C)ccc1O')).toEqual([
      'alkene',
      'amide',
      'aromatic-ring',
      'ether',
      'phenol',
    ]);
  });

  it('anilin: aromatik halkaya bağlı azot amindir', () => {
    expect(groups('Nc1ccccc1')).toEqual(['amine', 'aromatic-ring']);
  });
});

describe('sayım', () => {
  it('naftalinde iki aromatik halka', () => {
    expect(count('c1ccc2ccccc2c1', 'aromatic-ring')).toBe(2);
  });

  it('kloroformda üç C–Cl', () => {
    expect(count('ClC(Cl)Cl', 'halide')).toBe(3);
  });

  it('sitrik asitte üç karboksil ve bir alkol', () => {
    expect(count('OC(=O)CC(O)(CC(=O)O)C(=O)O', 'carboxylic-acid')).toBe(3);
    expect(count('OC(=O)CC(O)(CC(=O)O)C(=O)O', 'alcohol')).toBe(1);
  });

  it('glikozda beş hidroksil (dördü alkol, biri yarı-asetal dahil) ve bir eter', () => {
    const glikoz = 'OC[C@H]1OC(O)[C@H](O)[C@@H](O)[C@@H]1O';
    expect(count(glikoz, 'alcohol')).toBe(5);
    expect(count(glikoz, 'ether')).toBe(1);
  });
});
