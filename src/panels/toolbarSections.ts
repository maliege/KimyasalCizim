import type { ToolId } from '../editor/editorReducer';

/**
 * Sol panelin akordiyon bolumleri: Araclar, Gruplar, Halkalar.
 * Ayni anda yalniz biri acik olur; Bag, Element, Donustur, Gorunum ve Gecmis
 * her zaman gorunur kalir, cunku onlara surekli ihtiyac var.
 */
export type AccordionId = 'araclar' | 'gruplar' | 'halkalar';

/** Araclar bolumundeki araclar. Kisayollar KUCUK harf: buyuk harf element secer. */
export const TOOLS: readonly { id: ToolId; name: string; label: string; hint: string }[] = [
  { id: 'select', name: 'Seç', label: '⭠⭢', hint: 'Seç ve taşı (s) — boş alanda sürükleyerek kutu seçimi' },
  { id: 'chain', name: 'Zincir', label: '╱╲╱', hint: 'Zincir (c): sürükledikçe uzayan zikzak karbon zinciri' },
  { id: 'erase', name: 'Sil', label: '⌫', hint: 'Sil (e)' },
  { id: 'chargePlus', name: 'Yük +', label: '＋', hint: 'Yükü artır' },
  { id: 'chargeMinus', name: 'Yük −', label: '－', hint: 'Yükü azalt' },
  { id: 'isotope', name: 'İzotop', label: '¹³C', hint: 'İzotop: atoma tıkladıkça değişir (¹²C → ¹³C → ¹⁴C → ¹²C)' },
  { id: 'wedge', name: 'Kama', label: '◤', hint: 'Kama bağ, öne doğru (w)' },
  { id: 'hash', name: 'Kesikli', label: '⦀', hint: 'Kesikli bağ, arkaya (h)' },
];

/** Aracin bulundugu akordiyon bolumu; bag ve atom araclari her zaman gorunur bolumde. */
export function sectionForTool(tool: ToolId): AccordionId | null {
  if (tool === 'group') return 'gruplar';
  if (tool === 'template') return 'halkalar';
  return TOOLS.some((t) => t.id === tool) ? 'araclar' : null;
}

/** Acik bolume tiklamak onu kapatir; baskasina tiklamak onu acar. */
export const toggleSection = (current: AccordionId | null, id: AccordionId): AccordionId | null =>
  current === id ? null : id;
