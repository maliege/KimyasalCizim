import { BOND_LENGTH } from './geometry';
import type { Atom, Bond, BondOrder, BondStereo, Molecule } from './types';

/**
 * MDL Molfile (V2000) okuma/yazma — kendi modelimiz ile RDKit arasindaki
 * tek koprü. SMILES'i asla kendimiz uretmiyoruz; molblock'u RDKit'e verip
 * kanonik gosterimi ondan aliyoruz.
 *
 * Koordinat donusumu: molfile Angstrom kullanir (standart bag ~1.5) ve
 * y ekseni yukari dogru buyur; tuvalimiz piksel kullanir ve y asagi buyur.
 */
const MOLFILE_BOND_LENGTH = 1.5;
const MOLFILE_SCALE = BOND_LENGTH / MOLFILE_BOND_LENGTH;

const STEREO_TO_CODE: Record<BondStereo, number> = { none: 0, wedge: 1, hash: 6 };
const CODE_TO_STEREO: Record<number, BondStereo> = { 0: 'none', 1: 'wedge', 6: 'hash' };

// --- yazma ---

export function toMolfile(mol: Molecule, title = ''): string {
  const index = new Map(mol.atoms.map((a, i) => [a.id, i + 1]));

  const lines: string[] = [
    title,
    '  KimyasalCizim          2D',
    '',
    `${pad(mol.atoms.length, 3)}${pad(mol.bonds.length, 3)}  0  0  0  0  0  0  0  0999 V2000`,
  ];

  for (const atom of mol.atoms) {
    lines.push(atomLine(atom));
  }

  for (const bond of mol.bonds) {
    lines.push(
      pad(index.get(bond.a1) ?? 0, 3) +
        pad(index.get(bond.a2) ?? 0, 3) +
        pad(bond.order, 3) +
        pad(STEREO_TO_CODE[bond.stereo], 3),
    );
  }

  // Yuk ve izotoplar eski atom bloğu alanlari yerine M satirlariyla
  // yazilir; V2000'de dogru olan budur (eski alan +-3 ile sinirli).
  lines.push(
    ...propertyLines(
      'CHG',
      mol.atoms.flatMap((a) => (a.charge !== 0 ? [[index.get(a.id)!, a.charge] as const] : [])),
    ),
    ...propertyLines(
      'ISO',
      mol.atoms.flatMap((a) =>
        a.isotope !== undefined ? [[index.get(a.id)!, a.isotope] as const] : [],
      ),
    ),
  );

  lines.push('M  END');
  return lines.join('\n') + '\n';
}

function atomLine(atom: Atom): string {
  const x = coord(atom.x / MOLFILE_SCALE);
  const y = coord(-atom.y / MOLFILE_SCALE); // y eksenini cevir
  const z = coord(0);
  return `${x}${y}${z} ${atom.element.padEnd(3)} 0  0  0  0  0  0  0  0  0  0  0  0`;
}

/** `M  CHG` / `M  ISO` satirlari — satir basina en fazla 8 giris. */
function propertyLines(tag: 'CHG' | 'ISO', entries: readonly (readonly [number, number])[]): string[] {
  const lines: string[] = [];
  for (let i = 0; i < entries.length; i += 8) {
    const chunk = entries.slice(i, i + 8);
    lines.push(
      `M  ${tag}${pad(chunk.length, 3)}` +
        chunk.map(([idx, value]) => pad(idx, 4) + pad(value, 4)).join(''),
    );
  }
  return lines;
}

const pad = (n: number, width: number): string => String(n).padStart(width);
const coord = (n: number): string => n.toFixed(4).padStart(10);

// --- okuma ---

export class MolfileError extends Error {}

