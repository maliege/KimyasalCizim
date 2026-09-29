import type { AtomId, Bond, Molecule } from './types';
import type { Point } from './geometry';

/**
 * Secimi (ya da secim yoksa tum molekulu) dondurme ve aynalama.
 *
 * Aynalamada kimyasal bir tuzak var: koordinatlari yansitip kama/kesikli
 * baglari oldugu gibi birakirsak cizim ENANTIYOMERE doner — L-alanin sessizce
 * D-alanin olur. "Cizimi cevir" diyen kullanici molekulun degismesini
 * beklemez; bu yuzden aynalarken kama ile kesikli yer degistirir. Duzlemde
 * yansitma + kama/kesikli takasi, molekulu 3B'de 180° cevirmekle esdegerdir,
 * yani konfigurasyon korunur. (transform.chem.test.ts bunu RDKit ile dogrular.)
 */

export type TransformOp =
  | { kind: 'rotate'; degrees: number }
  | { kind: 'flip'; axis: 'horizontal' | 'vertical' };

/** Atomlarin agirlik merkezi — donme ve aynalama bunun etrafinda. */
function centroid(mol: Molecule, ids: Set<AtomId>): Point {
  const atoms = mol.atoms.filter((a) => ids.has(a.id));
  const n = atoms.length || 1;
  return {
    x: atoms.reduce((s, a) => s + a.x, 0) / n,
    y: atoms.reduce((s, a) => s + a.y, 0) / n,
  };
}

/**
 * Donusumu uygular.
 * @param atomIds bos ise tum molekul donusturulur
 */
export function transformAtoms(mol: Molecule, atomIds: AtomId[], op: TransformOp): Molecule {
  const ids = new Set(atomIds.length > 0 ? atomIds : mol.atoms.map((a) => a.id));
  if (ids.size === 0) return mol;
  const c = centroid(mol, ids);

  if (op.kind === 'rotate') {
    // SVG'de y asagi dogru buyur; pozitif aci ekranda saat yonu.
    const rad = (op.degrees * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return {
      ...mol,
      atoms: mol.atoms.map((a) => {
        if (!ids.has(a.id)) return a;
        const dx = a.x - c.x;
        const dy = a.y - c.y;
        return { ...a, x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos };
      }),
    };
  }

  const horizontal = op.axis === 'horizontal';
  return {
    atoms: mol.atoms.map((a) => {
      if (!ids.has(a.id)) return a;
      return horizontal ? { ...a, x: 2 * c.x - a.x } : { ...a, y: 2 * c.y - a.y };
    }),
    // Yalniz tamamen secimin icindeki stereo baglar takas edilir; secimin
    // disina uzanan bir bagin bir ucu yerinde kaldigi icin o bag "aynalanmis"
    // sayilmaz.
    bonds: mol.bonds.map((b) =>
      ids.has(b.a1) && ids.has(b.a2) ? { ...b, stereo: swapStereo(b.stereo) } : b,
    ),
  };
}

const swapStereo = (stereo: Bond['stereo']): Bond['stereo'] =>
  stereo === 'wedge' ? 'hash' : stereo === 'hash' ? 'wedge' : stereo;
