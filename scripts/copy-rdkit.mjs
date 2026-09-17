// RDKit.js'in dist dosyalarini public/ altina kopyalar.
// Vite'ta @rdkit/rdkit'in ESM importu sorunlu oldugu icin dosyalari
// statik olarak sunup index.html'den <script> ile yukluyoruz.
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'node_modules', '@rdkit', 'rdkit', 'dist');
const to = join(root, 'public');

const files = ['RDKit_minimal.js', 'RDKit_minimal.wasm'];

if (!existsSync(from)) {
  console.warn('[copy-rdkit] @rdkit/rdkit bulunamadi, atlaniyor.');
  process.exit(0);
}

mkdirSync(to, { recursive: true });
for (const f of files) {
  copyFileSync(join(from, f), join(to, f));
  console.log(`[copy-rdkit] ${f} -> public/`);
}
