/**
 * Periyodik tablo verisi.
 *
 * Uc yapi var ve birbirlerini dogrular (elements.test.ts bunu kontrol eder):
 * - ORDER: atom numarasi sirasinda tum simgeler (indeks + 1 = atom numarasi)
 * - NAMES: simge -> Turkce ad
 * - LAYOUT: tablonun gorsel yerlesimi (7 periyot × 18 grup + f blogu)
 */

/** Atom numarasi sirasinda; indeks + 1 = atom numarasi. */
const ORDER: readonly string[] = [
  'H', 'He',
  'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne',
  'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar',
  'K', 'Ca', 'Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn',
  'Ga', 'Ge', 'As', 'Se', 'Br', 'Kr',
  'Rb', 'Sr', 'Y', 'Zr', 'Nb', 'Mo', 'Tc', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd',
  'In', 'Sn', 'Sb', 'Te', 'I', 'Xe',
  'Cs', 'Ba',
  'La', 'Ce', 'Pr', 'Nd', 'Pm', 'Sm', 'Eu', 'Gd', 'Tb', 'Dy', 'Ho', 'Er', 'Tm', 'Yb', 'Lu',
  'Hf', 'Ta', 'W', 'Re', 'Os', 'Ir', 'Pt', 'Au', 'Hg',
  'Tl', 'Pb', 'Bi', 'Po', 'At', 'Rn',
  'Fr', 'Ra',
  'Ac', 'Th', 'Pa', 'U', 'Np', 'Pu', 'Am', 'Cm', 'Bk', 'Cf', 'Es', 'Fm', 'Md', 'No', 'Lr',
  'Rf', 'Db', 'Sg', 'Bh', 'Hs', 'Mt', 'Ds', 'Rg', 'Cn',
  'Nh', 'Fl', 'Mc', 'Lv', 'Ts', 'Og',
];

const NAMES: Record<string, string> = {
  H: 'Hidrojen', He: 'Helyum', Li: 'Lityum', Be: 'Berilyum', B: 'Bor', C: 'Karbon',
  N: 'Azot', O: 'Oksijen', F: 'Flor', Ne: 'Neon', Na: 'Sodyum', Mg: 'Magnezyum',
  Al: 'Alüminyum', Si: 'Silisyum', P: 'Fosfor', S: 'Kükürt', Cl: 'Klor', Ar: 'Argon',
  K: 'Potasyum', Ca: 'Kalsiyum', Sc: 'Skandiyum', Ti: 'Titanyum', V: 'Vanadyum',
  Cr: 'Krom', Mn: 'Mangan', Fe: 'Demir', Co: 'Kobalt', Ni: 'Nikel', Cu: 'Bakır',
  Zn: 'Çinko', Ga: 'Galyum', Ge: 'Germanyum', As: 'Arsenik', Se: 'Selenyum',
  Br: 'Brom', Kr: 'Kripton', Rb: 'Rubidyum', Sr: 'Stronsiyum', Y: 'İtriyum',
  Zr: 'Zirkonyum', Nb: 'Niyobyum', Mo: 'Molibden', Tc: 'Teknesyum', Ru: 'Rutenyum',
  Rh: 'Rodyum', Pd: 'Paladyum', Ag: 'Gümüş', Cd: 'Kadmiyum', In: 'İndiyum',
  Sn: 'Kalay', Sb: 'Antimon', Te: 'Tellür', I: 'İyot', Xe: 'Ksenon', Cs: 'Sezyum',
  Ba: 'Baryum', La: 'Lantan', Ce: 'Seryum', Pr: 'Praseodim', Nd: 'Neodim',
  Pm: 'Prometyum', Sm: 'Samaryum', Eu: 'Evropiyum', Gd: 'Gadolinyum', Tb: 'Terbiyum',
  Dy: 'Disprosyum', Ho: 'Holmiyum', Er: 'Erbiyum', Tm: 'Tulyum', Yb: 'İterbiyum',
  Lu: 'Lutesyum', Hf: 'Hafniyum', Ta: 'Tantal', W: 'Tungsten', Re: 'Renyum',
  Os: 'Osmiyum', Ir: 'İridyum', Pt: 'Platin', Au: 'Altın', Hg: 'Cıva', Tl: 'Talyum',
  Pb: 'Kurşun', Bi: 'Bizmut', Po: 'Polonyum', At: 'Astatin', Rn: 'Radon',
  Fr: 'Fransiyum', Ra: 'Radyum', Ac: 'Aktinyum', Th: 'Toryum', Pa: 'Protaktinyum',
  U: 'Uranyum', Np: 'Neptünyum', Pu: 'Plütonyum', Am: 'Amerikyum', Cm: 'Küriyum',
  Bk: 'Berkelyum', Cf: 'Kaliforniyum', Es: 'Aynştaynyum', Fm: 'Fermiyum',
  Md: 'Mendelevyum', No: 'Nobelyum', Lr: 'Lavrensiyum', Rf: 'Rutherfordiyum',
  Db: 'Dubniyum', Sg: 'Seaborgiyum', Bh: 'Bohriyum', Hs: 'Hassiyum', Mt: 'Meitneryum',
  Ds: 'Darmstadtiyum', Rg: 'Röntgenyum', Cn: 'Kopernikyum', Nh: 'Nihonyum',
  Fl: 'Flerovyum', Mc: 'Moskovyum', Lv: 'Livermoryum', Ts: 'Tennessin', Og: 'Oganesson',
};

