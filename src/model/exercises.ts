/**
 * Alistirma modu: "su molekulu cizin" gorevleri ve cevap degerlendirmesi.
 *
 * Degerlendirme InChIKey ile yapilir. Anahtarin yapisi kademeli geri bildirime
 * izin veriyor:
 *
 *   BSYNRYMUTXBXSQ - UHFFFAOYSA - N
 *   └── iskelet ─┘   └ stereo ┘   └ protonlanma
 *
 * Boylece yalniz "yanlis" demek yerine nedenini soyleyebiliyoruz: stereo mu
 * farkli, yuk mu, yoksa ayni formulle farkli baglanmis bir izomer mi.
 */

export type Level = 'kolay' | 'orta' | 'zor';

export type Exercise = {
  id: string;
  name: string;
  level: Level;
  /** Hedef yapi. Anahtar calisma aninda RDKit'le uretilir; elle yazilmaz. */
  smiles: string;
  hint: string;
};

export const LEVEL_LABELS: Record<Level, string> = {
  kolay: 'Kolay',
  orta: 'Orta',
  zor: 'Zor',
};

export const EXERCISES: readonly Exercise[] = [
  { id: 'metan', name: 'Metan', level: 'kolay', smiles: 'C', hint: 'Tek karbon; hidrojenler otomatik eklenir.' },
  { id: 'etan', name: 'Etan', level: 'kolay', smiles: 'CC', hint: 'İki karbon, tekli bağ.' },
  { id: 'eten', name: 'Eten', level: 'kolay', smiles: 'C=C', hint: 'İki karbon arasında ikili bağ.' },
  { id: 'etin', name: 'Etin (asetilen)', level: 'kolay', smiles: 'C#C', hint: 'İki karbon arasında üçlü bağ.' },
  { id: 'etanol', name: 'Etanol', level: 'kolay', smiles: 'CCO', hint: 'İki karbonlu zincirin ucunda –OH.' },
  {
    id: 'dimetil-eter',
    name: 'Dimetil eter',
    level: 'kolay',
    smiles: 'COC',
    hint: 'Etanolle aynı formül, ama oksijen iki karbonun arasında.',
  },
  { id: 'asetik-asit', name: 'Asetik asit', level: 'orta', smiles: 'CC(=O)O', hint: 'Metil grubuna bağlı bir karboksil (–COOH).' },
  { id: 'aseton', name: 'Aseton', level: 'orta', smiles: 'CC(C)=O', hint: 'Ortadaki karbon ikili bağla oksijene bağlı, iki yanında metil.' },
  { id: 'asetaldehit', name: 'Asetaldehit', level: 'orta', smiles: 'CC=O', hint: 'Zincirin ucundaki karbon ikili bağla oksijene bağlı.' },
  { id: 'propan-2-ol', name: 'Propan-2-ol', level: 'orta', smiles: 'CC(C)O', hint: 'Üç karbonlu zincir, –OH ortadaki karbonda.' },
  { id: 'benzen', name: 'Benzen', level: 'orta', smiles: 'c1ccccc1', hint: 'Altı karbonlu halka, bir atlamalı ikili bağlar.' },
  { id: 'fenol', name: 'Fenol', level: 'orta', smiles: 'Oc1ccccc1', hint: 'Benzen halkasına bağlı –OH.' },
  { id: 'toluen', name: 'Toluen', level: 'orta', smiles: 'Cc1ccccc1', hint: 'Benzen halkasına bağlı metil.' },
  { id: 'anilin', name: 'Anilin', level: 'orta', smiles: 'Nc1ccccc1', hint: 'Benzen halkasına bağlı –NH₂.' },
  {
    id: 'aspirin',
    name: 'Aspirin',
    level: 'zor',
    smiles: 'CC(=O)Oc1ccccc1C(=O)O',
    hint: 'Benzen halkasında yan yana iki grup: bir ester (–O–CO–CH₃) ve bir karboksil.',
  },
  {
    id: 'parasetamol',
    name: 'Parasetamol',
    level: 'zor',
    smiles: 'CC(=O)Nc1ccc(O)cc1',
    hint: 'Halkanın karşılıklı iki köşesinde: –OH ve –NH–CO–CH₃.',
  },
  {
    id: 'l-alanin',
    name: 'L-Alanin',
    level: 'zor',
    smiles: 'C[C@H](N)C(=O)O',
    hint: 'Stereo merkez (S) olmalı: metil grubunu kama bağla çizin.',
  },
  {
    id: 'kafein',
    name: 'Kafein',
    level: 'zor',
    smiles: 'Cn1cnc2c1c(=O)n(C)c(=O)n2C',
    hint: 'Kaynaşık altı ve beş üyeli iki halka, üç N-metil, iki C=O.',
  },
];

export const findExercise = (id: string): Exercise | undefined =>
  EXERCISES.find((e) => e.id === id);

/** Siradaki gorev; sonuncudan sonra basa doner. */
export function nextExercise(id: string): Exercise {
  const index = EXERCISES.findIndex((e) => e.id === id);
  return EXERCISES[(index + 1) % EXERCISES.length];
}

// --- degerlendirme ---

/** Bir yapinin kimligi: InChI ve InChIKey. */
export type Identity = { inchi: string; inchiKey: string };

export type Verdict =
  | { kind: 'dogru' }
  /** Iskelet ayni, stereo (ya da izotop) bilgisi farkli */
  | { kind: 'stereo' }
  /** Iskelet ayni, yuk/protonlanma farkli (asetik asit ↔ asetat) */
  | { kind: 'protonlanma' }
  /** Formul ayni, baglanma farkli */
  | { kind: 'izomer'; formula: string }
  | { kind: 'yanlis'; drawnFormula: string | null }
  /** Cizilen yapi RDKit'e gore gecersiz */
  | { kind: 'gecersiz' }
  | { kind: 'bos' };

/** InChI'nin ikinci katmani kapali formuldur: "InChI=1S/C2H6O/c1-2-3/…" → "C2H6O" */
export function formulaFromInchi(inchi: string): string | null {
  return inchi.split('/')[1] || null;
}

/**
 * Cizilen yapiyi hedefle karsilastirir.
 *
 * Siralama onemli: once en ince fark (stereo, protonlanma), sonra izomer,
 * en son "tamamen farkli". Boylece ogrenci en yakin oldugu hataya yonlenir.
 */
export function evaluate(drawn: Identity | null, target: Identity, empty: boolean): Verdict {
  if (empty) return { kind: 'bos' };
  if (!drawn) return { kind: 'gecersiz' };

  if (drawn.inchiKey === target.inchiKey) return { kind: 'dogru' };

  const skeleton = (key: string) => key.slice(0, 14);
  const stereoBlock = (key: string) => key.slice(15, 25);
  const protonation = (key: string) => key.slice(26);

  if (skeleton(drawn.inchiKey) === skeleton(target.inchiKey)) {
    if (stereoBlock(drawn.inchiKey) !== stereoBlock(target.inchiKey)) return { kind: 'stereo' };
    if (protonation(drawn.inchiKey) !== protonation(target.inchiKey)) return { kind: 'protonlanma' };
  }

  const drawnFormula = formulaFromInchi(drawn.inchi);
  if (drawnFormula && drawnFormula === formulaFromInchi(target.inchi)) {
    return { kind: 'izomer', formula: drawnFormula };
  }
  return { kind: 'yanlis', drawnFormula };
}
