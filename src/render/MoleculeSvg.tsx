import { forwardRef, useMemo } from 'react';
import type { Molecule } from '../model/types';
import { DEFAULT_VIEWPORT, viewBoxOf } from '../editor/viewport';
import type { Viewport } from '../editor/viewport';
import { getAtom } from '../model/molecule';
import { pointAt, preferredBondAngle } from '../model/geometry';
import AtomLabel from './AtomLabel';
import BondShape from './BondShape';
import { BOND_WIDTH, isLabelVisible } from './style';
import { CANVAS_BG, INK } from './theme';

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
  /** Zincir araci onizlemesi: kesikli zikzak ve eklenecek atom sayisi */
  chainPreview?: { points: { x: number; y: number }[]; label: string } | null;
  /** Kutu secimi cercevesi (dunya koordinatinda) */
  selectionRect?: Rect | null;
  /** Fare altindaki atomun vurgusu icin */
  hoverAtomId?: string | null;
  /** CIP stereo etiketleri: atomId -> "(R)", bondId -> "(E)" */
  stereo?: { atoms: Map<string, string>; bonds: Map<string, string> } | null;
  /** Degerligi asilmis atomlar — kirmizi halkayla isaretlenir */
  errorAtomIds?: Set<string>;
  /** Secili fonksiyonel grubun atomlari — renkli serit ile vurgulanir */
  groupHighlight?: { color: string; atomIds: Set<string> } | null;
  /** Verilirse bu halkalar icte daireyle, baglari tekli cizgiyle gosterilir */
  aromaticRings?: string[][] | null;
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
    chainPreview,
    selectionRect,
    hoverAtomId,
    stereo,
    errorAtomIds,
    groupHighlight,
    aromaticRings,
    ...svgProps
  },
  ref,
) {
  const aromaticBonds = useMemo(
    () => ringBondIds(molecule, aromaticRings ?? []),
    [molecule, aromaticRings],
  );

  return (
    <svg
      ref={ref}
      width={width}
      height={height}
      viewBox={viewBoxOf(viewport, width, height)}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', background: CANVAS_BG, touchAction: 'none' }}
      {...svgProps}
    >
      {/* Grup vurgusu en altta: baglar ve etiketler ustunde okunakli kalsin */}
      {groupHighlight && <GroupHighlightLayer molecule={molecule} highlight={groupHighlight} />}

      {/* Baglar once — etiketler ustlerine gelsin */}
      <g>
        {molecule.bonds.map((bond) => (
          <BondShape
            key={bond.id}
            molecule={molecule}
            bond={bond}
            selected={highlight?.bondIds?.has(bond.id)}
            aromatic={aromaticBonds.has(bond.id)}
          />
        ))}
        {aromaticRings?.map((ring) => <AromaticCircle key={ring.join()} molecule={molecule} ring={ring} />)}
      </g>

      {chainPreview && chainPreview.points.length > 1 && (
        <g style={{ pointerEvents: 'none' }}>
          <polyline
            points={chainPreview.points.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={1.6}
            strokeDasharray="4 3"
            strokeLinejoin="round"
          />
          <text
            x={chainPreview.points.at(-1)!.x + 10}
            y={chainPreview.points.at(-1)!.y - 10}
            fontSize={12}
            fontWeight={600}
            fill="var(--accent)"
            fontFamily="system-ui, sans-serif"
          >
            {chainPreview.label}
          </text>
        </g>
      )}

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
            <circle key={atom.id} cx={atom.x} cy={atom.y} r={10} fill={CANVAS_BG} />
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

/** Aromatik halkalarin kenari olan baglar: iki ucu da ayni halkada. */
function ringBondIds(molecule: Molecule, rings: string[][]): Set<string> {
  const ids = new Set<string>();
  for (const ring of rings) {
    const members = new Set(ring);
    for (const b of molecule.bonds) {
      if (members.has(b.a1) && members.has(b.a2)) ids.add(b.id);
    }
  }
  return ids;
}

/**
 * Halkanin icine daire. Yaricap, halkanin ic teget cemberinin ~%62'si:
 * kenarlara degmeden, bos kalmadan ortada durur.
 */
function AromaticCircle({ molecule, ring }: { molecule: Molecule; ring: string[] }) {
  const atoms = ring.map((id) => getAtom(molecule, id)).filter((a) => a !== undefined);
  if (atoms.length < 3) return null;
  const cx = atoms.reduce((s, a) => s + a.x, 0) / atoms.length;
  const cy = atoms.reduce((s, a) => s + a.y, 0) / atoms.length;
  const circumradius = atoms.reduce((s, a) => s + Math.hypot(a.x - cx, a.y - cy), 0) / atoms.length;
  const inradius = circumradius * Math.cos(Math.PI / atoms.length);
  return (
    <circle cx={cx} cy={cy} r={inradius * 0.62} fill="none" stroke={INK} strokeWidth={BOND_WIDTH} />
  );
}

/** Iki ucu da gruptaki baglara genis yari saydam serit, atomlara disk. */
function GroupHighlightLayer({
  molecule,
  highlight,
}: {
  molecule: Molecule;
  highlight: { color: string; atomIds: Set<string> };
}) {
  const { color, atomIds } = highlight;
  return (
    <g opacity={0.28} style={{ pointerEvents: 'none' }}>
      {molecule.bonds
        .filter((b) => atomIds.has(b.a1) && atomIds.has(b.a2))
        .map((b) => {
          const a = getAtom(molecule, b.a1);
          const c = getAtom(molecule, b.a2);
          if (!a || !c) return null;
          return (
            <line
              key={b.id}
              x1={a.x}
              y1={a.y}
              x2={c.x}
              y2={c.y}
              stroke={color}
              strokeWidth={14}
              strokeLinecap="round"
            />
          );
        })}
      {molecule.atoms
        .filter((a) => atomIds.has(a.id))
        .map((a) => (
          <circle key={a.id} cx={a.x} cy={a.y} r={10} fill={color} />
        ))}
    </g>
  );
}

export default MoleculeSvg;
