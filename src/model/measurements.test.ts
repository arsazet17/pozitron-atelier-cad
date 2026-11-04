import { describe, expect, it } from 'vitest';
import { parseMm, resolveMeasures } from './measurements';
import type { Measures } from './types';

const win = (measures: Measures, hasRadiator = false) => ({ measures, hasRadiator, corniceMount: 'wall' as const });

describe('parseMm', () => {
  it('читает целые и дробные миллиметры', () => {
    expect(parseMm('3000')).toBe(3000);
    expect(parseMm(' 2 700 ')).toBe(2700);
    expect(parseMm('1499,6')).toBe(1500);
    expect(parseMm('')).toBeUndefined();
    expect(parseMm('3м')).toBe('invalid');
  });
});

describe('resolveMeasures', () => {
  it('вычисляет недостающий простенок', () => {
    const r = resolveMeasures(win({ wallWidth: 4200, leftPier: 600, openingWidth: 3000 }));
    expect(r.values.rightPier).toMatchObject({ value: 600, source: 'derived' });
    expect(r.issues).toHaveLength(0);
  });

  it('вычисляет расстояние до потолка', () => {
    const r = resolveMeasures(win({ ceilingHeight: 2700, sillHeight: 850, openingHeight: 1500 }));
    expect(r.values.topToCeiling?.value).toBe(350);
  });

  it('ловит несходящуюся цепочку', () => {
    const r = resolveMeasures(win({ wallWidth: 4200, leftPier: 600, openingWidth: 3000, rightPier: 650 }));
    expect(r.issues.some((i) => i.level === 'error' && i.message.includes('−50'))).toBe(true);
  });

  it('допуск 3 мм не считается ошибкой', () => {
    const r = resolveMeasures(win({ wallWidth: 4202, leftPier: 600, openingWidth: 3000, rightPier: 600 }));
    expect(r.issues).toHaveLength(0);
  });

  it('связывает цепочки через общий размер', () => {
    // ширина проёма берётся из стены, длина карниза — из проёма и заходов
    const r = resolveMeasures(win({ wallWidth: 4200, leftPier: 600, rightPier: 600, corniceOverhangLeft: 200, corniceOverhangRight: 200 }));
    expect(r.values.openingWidth?.value).toBe(3000);
    expect(r.values.corniceLength?.value).toBe(3400);
  });

  it('ловит противоречие между цепочками', () => {
    const r = resolveMeasures(
      win({ wallWidth: 4200, leftPier: 600, rightPier: 600, corniceOverhangLeft: 200, corniceOverhangRight: 200, corniceLength: 3500 }),
    );
    expect(r.issues.some((i) => i.message.startsWith('Длина карниза'))).toBe(true);
  });

  it('размеры изделия по умолчанию', () => {
    const r = resolveMeasures(win({ corniceLength: 3400, corniceHeight: 2650, floorClearance: 10 }));
    expect(r.values.productWidth).toMatchObject({ value: 3400, source: 'default' });
    expect(r.values.productHeight).toMatchObject({ value: 2640, source: 'default' });
  });

  it('отрицательное вычисленное значение — ошибка', () => {
    const r = resolveMeasures(win({ ceilingHeight: 2500, sillHeight: 900, openingHeight: 1700 }));
    expect(r.values.topToCeiling?.value).toBe(-100);
    expect(r.issues.some((i) => i.keys.includes('topToCeiling'))).toBe(true);
  });

  it('поля батареи не учитываются без батареи', () => {
    const r = resolveMeasures(win({ radiatorWidth: 1000 }, false));
    expect(r.values.radiatorWidth).toBeUndefined();
  });
});