const _ = null; // yerlesimdeki bosluklar

/** Ana govde: 7 satir × 18 sutun. */
export const MAIN_BLOCK: readonly (string | null)[][] = [
  ['H',  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _, 'He'],
  ['Li','Be', _,  _,  _,  _,  _,  _,  _,  _,  _,  _, 'B','C','N','O','F','Ne'],
  ['Na','Mg', _,  _,  _,  _,  _,  _,  _,  _,  _,  _, 'Al','Si','P','S','Cl','Ar'],
  ['K','Ca','Sc','Ti','V','Cr','Mn','Fe','Co','Ni','Cu','Zn','Ga','Ge','As','Se','Br','Kr'],
  ['Rb','Sr','Y','Zr','Nb','Mo','Tc','Ru','Rh','Pd','Ag','Cd','In','Sn','Sb','Te','I','Xe'],
  ['Cs','Ba','La','Hf','Ta','W','Re','Os','Ir','Pt','Au','Hg','Tl','Pb','Bi','Po','At','Rn'],
  ['Fr','Ra','Ac','Rf','Db','Sg','Bh','Hs','Mt','Ds','Rg','Cn','Nh','Fl','Mc','Lv','Ts','Og'],
];

/** f blogu: ana govdenin altina ayri cizilir (La ve Ac ana govdede duruyor). */
export const LANTHANIDES: readonly string[] =
  ['Ce','Pr','Nd','Pm','Sm','Eu','Gd','Tb','Dy','Ho','Er','Tm','Yb','Lu'];
export const ACTINIDES: readonly string[] =
  ['Th','Pa','U','Np','Pu','Am','Cm','Bk','Cf','Es','Fm','Md','No','Lr'];

/** Elektron blogu — seciciyi renklendirmek icin yerlesimden turetilir. */
export type Block = 's' | 'p' | 'd' | 'f';

const NUMBERS = new Map(ORDER.map((symbol, index) => [symbol, index + 1] as const));

export const isElement = (symbol: string): boolean => NUMBERS.has(symbol);

export const atomicNumber = (symbol: string): number | undefined => NUMBERS.get(symbol);

export const elementName = (symbol: string): string => NAMES[symbol] ?? symbol;

/** Bir grup/periyot konumunun elektron blogu. */
export function blockAt(period: number, group: number): Block {
  // Helyum p blogunda degil, s blogunda; ama tablonun sagina cizilir.
  if (group === 18 && period === 1) return 's';
  if (group <= 2) return 's';
  if (group >= 13) return 'p';
  return 'd';
}

/** Tek harfli gecerli element simgeleri — klavye kisayolu dogrulamasi icin. */
export const SINGLE_LETTER_ELEMENTS: readonly string[] = ORDER.filter((s) => s.length === 1);

/** Tum simgeler (test ve dogrulama icin). */
export const ALL_SYMBOLS: readonly string[] = ORDER;
