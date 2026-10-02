import { describe, expect, it } from 'vitest';
import { findLocalName, looksLikeSmiles, normalizeName } from './localNames';

describe('normalizeName', () => {
  it('Türkçe büyük/küçük harf ve aksanları eşitler', () => {
    expect(normalizeName('ASPİRİN')).toBe('aspirin');
    expect(normalizeName('aspırın')).toBe('aspirin');
    expect(normalizeName('  Sülfonik   Asit ')).toBe('sulfonik asit');
    expect(normalizeName('Çinko-oksit')).toBe('cinko oksit');
  });
});

describe('findLocalName', () => {
  it('galerideki Türkçe adları bulur', () => {
    expect(findLocalName('kafein')?.smiles).toBe('Cn1cnc2c1c(=O)n(C)c(=O)n2C');
    expect(findLocalName('GLİKOZ')?.name).toBe('Glikoz');
    expect(findLocalName('c vitamini')?.name).toBe('C vitamini');
  });

  it('parantez içindeki eş adla da bulur', () => {
    expect(findLocalName('asetilen')?.smiles).toBe('C#C');
    expect(findLocalName('etin')?.smiles).toBe('C#C');
  });

  it('bilinmeyen adda null döner', () => {
    expect(findLocalName('morfin')).toBeNull();
    expect(findLocalName('')).toBeNull();
  });
});

describe('looksLikeSmiles', () => {
  it.each(['CCO', 'c1ccccc1', 'CC(=O)[O-]', '[NH4+]', 'C[C@H](N)C(=O)O', 'CC#N', 'O=C=O', '[Na+].[Cl-]'])(
    '%s SMILES sayılır',
    (s) => expect(looksLikeSmiles(s)).toBe(true),
  );

  it.each(['benzen', 'Aspirin', 'kafein', 'acetic acid', 'ethanol', ''])('%s ad sayılır', (s) =>
    expect(looksLikeSmiles(s)).toBe(false),
  );
});
