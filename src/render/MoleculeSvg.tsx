import { forwardRef } from 'react';
import type { Molecule } from '../model/types';
import { DEFAULT_VIEWPORT, viewBoxOf } from '../editor/viewport';
import type { Viewport } from '../editor/viewport';
import { getAtom } from '../model/molecule';
import { pointAt, preferredBondAngle } from '../model/geometry';
import AtomLabel from './AtomLabel';
import BondShape from './BondShape';
import { isLabelVisible } from './style';

export type Highlight = {
  atomIds?: Set<string>;
  bondIds?: Set<string>;
};

export type Rect = { x1: number; y1: number; x2: number; y2: number };

type Props = {
  molecule: Molecule;
  width: number;
  height: number;
  viewport?: Viewport;
  highlight?: Highlight;
  /** Cizim sirasinda gosterilen gecici bag (henuz modele islenmemis) */
  preview?: Rect | null;
  /** Kutu secimi cercevesi (dunya koordinatinda) */
  selectionRect?: Rect | null;
  /** Fare altindaki atomun vurgusu icin */
  hoverAtomId?: string | null;
  /** CIP stereo etiketleri: atomId -> "(R)", bondId -> "(E)" */
  stereo?: { atoms: Map<string, string>; bonds: Map<string, string> } | null;
  /** Degerligi asilmis atomlar — kirmizi halkayla isaretlenir */
  errorAtomIds?: Set<string>;
} & React.SVGProps<SVGSVGElement>;

/**
 * Molekulu SVG olarak cizer. Saf gorunum bileseni — etkilesim yok,
 * fare olaylari disaridan prop olarak baglanir.
 *
 * Tum ic koordinatlar dunya koordinatidir; yakinlastirma viewBox
 * uzerinden yapilir, boylece cizgi kalinliklari da dogal olarak olceklenir.
 */
const MoleculeSvg = forwardRef<SVGSVGElement, Props>(function MoleculeSvg(
  {
    molecule,
    width,
    height,
    viewport = DEFAULT_VIEWPORT,
    highlight,
    preview,
    selectionRect,
    hoverAtomId,
    stereo,
    errorAtomIds,
    ...svgProps
  },
  ref,
) {
  return (
    <svg
      ref={ref}
      width={width}
      height={height}
      viewBox={viewBoxOf(viewport, width, height)}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', background: '#fff', touchAction: 'none' }}
      {...svgProps}
    >
      {/* Baglar once — etiketler ustlerine gelsin */}
      <g>
        {molecule.bonds.map((bond) => (
          <BondShape
            key={bond.id}
            molecule={molecule}
            bond={bond}
            selected={highlight?.bondIds?.has(bond.id)}
          />
        ))}
      </g>

      {preview && (
        <line
          x1={preview.x1}
          y1={preview.y1}
          x2={preview.x2}
          y2={preview.y2}
          stroke="var(--accent)"
          strokeWidth={1.6}
          strokeDasharray="4 3"
          strokeLinecap="round"
        />
      )}

      {/* Etiketlerin arkasina beyaz hale — bag cizgileri metne degmesin */}
      <g>
        {molecule.atoms
          .filter((a) => isLabelVisible(molecule, a))
          .map((atom) => (
            <circle key={atom.id} cx={atom.x} cy={atom.y} r={10} fill="#fff" />
          ))}
      </g>

      <g>
        {molecule.atoms.map((atom) => {
          const selected = highlight?.atomIds?.has(atom.id);
          const hovered = hoverAtomId === atom.id;
          return (
            <g key={atom.id}>
              {(selected || hovered) && (
                <circle
                  cx={atom.x}
                  cy={atom.y}
                  r={11}
                  fill={selected ? 'var(--accent-soft)' : 'none'}
                  stroke="var(--accent)"
                  strokeWidth={1.5}
                />
              )}
              {isLabelVisible(molecule, atom) && <AtomLabel molecule={molecule} atom={atom} />}
            </g>
          );
        })}
      </g>

      {/* Degerlik hatasi: etiketlerin ustunde, kesikli kirmizi halka. Karbon
          etiketsiz bir kose olsa bile hangi kosenin sorunlu oldugu gorunur. */}
      {errorAtomIds && errorAtomIds.size > 0 && (
        <g>
          {molecule.atoms
            .filter((a) => errorAtomIds.has(a.id))
            .map((a) => (
              <circle
                key={a.id}
                cx={a.x}
                cy={a.y}
                r={14}
                fill="var(--danger)"
                fillOpacity={0.1}
                stroke="var(--danger)"
                strokeWidth={1.8}
                strokeDasharray="3 2"
                style={{ pointerEvents: 'none' }}
              />
            ))}
        </g>
      )}

      {stereo && <StereoLayer molecule={molecule} stereo={stereo} />}

      {selectionRect && (
        <rect
          x={Math.min(selectionRect.x1, selectionRect.x2)}
          y={Math.min(selectionRect.y1, selectionRect.y2)}
          width={Math.abs(selectionRect.x2 - selectionRect.x1)}
          height={Math.abs(selectionRect.y2 - selectionRect.y1)}
          fill="var(--accent)"
          fillOpacity={0.08}
          stroke="var(--accent)"
          strokeWidth={1}
          strokeDasharray="4 3"
          // Zoom'da cerceve kalinligi sabit kalsin
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
});

/**
 * CIP stereo etiketleri: stereo merkezlerin yanina (R)/(S), cift baglarin
 * ortasina (E)/(Z) yazar. Belirlenemeyen merkezler "(?)" ile isaretlenir —
 * bu, kama/kesikli bag eksik demektir ve ogrenciye dogrudan ipucu verir.
 */
function StereoLayer({
  molecule,
  stereo,
}: {
  molecule: Molecule;
  stereo: { atoms: Map<string, string>; bonds: Map<string, string> };
}) {
  const label = (key: string, x: number, y: number, text: string) => (
    <text
      key={key}
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={10}
      fontStyle="italic"
      fontFamily="system-ui, sans-serif"
      // Belirsiz merkezi vurgula, cozulmus olani sakin birak.
      fill={text === '(?)' ? 'var(--danger)' : 'var(--muted)'}
      style={{ userSelect: 'none', pointerEvents: 'none' }}
    >
      {text}
    </text>
  );

  return (
    <g>
      {[...stereo.atoms].map(([atomId, text]) => {
        const atom = getAtom(molecule, atomId);
        if (!atom) return null;
        // Etiketi komsularin en seyrek oldugu yone koy ki yapiyi ortmesin.
        const spot = pointAt(atom, preferredBondAngle(molecule, atomId), 18);
        return label(atomId, spot.x, spot.y, text);
      })}

      {[...stereo.bonds].map(([bondId, text]) => {
        const bond = molecule.bonds.find((b) => b.id === bondId);
        const a = bond && getAtom(molecule, bond.a1);
        const b = bond && getAtom(molecule, bond.a2);
        if (!a || !b) return null;
        return label(bondId, (a.x + b.x) / 2, (a.y + b.y) / 2 - 12, text);
      })}
    </g>
  );
}

export default MoleculeSvg;
