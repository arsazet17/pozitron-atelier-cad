import { bracketCount, calcProduct, type ProductCalc } from './calc';
import { resolveMeasures, type ResolvedMeasures } from './measurements';
import { HEADING_LABEL, type Material, type Order, type Product, type Room, type TechSettings, type WindowItem } from './types';

/**
 * Смета собирается из расчёта изделий и справочника цен.
 * Цену любой строки можно исправить вручную (order.priceOverrides).
 */

export type LineGroup = 'Ткани' | 'Фурнитура' | 'Карнизы' | 'Работы' | 'Прочее';

export interface EstimateLine {
  key: string;
  group: LineGroup;
  name: string;
  unit: string;
  qty: number;
  price: number;
  sum: number;
  /** Цена исправлена вручную */
  overridden: boolean;
  basis?: string;
}

export interface WindowEstimate {
  room: Room;
  window: WindowItem;
  resolved: ResolvedMeasures;
  products: { product: Product; calc: ProductCalc }[];
  lines: EstimateLine[];
  total: number;
  brackets?: number;
}

export interface OrderEstimate {
  windows: WindowEstimate[];
  extra: EstimateLine[];
  subtotal: number;
  discountPercent: number;
  discount: number;
  total: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const qtyRound = (n: number) => Math.round(n * 100) / 100;

function line(
  key: string,
  group: LineGroup,
  name: string,
  mat: Material | undefined,
  qty: number,
  overrides: Record<string, number>,
  basis?: string,
): EstimateLine {
  const overridden = overrides[key] !== undefined;
  const price = overridden ? overrides[key] : mat?.price ?? 0;
  const q = qtyRound(qty);
  return { key, group, name, unit: mat?.unit ?? 'шт', qty: q, price, sum: round2(q * price), overridden, basis };
}

export function windowEstimate(
  room: Room,
  w: WindowItem,
  materials: Map<string, Material>,
  tech: TechSettings,
  overrides: Record<string, number>,
): WindowEstimate {
  const resolved = resolveMeasures(w);
  const products = w.products.map((p) => ({ product: p, calc: calcProduct(p, { resolved, tech, materials }) }));
  const lines: EstimateLine[] = [];

  for (const { product: p, calc } of products) {
    const n = Math.max(1, Math.round(p.panels));
    if (p.fabricId && calc.fabric) {
      const mat = materials.get(p.fabricId);
      let qty = calc.fabric.lengthRounded / 1000;
      let basis = `по раскладке, ${calc.fabric.pieceCount} дет.`;
      if (mat?.unit === 'м²') {
        qty = p.type === 'roller' && calc.area ? calc.area : (calc.fabric.lengthRounded * calc.fabric.rollWidth) / 1e6;
        basis = p.type === 'roller' ? 'по площади изделия' : 'метраж × ширина рулона';
      }
      lines.push(line(`${p.id}:fabric`, 'Ткани', `${mat?.name ?? 'Ткань'} — ${p.name}`, mat, qty, overrides, basis));
    }
    if (p.liningId && calc.lining) {
      const mat = materials.get(p.liningId);
      lines.push(line(`${p.id}:lining`, 'Ткани', `${mat?.name ?? 'Подкладка'} — ${p.name}`, mat, calc.lining.lengthRounded / 1000, overrides));
    }
    if (p.tapeId && calc.tapeLength) {
      const mat = materials.get(p.tapeId);
      const qty = mat?.unit === 'м' ? calc.tapeLength / 1000 : n;
      lines.push(line(`${p.id}:tape`, 'Фурнитура', `${mat?.name ?? 'Тесьма'} — ${p.name}`, mat, qty, overrides));
    }
    if (p.threadId && calc.threadLength) {
      const mat = materials.get(p.threadId);
      // нитки в метрах; если в справочнике катушки (шт) — одна катушка на изделие
      const qty = mat?.unit === 'м' ? calc.threadLength / 1000 : 1;
      lines.push(line(`${p.id}:thread`, 'Фурнитура', `${mat?.name ?? 'Нитки'} — ${p.name}`, mat, qty, overrides, mat?.unit === 'м' ? 'ориентировочно, по длине строчек' : undefined));
    }
    if (p.sewingId && calc.finishedWidth && calc.finishedHeight) {
      const mat = materials.get(p.sewingId);
      let qty = 1;
      let basis = '';
      if (mat?.unit === 'м') {
        if ((p.type === 'classic' || p.type === 'tulle') && calc.cutWidth) {
          qty = (n * calc.cutWidth) / 1000;
          basis = 'по ширине кроя';
        } else {
          qty = calc.finishedWidth / 1000;
          basis = 'по ширине изделия';
        }
      } else if (mat?.unit === 'м²') {
        qty = (calc.finishedWidth * calc.finishedHeight) / 1e6;
        basis = 'по площади изделия';
      } else if (mat?.unit === 'шт') {
        qty = n;
        basis = 'за полотно';
      }
      lines.push(line(`${p.id}:sewing`, 'Работы', `${mat?.name ?? 'Пошив'} — ${p.name}`, mat, qty, overrides, basis));
    }
  }

  const cl = resolved.values.corniceLength?.value;
  let brackets: number | undefined;
  if (cl) brackets = w.cornice.brackets ?? bracketCount(cl);
  if (w.cornice.materialId) {
    const mat = materials.get(w.cornice.materialId);
    const qty = mat?.unit === 'м' ? (cl ?? 0) / 1000 : 1;
    lines.push(line(`${w.id}:cornice`, 'Карнизы', mat?.name ?? 'Карниз', mat, qty, overrides, mat?.unit === 'м' ? 'по длине карниза' : undefined));
  }
  if (w.cornice.installId) {
    const mat = materials.get(w.cornice.installId);
    const qty = mat?.unit === 'м' ? (cl ?? 0) / 1000 : 1;
    lines.push(line(`${w.id}:install`, 'Работы', mat?.name ?? 'Монтаж', mat, qty, overrides));
  }

  return { room, window: w, resolved, products, lines, total: round2(lines.reduce((s, l) => s + l.sum, 0)), brackets };
}

export function orderEstimate(order: Order, materials: Map<string, Material>, tech: TechSettings): OrderEstimate {
  const windows = order.rooms.flatMap((r) => r.windows.map((w) => windowEstimate(r, w, materials, tech, order.priceOverrides)));
  const extra: EstimateLine[] = order.extraLines.map((x) => ({
    key: `extra:${x.id}`,
    group: 'Прочее',
    name: x.name || 'Позиция',
    unit: x.unit,
    qty: x.qty,
    price: x.price,
    sum: round2(x.qty * x.price),
    overridden: false,
  }));
  const subtotal = round2(windows.reduce((s, w) => s + w.total, 0) + extra.reduce((s, l) => s + l.sum, 0));
  const discount = round2((subtotal * (order.discountPercent || 0)) / 100);
  return { windows, extra, subtotal, discountPercent: order.discountPercent || 0, discount, total: round2(subtotal - discount) };
}

export function money(n: number): string {
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₽';
}

export function qtyText(n: number): string {
  return n.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
}

// ---------- Смета по готовым изделиям (для клиента) ----------

export interface ClientItem {
  windowId: string;
  windowName: string;
  productId: string;
  panels: number;
  corniceLength?: number;
  price?: number;
  /** Сумма по подробной смете для этого изделия — подсказка при вводе цены */
  detailedSum: number;
}

export interface ClientGroup {
  key: string;
  title: string;
  /** «3 полотна» / «1 шт» */
  qtyText: string;
  description: string[];
  sum: number;
  items: ClientItem[];
  /** Сколько изделий в группе без цены */
  missing: number;
}

export interface ClientRoom {
  room: Room;
  groups: ClientGroup[];
  total: number;
}

export interface ClientEstimate {
  rooms: ClientRoom[];
  extra: EstimateLine[];
  subtotal: number;
  discountPercent: number;
  discount: number;
  total: number;
  missing: number;
}

export function plural(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

const meters = (mm: number) => (mm / 1000).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' м';
const panelsText = (n: number) => `${n} ${plural(n, 'полотно', 'полотна', 'полотен')}`;

/**
 * Одинаковые изделия одной комнаты (портьеры одной высоты, складки и сборки
 * на разных карнизах) объединяются в одну строку, как в рукописном расчёте:
 * «Портьеры — 3 полотна. На карниз 5,92 м — 2 полотна; на карниз 1,60 м — 1 полотно».
 */
export function clientEstimate(order: Order, materials: Map<string, Material>, tech: TechSettings): ClientEstimate {
  const detailed = orderEstimate(order, materials, tech);
  const rooms: ClientRoom[] = [];
  for (const room of order.rooms) {
    const groups = new Map<string, ClientGroup>();
    for (const we of detailed.windows.filter((w) => w.room.id === room.id)) {
      const cl = we.resolved.values.corniceLength?.value;
      for (const { product: p, calc } of we.products) {
        const curtain = p.type === 'classic' || p.type === 'tulle';
        const n = Math.max(1, Math.round(p.panels));
        const fabric = p.fabricId ? materials.get(p.fabricId) : undefined;
        const H = calc.finishedHeight;
        const W = calc.finishedWidth;
        const key = [p.type, p.name.trim().toLowerCase(), curtain ? H : `${W}x${H}`, p.heading ?? '', curtain ? p.fullness : '', p.fabricId ?? ''].join('|');
        let g = groups.get(key);
        if (!g) {
          const desc: string[] = [];
          if (curtain) {
            const parts = [`Высота готового изделия ${H ? meters(H) : '___ м'}`];
            if (p.heading) parts.push(HEADING_LABEL[p.heading]);
            parts.push(`коэффициент сборки ${p.fullness.toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}`);
            desc.push(parts.join(', ') + '.');
          } else {
            desc.push(`Размер готового изделия ${W ? meters(W).replace(' м', '') : '___'} × ${H ? meters(H) : '___ м'}.`);
          }
          if (fabric) desc.push(`Ткань: ${fabric.name}${fabric.article ? ` (арт. ${fabric.article})` : ''}.`);
          g = { key, title: p.name.trim() || 'Изделие', qtyText: '', description: desc, sum: 0, items: [], missing: 0 };
          groups.set(key, g);
        }
        const detailedSum = we.lines.filter((l) => l.key.startsWith(p.id + ':')).reduce((s, l) => s + l.sum, 0);
        g.items.push({ windowId: we.window.id, windowName: we.window.name, productId: p.id, panels: n, corniceLength: cl, price: p.price, detailedSum: round2(detailedSum) });
        if (p.price === undefined) g.missing++;
        else g.sum = round2(g.sum + p.price);
      }
    }
    for (const g of groups.values()) {
      const isCurtain = !g.key.startsWith('roman') && !g.key.startsWith('roller');
      const total = g.items.reduce((s, i) => s + i.panels, 0);
      g.qtyText = isCurtain ? panelsText(total) : `${g.items.reduce((s, i) => s + i.panels, 0)} шт`;
      if (isCurtain) {
        g.description.push(g.items.map((i) => `на карниз ${i.corniceLength ? meters(i.corniceLength) : '___ м'} — ${panelsText(i.panels)}`).join('; ').replace(/^н/, 'Н') + '.');
      }
    }
    const list = [...groups.values()];
    if (list.length) rooms.push({ room, groups: list, total: round2(list.reduce((s, g) => s + g.sum, 0)) });
  }
  const extra = detailed.extra;
  const missing = rooms.reduce((s, r) => s + r.groups.reduce((a, g) => a + g.missing, 0), 0);
  const subtotal = round2(rooms.reduce((s, r) => s + r.total, 0) + extra.reduce((s, l) => s + l.sum, 0));
  const discount = round2((subtotal * (order.discountPercent || 0)) / 100);
  return { rooms, extra, subtotal, discountPercent: order.discountPercent || 0, discount, total: round2(subtotal - discount), missing };
}
