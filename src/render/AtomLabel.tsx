import type { Atom, Molecule } from '../model/types';
import { ATOM_FONT_SIZE, chargeText, elementColor, hydrogensGoLeft, shownHydrogens } from './style';
import { useLabelOptions } from './labelOptions';

type Props = {
  molecule: Molecule;
  atom: Atom;
};

/**
 * Atom etiketi: element simgesi + ortuk H sayisi (alt simge) + yuk (ust simge).
 *
 * Hidrojenler baglarin geldigi yonun tersine yazilir — yani saga giden bir
 * zincirin ucundaki oksijen "OH" degil, soldan bagliysa "OH" olarak kalir,
 * saga bagliysa "HO" olur. Bu, cizgilerin metnin uzerinden gecmesini onler.
 */
export default function AtomLabel({ molecule, atom }: Props) {
  // Hidrojen sayisi etiket ayarina bagli (karbonlarda gizlenebilir).
  const hydrogens = shownHydrogens(molecule, atom, useLabelOptions());
  const charge = chargeText(atom.charge);
  const color = elementColor(atom.element);
  const hydrogensOnLeft = hydrogens > 0 && hydrogensGoLeft(molecule, atom);

  const hydrogenParts = hydrogens > 0 && (
    <>
      <tspan>H</tspan>
      {hydrogens > 1 && (
        <tspan dy={ATOM_FONT_SIZE * 0.22} fontSize={ATOM_FONT_SIZE * 0.72}>
          {hydrogens}
        </tspan>
      )}
    </>
  );
  // Alt simgeden sonra taban cizgisine donmek gerekiyor, aksi halde
  // sonraki tspan'ler asagida kalir.
  const baselineReset = hydrogens > 1 && <tspan dy={-ATOM_FONT_SIZE * 0.22} />;

  return (
    <text
      x={atom.x}
      y={atom.y}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={ATOM_FONT_SIZE}
      fontFamily="system-ui, sans-serif"
      fill={color}
      style={{ userSelect: 'none', pointerEvents: 'none' }}
    >
      {atom.isotope !== undefined && (
        <tspan dy={-ATOM_FONT_SIZE * 0.35} fontSize={ATOM_FONT_SIZE * 0.7}>
          {atom.isotope}
        </tspan>
      )}
      {atom.isotope !== undefined && <tspan dy={ATOM_FONT_SIZE * 0.35} />}

      {hydrogensOnLeft && hydrogenParts}
      {hydrogensOnLeft && baselineReset}

      <tspan>{atom.element}</tspan>

      {!hydrogensOnLeft && hydrogenParts}
      {!hydrogensOnLeft && baselineReset}

      {charge && (
        <tspan dy={-ATOM_FONT_SIZE * 0.4} fontSize={ATOM_FONT_SIZE * 0.72}>
          {charge}
        </tspan>
      )}
    </text>
  );
}

