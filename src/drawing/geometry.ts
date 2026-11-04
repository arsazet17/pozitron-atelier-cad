import type { ResolvedMeasures } from '../model/measurements';
import type { MeasureKey, Mm, WindowItem } from '../model/types';

/**
 * Геометрия фасада окна в координатах стены (мм, Y вверх от пола).
 * Если размер ещё не введён, для раскладки берётся типовое значение,
 * а на чертеже такой размер помечается «?».
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FacadeGeometry {
  wall: { width: Mm; height: Mm };
  opening: Rect;
  sill: Rect;
  radiator?: Rect;
  cornice: { x1: Mm; x2: Mm; y: Mm };
  product?: Rect;
  /** Какие размеры известны (введены или вычислены) */
  known: Set<MeasureKey>;
  value: (k: MeasureKey) => Mm | undefined;
}

const TYPICAL = {
  openingWidth: 1500,
  openingHeight: 1500,
  sillHeight: 850,
  ceilingHeight: 2700,
  pier: 600,
  overhang: 200,
  sillThickness: 40,
  sillExtra: 100,
  radiatorWidth: 1000,
  radiatorHeight: 500,
  radiatorFromFloor: 120,
};

export function facadeGeometry(w: Pick<WindowItem, 'hasRadiator' | 'corniceMount'>, r: ResolvedMeasures): FacadeGeometry {
  const v = (k: MeasureKey) => r.values[k]?.value;
  const known = new Set(Object.keys(r.values) as MeasureKey[]);
  const pos = (n: Mm | undefined, fallback: Mm) => (n !== undefined && n > 0 ? n : fallback);

  const ow = pos(v('openingWidth'), TYPICAL.openingWidth);
  const oh = pos(v('openingHeight'), TYPICAL.openingHeight);
  const sill = pos(v('sillHeight'), TYPICAL.sillHeight);
  let ceiling = pos(v('ceilingHeight'), Math.max(TYPICAL.ceilingHeight, sill + oh + 300));
  const lp = pos(v('leftPier'), TYPICAL.pier);
  const rp = pos(v('rightPier'), TYPICAL.pier);
  const wallW = pos(v('wallWidth'), lp + ow + rp);

  const overL = v('corniceOverhangLeft') ?? (v('corniceLength') !== undefined ? (v('corniceLength')! - ow) / 2 : TYPICAL.overhang);
  const overR = v('corniceOverhangRight') ?? (v('corniceLength') !== undefined ? v('corniceLength')! - ow - overL : TYPICAL.overhang);
  const top = sill + oh;
  const corniceY =
    w.corniceMount === 'ceiling' ? ceiling : pos(v('corniceHeight'), Math.round(top + Math.max(80, (ceiling - top) / 2)));
  ceiling = Math.max(ceiling, corniceY);

  const sillLen = pos(v('sillLength'), ow + TYPICAL.sillExtra);
  const sillRect: Rect = { x: lp + ow / 2 - sillLen / 2, y: sill - TYPICAL.sillThickness, w: sillLen, h: TYPICAL.sillThickness };

  let radiator: Rect | undefined;
  if (w.hasRadiator) {
    const rw = pos(v('radiatorWidth'), TYPICAL.radiatorWidth);
    const rh = pos(v('radiatorHeight'), TYPICAL.radiatorHeight);
    const rf = pos(v('radiatorFromFloor'), TYPICAL.radiatorFromFloor);
    const off = v('radiatorOffset') ?? (ow - rw) / 2;
    radiator = { x: lp + off, y: rf, w: rw, h: rh };
  }

  const cx1 = lp - overL;
  const cx2 = lp + ow + overR;
  let product: Rect | undefined;
  const pw = v('productWidth');
  const ph = v('productHeight');
  if (pw !== undefined || ph !== undefined) {
    const width = pos(pw, cx2 - cx1);
    const height = pos(ph, corniceY - (v('floorClearance') ?? 0));
    product = { x: (cx1 + cx2) / 2 - width / 2, y: corniceY - height, w: width, h: height };
  }

  return {
    wall: { width: wallW, height: ceiling },
    opening: { x: lp, y: sill, w: ow, h: oh },
    sill: sillRect,
    radiator,
    cornice: { x1: cx1, x2: cx2, y: corniceY },
    product,
    known,
    value: v,
  };
}
