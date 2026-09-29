import { describe, expect, it } from 'vitest';
import { buildShareUrl, buildTaskUrl, parseShareHash } from './shareLink';

const BASE = 'https://maege.tr/';

/** Uret → coz gidis-donusu. */
const roundTrip = (smiles: string) =>
  parseShareHash(new URL(buildShareUrl(BASE, smiles)).hash).smiles;

describe('paylaşım bağlantısı gidiş-dönüşü', () => {
  it('basit SMILES’i korur', () => {
    expect(roundTrip('CCO')).toBe('CCO');
  });

  it('yük işaretini (+) boşluğa çevirmez', () => {
    // URLSearchParams burada [NH4 ] verirdi.
    expect(roundTrip('[NH4+]')).toBe('[NH4+]');
    expect(roundTrip('CC(=O)[O-]')).toBe('CC(=O)[O-]');
  });

  it('üçlü bağı (#) parça ayırıcısıyla karıştırmaz', () => {
    expect(roundTrip('CC#N')).toBe('CC#N');
  });

  it('stereo ve halka işaretlerini korur', () => {
    const smiles = 'C[C@H](N)C(=O)O';
    expect(roundTrip(smiles)).toBe(smiles);
    expect(roundTrip('F/C=C\\F')).toBe('F/C=C\\F');
    expect(roundTrip('c1ccc2ccccc2c1')).toBe('c1ccc2ccccc2c1');
  });

  it('çok bileşenli yapıyı (.) korur', () => {
    expect(roundTrip('[Na+].[Cl-]')).toBe('[Na+].[Cl-]');
  });

  it('tek bir # parçası üretir', () => {
    const url = buildShareUrl('https://maege.tr/#smiles=eski', 'CCO');
    expect(url).toBe('https://maege.tr/#smiles=CCO');
  });
});

describe('parseShareHash', () => {
  it('başında # olsa da olmasa da çözer', () => {
    expect(parseShareHash('#smiles=CCO')).toEqual({ smiles: 'CCO' });
    expect(parseShareHash('smiles=CCO')).toEqual({ smiles: 'CCO' });
  });

  it('elle yazılmış kodlanmamış bağlantıda da + işaretini korur', () => {
    // Kullanıcı adres çubuğuna doğrudan yazabilir.
    expect(parseShareHash('#smiles=[NH4+]')).toEqual({ smiles: '[NH4+]' });
  });

  it('boş ya da ilgisiz parçaları yok sayar', () => {
    expect(parseShareHash('')).toEqual({});
    expect(parseShareHash('#')).toEqual({});
    expect(parseShareHash('#bolum-2')).toEqual({});
    expect(parseShareHash('#smiles=')).toEqual({});
    expect(parseShareHash('#baska=1')).toEqual({});
  });

  it('bozuk yüzde kodlamasında patlamaz', () => {
    expect(parseShareHash('#smiles=%E0%A4%A')).toEqual({});
  });
});

describe('görev bağlantıları', () => {
  it('#gorev parametresini okur', () => {
    expect(parseShareHash('#gorev=etanol')).toEqual({ task: 'etanol' });
  });

  it('görev bağlantısı üretir ve geri okur', () => {
    const url = buildTaskUrl('https://maege.tr/#smiles=CCO', 'l-alanin');
    expect(url).toBe('https://maege.tr/#gorev=l-alanin');
    expect(parseShareHash(new URL(url).hash)).toEqual({ task: 'l-alanin' });
  });
});
