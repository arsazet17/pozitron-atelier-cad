import { describe, expect, it } from 'vitest';
import { bracketCount, calcProduct, roundUp } from './calc';
import { orderEstimate } from './estimate';
import { DEFAULT_TECH, newOrder, newProduct } from './factory';
import { resolveMeasures } from './measurements';
import type { Material } from './types';

const fabric = (patch: Partial<Material>): Material => ({
  id: 'f1',
  kind: 'fabric',
  name: 'Блэкаут',
  article: '',
  unit: 'м',
  price: 1000,
  rollWidth: 1400,
  rapport: 0,
  railroaded: false,
  note: '',
  ...patch,
});

const ctxFor = (mat: Material, measures = { corniceLength: 3000, corniceHeight: 2600, floorClearance: 10 }) => ({
  resolved: resolveMeasures({ measures, hasRadiator: false, corniceMount: 'wall' }),
  tech: DEFAULT_TECH,
  materials: new Map([[mat.id, mat]]),
});

describe('calcProduct — портьеры', () => {
  it('ткань в рост: полосы и метраж', () => {
    const p = { ...newProduct('classic'), fabricId: 'f1' }; // 2 полотна, сборка ×2
    const c = calcProduct(p, ctxFor(fabric({})));
    // полотно 1500, крой 1500×2 + 2×50 = 3100 → 3 полосы по 1400 (с двумя швами по 2×15)
    expect(c.cutWidth).toBe(3100);
    expect(c.stripsPerPanel).toBe(3);
    // длина 2590 + 50 + 100 = 2740
    expect(c.cutLength).toBe(2740);
    // последняя полоса 3100 − 2 × (1400 − 30) = 360 мм; две такие помещаются в одну ширину
    // строк раскладки: 2 × 2 целых + 1 общая = 5 → 5 × 2740 = 13 700 мм
    expect(c.fabric?.lengthRaw).toBe(13700);
    expect(c.fabric?.lengthRounded).toBe(13700);
  });

  it('раппорт удлиняет полосу и добавляет запас на совмещение', () => {
    const p = { ...newProduct('classic'), fabricId: 'f1', panels: 1, fullness: 1 };
    const c = calcProduct(p, ctxFor(fabric({ rapport: 640 })));
    // 2740 → 3200 (5 раппортов); 3000+100 → 3 полосы → 3 строки × 3200 + 640
    expect(c.fabric?.lengthRaw).toBe(3 * 3200 + 640);
  });

  it('ткань в высоту', () => {
    const p = { ...newProduct('tulle'), fabricId: 'f1' }; // 1 полотно, ×2,5
    const c = calcProduct(p, ctxFor(fabric({ rollWidth: 2900, railroaded: true })));
    // крой 3000×2,5 + 100 = 7600 мм вдоль рулона
    expect(c.fabric?.railroaded).toBe(true);
    expect(c.fabric?.lengthRaw).toBe(7600);
  });

  it('в высоту не помещается — считается в рост с предупреждением', () => {
    const p = { ...newProduct('tulle'), fabricId: 'f1' };
    const c = calcProduct(p, ctxFor(fabric({ rollWidth: 2500, railroaded: true })));
    expect(c.fabric?.railroaded).toBe(false);
    expect(c.warnings.some((w) => w.includes('не помещается'))).toBe(true);
  });

  it('без размеров — предупреждение, без расчёта', () => {
    const p = newProduct('classic');
    const c = calcProduct(p, { ...ctxFor(fabric({})), resolved: resolveMeasures({ measures: {}, hasRadiator: false, corniceMount: 'wall' }) });
    expect(c.fabric).toBeUndefined();
    expect(c.warnings.length).toBeGreaterThan(0);
  });
});

describe('римская и рулонная', () => {
  const measures = { openingWidth: 1200, openingHeight: 1400, sillHeight: 850, corniceHeight: 2400 };
  it('римская: размер по проёму, рейки', () => {
    const p = { ...newProduct('roman'), fabricId: 'f1' };
    const c = calcProduct(p, ctxFor(fabric({ rollWidth: 1500 }), measures as never));
    expect(c.finishedWidth).toBe(1300);
    expect(c.finishedHeight).toBe(1550);
    expect(c.rods).toBe(5);
  });
});

describe('вспомогательное', () => {
  it('округление вверх', () => {
    expect(roundUp(13701, 100)).toBe(13800);
    expect(roundUp(13700, 100)).toBe(13700);
  });
  it('кронштейны', () => {
    expect(bracketCount(1400)).toBe(2);
    expect(bracketCount(3400)).toBe(4);
  });
});

describe('смета', () => {
  it('собирает строки и скидку', () => {
    const mat = fabric({});
    const sewing: Material = { id: 's1', kind: 'work', name: 'Пошив', article: '', unit: 'м', price: 300, note: '' };
    const order = newOrder('000001');
    const w = order.rooms[0].windows[0];
    w.measures = { corniceLength: 3000, corniceHeight: 2600, floorClearance: 10 };
    w.products = [{ ...newProduct('classic'), fabricId: 'f1', sewingId: 's1' }];
    order.discountPercent = 10;
    const est = orderEstimate(order, new Map([[mat.id, mat], [sewing.id, sewing]]), DEFAULT_TECH);
    const lines = est.windows[0].lines;
    expect(lines.find((l) => l.key.endsWith(':fabric'))?.sum).toBe(13700);
    expect(lines.find((l) => l.key.endsWith(':sewing'))?.qty).toBe(6.2); // 2 × 3100 мм
    expect(est.subtotal).toBe(13700 + 1860);
    expect(est.total).toBe(Math.round((15560 - 1556) * 100) / 100);
  });
});
