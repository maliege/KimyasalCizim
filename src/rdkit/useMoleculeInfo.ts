import { useEffect, useState } from 'react';
import { toMolfile } from '../model/molfile';
import { findBondBetween } from '../model/molecule';
import type { Molecule } from '../model/types';
import { analyze } from './RdkitService';
import type { FoundGroup, MoleculeInfo, StereoTags } from './RdkitService';
import { useRdkit } from './useRdkit';

const EMPTY: MoleculeInfo = {
  valid: true,
  smiles: '',
  inchi: null,
  inchiKey: null,
  descriptors: null,
  stereo: null,
  groups: null,
};

/** Bulunan bir fonksiyonel grup, eslesmeleri kendi atom kimliklerimizle. */
export type GroupHits = { id: string; matches: string[][] };

/** Cizim uzerinde gosterilecek CIP etiketleri, kendi kimliklerimizle anahtarli. */
export type StereoLabels = {
  /** atomId -> "(R)" / "(S)" / "(?)" */
  atoms: Map<string, string>;
  /** bondId -> "(E)" / "(Z)" */
  bonds: Map<string, string>;
};

/**
 * Molekul degistikce RDKit tanimlayicilarini hesaplar.
 *
 * Hesap her fare hareketinde degil, cizim durulunca yapilir — WASM cagrisi
 * ucuz degil ve suruklerken ara sonuclarin bir degeri yok.
 */
export function useMoleculeInfo(molecule: Molecule, debounceMs = 300) {
  const { status, rdkit } = useRdkit();
  const [info, setInfo] = useState<MoleculeInfo | null>(null);
  const [stereo, setStereo] = useState<StereoLabels | null>(null);
  const [groups, setGroups] = useState<GroupHits[]>([]);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (status !== 'ready') return;

    if (molecule.atoms.length === 0) {
      setInfo(EMPTY);
      setStereo(null);
      setGroups([]);
      setPending(false);
      return;
    }

    setPending(true);
    const timer = setTimeout(() => {
      const result = analyze(rdkit, toMolfile(molecule));
      setInfo(result);
      // Etiketleri *analiz edilen* molekule gore esle; sonradan degisen
      // bir cizimde indeksler kayabilir.
      setStereo(result.stereo ? mapStereoToIds(result.stereo, molecule) : null);
      setGroups(result.groups ? mapGroupsToIds(result.groups, molecule) : []);
      setPending(false);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [molecule, rdkit, status, debounceMs]);

  return { info, stereo, groups, pending, ready: status === 'ready', status };
}

/**
 * RDKit atom indekslerini kendi atom kimliklerimize cevirir.
 *
 * Molblock atomlari `molecule.atoms` sirasinda yazdigimiz icin i'nci
 * RDKit atomu i'nci atomumuza karsilik gelir.
 */
function mapStereoToIds(tags: StereoTags, molecule: Molecule): StereoLabels {
  const atoms = new Map<string, string>();
  for (const [index, label] of tags.atoms) {
    const atom = molecule.atoms[index];
    if (atom) atoms.set(atom.id, label);
  }

  const bonds = new Map<string, string>();
  for (const [i, j, label] of tags.bonds) {
    const a = molecule.atoms[i];
    const b = molecule.atoms[j];
    if (!a || !b) continue;
    const bond = findBondBetween(molecule, a.id, b.id);
    if (bond) bonds.set(bond.id, label);
  }

  return { atoms, bonds };
}

/** Grup eslesmelerindeki RDKit atom indekslerini kendi kimliklerimize cevirir. */
function mapGroupsToIds(groups: FoundGroup[], molecule: Molecule): GroupHits[] {
  return groups.map((g) => ({
    id: g.id,
    matches: g.matches.map((indices) =>
      indices.map((i) => molecule.atoms[i]?.id).filter((id): id is string => id !== undefined),
    ),
  }));
}
