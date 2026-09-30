import { createContext, useContext } from 'react';
import { DEFAULT_LABEL_OPTIONS } from './style';
import type { LabelOptions } from './style';

/**
 * Etiket seceneklerini cizim bilesenlerine ulastirir.
 *
 * Context: bu ayar App → Canvas → MoleculeSvg → BondShape / AtomLabel
 * zincirinin her halkasindan prop olarak gecmek zorundaydi; yeni her ayar
 * zinciri bastan sona degistiriyordu. Artik saglayici App'te, okuyan yalniz
 * ihtiyaci olan bilesen.
 */
export const LabelOptionsContext = createContext<LabelOptions>(DEFAULT_LABEL_OPTIONS);

export const useLabelOptions = (): LabelOptions => useContext(LabelOptionsContext);
