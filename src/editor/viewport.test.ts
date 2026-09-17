import { describe, expect, it } from 'vitest';
import { addAtom, emptyMolecule } from '../model/molecule';
import {
  DEFAULT_VIEWPORT,
  MAX_SCALE,
  MIN_SCALE,
  fitTo,
  panBy,
  toScreen,
  toWorld,
  viewBoxOf,
  zoomAt,
} from './viewport';

describe('koordinat dönüşümü', () => {
  it('varsayılan pencerede piksel = dünya', () => {
    expect(toWorld(DEFAULT_VIEWPORT, 100, 50)).toEqual({ x: 100, y: 50 });
  });

  it('kaydırma ve ölçeği hesaba katar', () => {
    const vp = { x: 100, y: 200, scale: 2 };
    expect(toWorld(vp, 50, 40)).toEqual({ x: 125, y: 220 });
  });

  it('toScreen, toWorld’ün tersidir', () => {
    const vp = { x: -37, y: 91, scale: 1.7 };
    const world = toWorld(vp, 123, 456);
    const screen = toScreen(vp, world);
    expect(screen.x).toBeCloseTo(123, 8);
    expect(screen.y).toBeCloseTo(456, 8);
  });

  it('viewBox ölçeğe göre daralır', () => {
    expect(viewBoxOf({ x: 10, y: 20, scale: 2 }, 800, 600)).toBe('10 20 400 300');
  });
});

describe('zoomAt', () => {
  it('imlecin altındaki noktayı sabit tutar', () => {
    const vp = { x: 0, y: 0, scale: 1 };
    const before = toWorld(vp, 300, 200);
    const after = toWorld(zoomAt(vp, 300, 200, 1.5), 300, 200);
    expect(after.x).toBeCloseTo(before.x, 8);
    expect(after.y).toBeCloseTo(before.y, 8);
  });

  it('kaydırılmış pencerede de sabit tutar', () => {
    const vp = { x: 140, y: -60, scale: 0.8 };
    const before = toWorld(vp, 77, 210);
    const after = toWorld(zoomAt(vp, 77, 210, 0.6), 77, 210);
    expect(after.x).toBeCloseTo(before.x, 8);
    expect(after.y).toBeCloseTo(before.y, 8);
  });

  it('ölçeği sınırlar içinde tutar', () => {
    expect(zoomAt({ x: 0, y: 0, scale: MAX_SCALE }, 0, 0, 4).scale).toBe(MAX_SCALE);
    expect(zoomAt({ x: 0, y: 0, scale: MIN_SCALE }, 0, 0, 0.1).scale).toBe(MIN_SCALE);
  });

  it('sınıra dayanmışsa aynı nesneyi döner', () => {
    const vp = { x: 5, y: 5, scale: MAX_SCALE };
    expect(zoomAt(vp, 10, 10, 2)).toBe(vp);
  });
});

describe('panBy', () => {
  it('içeriği sürükleme yönünde taşır', () => {
    // Sag'a 50px surukleyince pencere sola kayar (icerik saga gider).
    expect(panBy({ x: 100, y: 100, scale: 1 }, 50, 0)).toEqual({ x: 50, y: 100, scale: 1 });
  });

  it('ölçek büyükken daha az dünya birimi kaydırır', () => {
    expect(panBy({ x: 100, y: 100, scale: 2 }, 50, 0).x).toBe(75);
  });
});

describe('fitTo', () => {
  it('boş molekülde varsayılana döner', () => {
    expect(fitTo(emptyMolecule(), 800, 600)).toEqual(DEFAULT_VIEWPORT);
  });

  it('molekülü tuvalin ortasına yerleştirir', () => {
    let m = emptyMolecule();
    m = addAtom(m, { element: 'C', x: 0, y: 0 }).molecule;
    m = addAtom(m, { element: 'C', x: 200, y: 100 }).molecule;

    const vp = fitTo(m, 800, 600);
    // Molekulun merkezi (100, 50) tuvalin merkezine dusmeli
    const center = toWorld(vp, 400, 300);
    expect(center.x).toBeCloseTo(100, 6);
    expect(center.y).toBeCloseTo(50, 6);
  });

  it('tek atomda ölçeği patlatmaz', () => {
    const mol = addAtom(emptyMolecule(), { element: 'C', x: 50, y: 50 }).molecule;
    const vp = fitTo(mol, 800, 600);
    expect(vp.scale).toBeLessThanOrEqual(MAX_SCALE);
    expect(vp.scale).toBeGreaterThanOrEqual(MIN_SCALE);
  });

  it('küçük molekülü 1:1’in ötesine büyütmez', () => {
    // Tek bağlık bir molekül ekranı kaplamamalı.
    let m = emptyMolecule();
    m = addAtom(m, { element: 'C', x: 0, y: 0 }).molecule;
    m = addAtom(m, { element: 'C', x: 40, y: 0 }).molecule;
    expect(fitTo(m, 1200, 800).scale).toBe(1);
  });

  it('büyük molekülü küçültür', () => {
    let m = emptyMolecule();
    m = addAtom(m, { element: 'C', x: 0, y: 0 }).molecule;
    m = addAtom(m, { element: 'C', x: 4000, y: 3000 }).molecule;
    expect(fitTo(m, 800, 600).scale).toBeLessThan(1);
  });
});
