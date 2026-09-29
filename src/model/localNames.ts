import { EXAMPLES } from './examples';
import { EXERCISES } from './exercises';

/**
 * Isimden yapi: once yerel Turkce adlar.
 *
 * PubChem yalniz Ingilizce adlari taniyor ("kafein" bulunmuyor, "caffeine"
 * bulunuyor). Galeri ve alistirmalardaki molekulleri zaten Turkce adlariyla
 * biliyoruz; onlar agsiz ve aninda cozulur. Bilinmeyenler PubChem'e gider.
 */

/**
 * Karsilastirma icin ad normallestirme: Turkce kucuk harf, aksanlar ve
 * noktalama atilir. "ASPİRİN", "Aspirin", "aspırın" ayni sonucu verir.
 */
export function normalizeName(name: string): string {
  return (
    name
      .trim()
      .toLocaleLowerCase('tr')
      // Noktasiz ı ayristirmayla i'ye donmez; elle ceviriyoruz.
      .replace(/ı/g, 'i')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
  );
}

type Entry = { name: string; smiles: string };

/**
 * Bir kaydin tum ad bicimleri: "Etin (asetilen)" → "etin asetilen", "etin",
 * "asetilen". Parantez ici bir es ad olarak da aranabilsin.
 */
function aliases(name: string): string[] {
  const outside = name.replace(/\([^)]*\)/g, ' ');
  const inside = [...name.matchAll(/\(([^)]*)\)/g)].map((m) => m[1]);
  return [name, outside, ...inside].map(normalizeName).filter((a) => a.length > 0);
}

const TABLE: ReadonlyMap<string, Entry> = (() => {
  const map = new Map<string, Entry>();
  for (const item of [...EXAMPLES, ...EXERCISES]) {
    for (const alias of aliases(item.name)) {
      // Ayni ad iki listede de varsa ilk gelen (galeri) kazanir.
      if (!map.has(alias)) map.set(alias, { name: item.name, smiles: item.smiles });
    }
  }
  return map;
})();

/** Yerel tabloda arar; bulunamazsa null. */
export function findLocalName(query: string): Entry | null {
  return TABLE.get(normalizeName(query)) ?? null;
}

/**
 * Girdi SMILES'a benziyor mu? Yalniz RDKit'e sormadan once bir on eleme:
 * koseli parantez disinda SMILES'ta kucuk harf olarak yalniz aromatik
 * b c n o p s bulunur, bosluk hic bulunmaz. "benzen" (e harfi) ya da
 * "acetic acid" (bosluk) ad olarak ele alinir. Benzeyen ama gecersiz bir
 * girdi (ornegin "cocoon") RDKit'te basarisiz olur ve yine ada duser.
 */
export function looksLikeSmiles(input: string): boolean {
  const s = input.trim();
  if (!s || /\s/.test(s)) return false;
  const outsideBrackets = s.replace(/\[[^\]]*\]/g, '');
  return !/[ad-mq-rt-z]/.test(outsideBrackets);
}
