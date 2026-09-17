import { describe, expect, it } from 'vitest';
import { CATEGORY_LABELS, EXAMPLES, examplesByCategory } from './examples';

// SMILES'in kimyasal dogrulugu RDKit gerektirdigi icin burada test edilemez;
// tarayicida molekul agirliklariyla karsilastirilarak dogrulandi. Buradaki
// testler veri butunlugunu korur.

describe('örnek galerisi verisi', () => {
  it('kimlikler benzersizdir', () => {
    const ids = EXAMPLES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('adlar benzersizdir', () => {
    const names = EXAMPLES.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('her örneğin SMILES, ad ve notu doludur', () => {
    for (const example of EXAMPLES) {
      expect(example.smiles.trim(), example.id).not.toBe('');
      expect(example.name.trim(), example.id).not.toBe('');
      expect(example.note.trim(), example.id).not.toBe('');
    }
  });

  it('SMILES dizgelerinde boşluk yoktur', () => {
    // Bosluk SMILES'te ad alani baslatir; kopyala-yapistir kazasini yakalar.
    for (const example of EXAMPLES) {
      expect(example.smiles, example.id).not.toMatch(/\s/);
    }
  });

  it('her kategoride en az bir örnek vardır', () => {
    for (const [category, examples] of examplesByCategory()) {
      expect(examples.length, category).toBeGreaterThan(0);
    }
  });

  it('gruplama hiçbir örneği kaybetmez veya tekrarlamaz', () => {
    const gruplanan = examplesByCategory().flatMap(([, examples]) => examples);
    expect(gruplanan).toHaveLength(EXAMPLES.length);
    expect(new Set(gruplanan.map((e) => e.id)).size).toBe(EXAMPLES.length);
  });

  it('her örneğin kategorisi tanımlıdır', () => {
    for (const example of EXAMPLES) {
      expect(CATEGORY_LABELS[example.category], example.id).toBeDefined();
    }
  });
});
