// PWA ikonlarini scripts/*.svg dosyalarindan uretir.
//
// sharp kalici bir bagimlilik degil; bu betik elle calistirilir ve uretilen
// PNG'ler depoya islenir. Ikonlar nadiren degistigi icin her kurulumda 30 MB'lik
// bir yerel bagimliligi tasimaktansa bu yol tercih edildi:
//
//   npx --yes sharp-cli ... ya da: node scripts/make-icons.mjs  (sharp kuruluysa)
//
// Kaynaklar:
//   icon.svg          -> kose yuvarlamali, "any" amacli ikonlar
//   icon-maskable.svg -> tam tasan, "maskable" ve iOS icin
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'public');

/** [kaynak svg, hedef png, kenar uzunlugu] */
const ICONS = [
  ['icon.svg', 'icon-192.png', 192],
  ['icon.svg', 'icon-512.png', 512],
  ['icon-maskable.svg', 'icon-maskable-512.png', 512],
  // iOS kendi maskesini uyguladigi icin tam tasan varyant kullanilir.
  ['icon-maskable.svg', 'apple-touch-icon.png', 180],
];

for (const [source, target, size] of ICONS) {
  execFileSync(
    'npx',
    [
      '--yes', 'sharp-cli',
      '--input', join(here, source),
      '--output', join(out, target),
      'resize', String(size), String(size),
    ],
    { stdio: 'inherit', shell: process.platform === 'win32' },
  );
  console.log(`[ikon] ${target} (${size}px)`);
}
