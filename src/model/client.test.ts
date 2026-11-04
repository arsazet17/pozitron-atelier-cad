import { describe, expect, it } from 'vitest';
import { clientEstimate } from './estimate';
import { DEFAULT_TECH, newOrder, newProduct, newRoom, newWindow } from './factory';
import type { Product } from './types';

/** Пример из рукописного расчёта: зал (два карниза) и спальня, итого 298 540 ₽ */
function sampleOrder() {
  const order = newOrder('000002');
  const hall = order.rooms[0];
  hall.name = 'Зал';
  const w1 = hall.windows[0];
  w1.measures = { corniceLength: 5920 };
  const w2 = newWindow(2);
  w2.measures = { corniceLength: 1600 };
  hall.windows.push(w2);
  const curtain = (name: string, type: 'classic' | 'tulle', panels: number, height: number, price: number): Product => ({
    ...newProduct(type),
    name,
    panels,
    height,
    fullness: 2,
    heading: 'bow',
    price,
  });
  w1.products = [curtain('Портьеры', 'classic', 2, 3200, 84900), curtain('Тюль', 'tulle', 2, 3200, 37940)];
  w2.products = [curtain('Портьеры', 'classic', 1, 3200, 42440), curtain('Тюль', 'tulle', 1, 3200, 18960)];
  const bedroom = newRoom('Спальня');
  bedroom.windows[0].products = [curtain('Портьеры', 'classic', 2, 3260, 78880), curtain('Тюль', 'tulle', 2, 3260, 34620)];
  order.rooms.push(bedroom);
  order.extraLines = [{ id: 'x', name: 'Шторовод (ручка-водилка)', unit: 'шт', qty: 1, price: 800 }];
  return order;
}

describe('смета по готовым изделиям', () => {
  it('повторяет рукописный расчёт', () => {
    const est = clientEstimate(sampleOrder(), new Map(), DEFAULT_TECH);
    const [hall, bedroom] = est.rooms;
    expect(hall.groups).toHaveLength(2);
    const portiers = hall.groups[0];
    expect(portiers.title).toBe('Портьеры');
    expect(portiers.qtyText).toBe('3 полотна');
    expect(portiers.sum).toBe(127340);
    expect(portiers.description[0]).toBe('Высота готового изделия 3,20 м, бантовая складка, коэффициент сборки 2,0.');
    expect(portiers.description.at(-1)).toBe('На карниз 5,92 м — 2 полотна; на карниз 1,60 м — 1 полотно.');
    expect(hall.groups[1].sum).toBe(56900);
    expect(hall.total).toBe(184240);
    expect(bedroom.total).toBe(113500);
    expect(bedroom.groups[0].description.at(-1)).toBe('На карниз ___ м — 2 полотна.');
    expect(est.total).toBe(298540);
    expect(est.missing).toBe(0);
  });

  it('считает изделия без цены', () => {
    const o = sampleOrder();
    o.rooms[1].windows[0].products[0].price = undefined;
    const est = clientEstimate(o, new Map(), DEFAULT_TECH);
    expect(est.missing).toBe(1);
    expect(est.total).toBe(298540 - 78880);
  });
});
