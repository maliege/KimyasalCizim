/**
 * Izotop araci icin yaygin izotoplar.
 *
 * Tum izotoplar degil — kimya egitiminde ve etiketleme deneylerinde sik
 * karsilasilanlar. Liste element basina tiklama sirasini belirler:
 * dogal → ilk → ikinci → … → dogal.
 */
const COMMON_ISOTOPES: Record<string, readonly number[]> = {
  H: [2, 3], // doteryum, trityum
  C: [13, 14],
  N: [15],
  O: [17, 18],
  F: [18],
  P: [32],
  S: [34, 35],
  Cl: [37],
  Br: [81],
  I: [125, 131],
};

export const hasCommonIsotopes = (element: string): boolean => element in COMMON_ISOTOPES;

/**
 * Siradaki izotop. Tanimsiz donmesi "dogal bolluk" demektir.
 * Listede olmayan bir izotoptan (ornegin .mol'den gelen) dogala donulur.
 */
export function nextIsotope(element: string, current: number | undefined): number | undefined {
  const list = COMMON_ISOTOPES[element];
  if (!list) return current;
  if (current === undefined) return list[0];
  const index = list.indexOf(current);
  return index === -1 || index === list.length - 1 ? undefined : list[index + 1];
}
