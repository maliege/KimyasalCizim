import { describe, expect, it } from 'vitest';
import { EXERCISES, LEVEL_LABELS, evaluate, findExercise, nextExercise } from './exercises';

const ETANOL = {
  inchi: 'InChI=1S/C2H6O/c1-2-3/h3H,2H2,1H3',
  inchiKey: 'LFQSCWFLJHTTHZ-UHFFFAOYSA-N',
};

describe('evaluate — RDKit’siz durumlar', () => {
  it('boş tuvalde "bos" döner', () => {
    expect(evaluate(null, ETANOL, true)).toEqual({ kind: 'bos' });
  });

  it('geçersiz yapıda (kimlik yok) "gecersiz" döner', () => {
    expect(evaluate(null, ETANOL, false)).toEqual({ kind: 'gecersiz' });
  });

  it('aynı anahtar doğrudur', () => {
    expect(evaluate(ETANOL, ETANOL, false)).toEqual({ kind: 'dogru' });
  });
});

describe('görev verisi', () => {
  it('kimlikler benzersiz', () => {
    const ids = EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('kimlikler bağlantıda kodlanmadan kullanılabilir', () => {
    // #gorev=... içinde yüzde kodlaması gerekmesin: küçük harf, rakam, tire.
    for (const e of EXERCISES) expect(e.id, e.id).toMatch(/^[a-z0-9-]+$/);
  });

  it('her seviyede görev var ve sıralı ilerliyor', () => {
    const levels = Object.keys(LEVEL_LABELS);
    for (const level of levels) {
      expect(EXERCISES.some((e) => e.level === level), level).toBe(true);
    }
    // Kolaydan zora: seviye sırası hiç geri gitmemeli.
    const order = EXERCISES.map((e) => levels.indexOf(e.level));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('her görevin ipucu var', () => {
    for (const e of EXERCISES) expect(e.hint.trim(), e.id).not.toBe('');
  });
});

describe('nextExercise', () => {
  it('sıradakine geçer', () => {
    expect(nextExercise(EXERCISES[0].id)).toBe(EXERCISES[1]);
  });

  it('sonuncudan sonra başa döner', () => {
    expect(nextExercise(EXERCISES.at(-1)!.id)).toBe(EXERCISES[0]);
  });

  it('bilinmeyen kimlikte ilk göreve düşer', () => {
    expect(nextExercise('yok-boyle')).toBe(EXERCISES[0]);
  });
});

describe('findExercise', () => {
  it('kimlikle bulur, bilinmeyende undefined', () => {
    expect(findExercise('etanol')?.name).toBe('Etanol');
    expect(findExercise('yok-boyle')).toBeUndefined();
  });
});