export function fromMolfile(text: string): Molecule {
  const lines = text.split(/\r?\n/);
  if (lines.length < 4) throw new MolfileError('Molfile çok kısa.');

  const counts = lines[3];
  if (counts.includes('V3000')) {
    throw new MolfileError('V3000 molfile desteklenmiyor (yalnızca V2000).');
  }

  const atomCount = parseInt(counts.slice(0, 3), 10);
  const bondCount = parseInt(counts.slice(3, 6), 10);
  if (!Number.isFinite(atomCount) || !Number.isFinite(bondCount)) {
    throw new MolfileError('Sayım satırı okunamadı.');
  }

  const atoms: Atom[] = [];
  for (let i = 0; i < atomCount; i++) {
    const line = lines[4 + i];
    if (line === undefined) throw new MolfileError(`Atom satırı eksik (${i + 1}).`);
    const x = Number(line.slice(0, 10));
    const y = Number(line.slice(10, 20));
    const element = line.slice(31, 34).trim();
    if (!element || !Number.isFinite(x) || !Number.isFinite(y)) {
      throw new MolfileError(`Atom satırı geçersiz (${i + 1}).`);
    }
    atoms.push({
      id: `a${i + 1}`,
      element,
      x: x * MOLFILE_SCALE,
      y: -y * MOLFILE_SCALE,
      charge: 0,
    });
  }

  const bonds: Bond[] = [];
  for (let i = 0; i < bondCount; i++) {
    const line = lines[4 + atomCount + i];
    if (line === undefined) throw new MolfileError(`Bağ satırı eksik (${i + 1}).`);
    const a1 = parseInt(line.slice(0, 3), 10);
    const a2 = parseInt(line.slice(3, 6), 10);
    const order = parseInt(line.slice(6, 9), 10);
    const stereoCode = parseInt(line.slice(9, 12), 10);
    if (!atoms[a1 - 1] || !atoms[a2 - 1]) {
      throw new MolfileError(`Bağ satırı geçersiz atoma işaret ediyor (${i + 1}).`);
    }
    bonds.push({
      id: `b${i + 1}`,
      a1: atoms[a1 - 1].id,
      a2: atoms[a2 - 1].id,
      // Aromatik (4) ve diger sorgu bag tipleri tekli olarak okunur;
      // RDKit bize her zaman Kekule formu verdigi icin pratikte gorulmez.
      order: (order >= 1 && order <= 3 ? order : 1) as BondOrder,
      stereo: CODE_TO_STEREO[stereoCode] ?? 'none',
    });
  }

  applyProperties(lines.slice(4 + atomCount + bondCount), atoms);

  return { atoms, bonds };
}

/** `M  CHG` / `M  ISO` satirlarini atomlara isler. */
function applyProperties(lines: string[], atoms: Atom[]): void {
  for (const line of lines) {
    if (line.startsWith('M  END')) break;
    const tag = line.slice(3, 6);
    if (tag !== 'CHG' && tag !== 'ISO') continue;

    const count = parseInt(line.slice(6, 9), 10);
    if (!Number.isFinite(count)) continue;

    for (let i = 0; i < count; i++) {
      const base = 9 + i * 8;
      const atomIndex = parseInt(line.slice(base, base + 4), 10);
      const value = parseInt(line.slice(base + 4, base + 8), 10);
      const atom = atoms[atomIndex - 1];
      if (!atom || !Number.isFinite(value)) continue;
      if (tag === 'CHG') atom.charge = value;
      else atom.isotope = value;
    }
  }
}

/** Molekulu verilen merkeze tasir (iceri aktarimda tuvale oturtmak icin). */
export function centerMolecule(mol: Molecule, center: { x: number; y: number }): Molecule {
  if (mol.atoms.length === 0) return mol;

  const xs = mol.atoms.map((a) => a.x);
  const ys = mol.atoms.map((a) => a.y);
  const dx = center.x - (Math.min(...xs) + Math.max(...xs)) / 2;
  const dy = center.y - (Math.min(...ys) + Math.max(...ys)) / 2;

  return { ...mol, atoms: mol.atoms.map((a) => ({ ...a, x: a.x + dx, y: a.y + dy })) };
}
