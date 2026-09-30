import { describe, expect, it } from 'vitest';
import { TOOLS, sectionForTool, toggleSection } from './toolbarSections';

describe('sectionForTool', () => {
  it('araçları kendi bölümüne eşler', () => {
    expect(sectionForTool('chain')).toBe('araclar');
    expect(sectionForTool('wedge')).toBe('araclar');
    expect(sectionForTool('group')).toBe('gruplar');
    expect(sectionForTool('template')).toBe('halkalar');
  });

  it('her zaman görünür bölümdeki araçlarda akordiyon açmaz', () => {
    // Bağ ve atom araçları Bağ/Element bölümlerinde, onlar hiç kapanmaz.
    expect(sectionForTool('bond')).toBeNull();
    expect(sectionForTool('atom')).toBeNull();
  });
});

describe('toggleSection', () => {
  it('açık bölüme tıklamak kapatır, başkasına tıklamak onu açar', () => {
    expect(toggleSection('araclar', 'araclar')).toBeNull();
    expect(toggleSection('araclar', 'halkalar')).toBe('halkalar');
    expect(toggleSection(null, 'gruplar')).toBe('gruplar');
  });
});

it('araç ipuçlarındaki kısayollar küçük harf', () => {
  // Büyük harf element seçer (S kükürt); ipucu "(S)" derse kullanıcıyı yanıltır.
  for (const t of TOOLS) {
    const kisayol = t.hint.match(/\((\w)\)/)?.[1];
    if (kisayol) expect(kisayol, t.id).toBe(kisayol.toLowerCase());
  }
});
