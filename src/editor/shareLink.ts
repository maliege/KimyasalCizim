/**
 * Paylasim baglantilari: yapiyi adresin `#` kismina SMILES olarak gomer.
 *
 * Neden `#`: bu kisim sunucuya hic gonderilmez. Statik hostingte (Bluehost)
 * yonlendirme kurali gerekmez, sunucu gunluklerine de dusmez.
 *
 * Neden elle kodlama: URLSearchParams `+` isaretini bosluk olarak cozer.
 * SMILES'te `+` yuk demektir; `[NH4+]` sessizce `[NH4 ]` olup bozulurdu.
 * `#` da uclu bagdir ve adreste parca ayiricisidir. encodeURIComponent /
 * decodeURIComponent ikisini de dogru tasir.
 */

export type ShareParams = {
  smiles?: string;
  /** Alistirma gorevi kimligi: #gorev=etanol */
  task?: string;
};

/** `#smiles=...` bicimindeki parcayi cozer. Bozuk girdide bos nesne doner. */
export function parseShareHash(hash: string): ShareParams {
  const body = hash.startsWith('#') ? hash.slice(1) : hash;
  const params: ShareParams = {};

  for (const pair of body.split('&')) {
    const eq = pair.indexOf('=');
    if (eq <= 0) continue;
    const key = pair.slice(0, eq);
    let value: string;
    try {
      value = decodeURIComponent(pair.slice(eq + 1)).trim();
    } catch {
      continue; // gecersiz yuzde kodlamasi — bu parametreyi atla
    }
    if (!value) continue;
    if (key === 'smiles') params.smiles = value;
    else if (key === 'gorev') params.task = value;
  }
  return params;
}

/** Verilen SMILES icin paylasilabilir tam adres uretir. */
export function buildShareUrl(base: string, smiles: string): string {
  // Tabandaki eski bir `#...` parcasini at; yoksa iki parca ust uste biner.
  const clean = base.split('#')[0];
  return `${clean}#smiles=${encodeURIComponent(smiles)}`;
}

/** Bir alistirma gorevini dogrudan acan adres (ogretmen paylasimi icin). */
export function buildTaskUrl(base: string, taskId: string): string {
  return `${base.split('#')[0]}#gorev=${encodeURIComponent(taskId)}`;
}
