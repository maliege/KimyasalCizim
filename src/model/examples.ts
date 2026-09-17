/**
 * Ornek molekul galerisi.
 *
 * Yapilar SMILES olarak saklanir; koordinatlari RDKit uretir. Boylece veri
 * molekul basina tek satir kalir ve duzen her zaman derli toplu olur.
 * (Molfile gomseydik hem dosya sisirdi hem de duzeni elle bakmak gerekirdi.)
 */

export type ExampleCategory = 'temel' | 'biyo' | 'ilac' | 'gunluk';

export type Example = {
  id: string;
  name: string;
  category: ExampleCategory;
  smiles: string;
  /** Kisa bilgi — galeride ipucu olarak gosterilir */
  note: string;
};

export const CATEGORY_LABELS: Record<ExampleCategory, string> = {
  temel: 'Temel moleküller',
  biyo: 'Biyomoleküller',
  ilac: 'İlaçlar',
  gunluk: 'Günlük hayat',
};

export const EXAMPLES: readonly Example[] = [
  // --- Temel ---
  { id: 'water', name: 'Su', category: 'temel', smiles: 'O', note: 'H₂O' },
  { id: 'ammonia', name: 'Amonyak', category: 'temel', smiles: 'N', note: 'NH₃' },
  { id: 'methane', name: 'Metan', category: 'temel', smiles: 'C', note: 'En basit alkan' },
  {
    id: 'co2',
    name: 'Karbondioksit',
    category: 'temel',
    smiles: 'O=C=O',
    note: 'İki ikili bağ, doğrusal',
  },
  { id: 'ethanol', name: 'Etanol', category: 'temel', smiles: 'CCO', note: 'İçki alkolü' },
  {
    id: 'acetic',
    name: 'Asetik asit',
    category: 'temel',
    smiles: 'CC(=O)O',
    note: 'Sirkenin ekşi bileşeni',
  },
  {
    id: 'benzene',
    name: 'Benzen',
    category: 'temel',
    smiles: 'c1ccccc1',
    note: 'Aromatikliğin temel örneği',
  },
  { id: 'urea', name: 'Üre', category: 'temel', smiles: 'NC(N)=O', note: 'İlk sentezlenen organik bileşik' },

  // --- Biyomolekuller ---
  { id: 'glycine', name: 'Glisin', category: 'biyo', smiles: 'NCC(=O)O', note: 'En basit amino asit' },
  {
    id: 'alanine',
    name: 'L-Alanin',
    category: 'biyo',
    smiles: 'C[C@H](N)C(=O)O',
    note: 'Stereo merkez: (S)',
  },
  {
    id: 'glucose',
    name: 'Glikoz',
    category: 'biyo',
    smiles: 'OC[C@H]1OC(O)[C@H](O)[C@@H](O)[C@@H]1O',
    note: 'Halka formu, dört stereo merkez',
  },
  {
    id: 'ascorbic',
    name: 'C vitamini',
    category: 'biyo',
    smiles: 'OC[C@H](O)[C@H]1OC(=O)C(O)=C1O',
    note: 'Askorbik asit',
  },
  {
    id: 'adenine',
    name: 'Adenin',
    category: 'biyo',
    smiles: 'Nc1ncnc2[nH]cnc12',
    note: 'DNA bazı, kaynaşık heterohalka',
  },
  {
    id: 'cholesterol',
    name: 'Kolesterol',
    category: 'biyo',
    smiles: 'CC(C)CCC[C@@H](C)[C@H]1CC[C@H]2[C@@H]3CC=C4C[C@@H](O)CC[C@]4(C)[C@H]3CC[C@]12C',
    note: 'Steroid iskeleti, sekiz stereo merkez',
  },

  // --- Ilaclar ---
  {
    id: 'aspirin',
    name: 'Aspirin',
    category: 'ilac',
    smiles: 'CC(=O)Oc1ccccc1C(=O)O',
    note: 'Asetilsalisilik asit',
  },
  {
    id: 'paracetamol',
    name: 'Parasetamol',
    category: 'ilac',
    smiles: 'CC(=O)Nc1ccc(O)cc1',
    note: 'Amid + fenol',
  },
  {
    id: 'ibuprofen',
    name: 'İbuprofen',
    category: 'ilac',
    smiles: 'CC(C)Cc1ccc(cc1)C(C)C(=O)O',
    note: 'Ağrı kesici',
  },
  {
    id: 'penicillin',
    name: 'Penisilin G',
    category: 'ilac',
    smiles: 'CC1(C)S[C@@H]2[C@H](NC(=O)Cc3ccccc3)C(=O)N2[C@H]1C(=O)O',
    note: 'Gergin β-laktam halkası',
  },

  // --- Gunluk hayat ---
  {
    id: 'caffeine',
    name: 'Kafein',
    category: 'gunluk',
    smiles: 'Cn1cnc2c1c(=O)n(C)c(=O)n2C',
    note: 'Kahve ve çayda',
  },
  {
    id: 'nicotine',
    name: 'Nikotin',
    category: 'gunluk',
    smiles: 'CN1CCC[C@H]1c1cccnc1',
    note: 'İki azotlu halka',
  },
  {
    id: 'citric',
    name: 'Sitrik asit',
    category: 'gunluk',
    smiles: 'OC(=O)CC(O)(CC(=O)O)C(=O)O',
    note: 'Limonun ekşiliği, üç karboksil',
  },
  {
    id: 'vanillin',
    name: 'Vanilin',
    category: 'gunluk',
    smiles: 'COc1cc(C=O)ccc1O',
    note: 'Vanilya kokusu',
  },
  {
    id: 'capsaicin',
    name: 'Kapsaisin',
    category: 'gunluk',
    smiles: 'COc1cc(CNC(=O)CCCC/C=C/C(C)C)ccc1O',
    note: 'Acı biberin acısı, (E) çift bağ',
  },
  {
    id: 'menthol',
    name: 'Mentol',
    category: 'gunluk',
    smiles: 'CC(C)[C@@H]1CC[C@@H](C)C[C@H]1O',
    note: 'Nane serinliği',
  },
];

/** Galeriyi kategorilere ayirir; kategori sirasi CATEGORY_LABELS'a gore sabit. */
export function examplesByCategory(): [ExampleCategory, Example[]][] {
  const order = Object.keys(CATEGORY_LABELS) as ExampleCategory[];
  return order.map((category) => [category, EXAMPLES.filter((e) => e.category === category)]);
}
