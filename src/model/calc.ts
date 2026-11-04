import type { ResolvedMeasures } from './measurements';
import type { Material, MeasureKey, Mm, Product, TechSettings } from './types';

/**
 * Расчёт кроя и расхода ткани.
 * Раскладка: X — вдоль рулона (длина), Y — поперёк (ширина рулона).
 */

export interface LayoutPiece {
  x: Mm;
  y: Mm;
  /** Размер вдоль рулона */
  w: Mm;
  /** Размер поперёк рулона */
  h: Mm;
  label: string;
  kind: 'piece' | 'rest';
}

export interface FabricUse {
  role: 'fabric' | 'lining';
  materialId?: string;
  name: string;
  rollWidth: Mm;
  railroaded: boolean;
  rapport: Mm;
  /** Деталей кроя */
  pieceCount: number;
  layout: LayoutPiece[];
  /** Длина ткани по раскладке, мм */
  lengthRaw: Mm;
  /** С запасом и округлением, мм */
  lengthRounded: Mm;
  /** Остаток полезной ширины (полосы вдоль рулона), м² */
  restArea: number;
  usedArea: number;
}

export interface ProductCalc {
  productId: string;
  finishedWidth?: Mm;
  finishedHeight?: Mm;
  /** Ширина одного готового полотна */
  panelWidth?: Mm;
  /** Ширина кроя одного полотна (в разложенном виде) */
  cutWidth?: Mm;
  /** Длина кроя */
  cutLength?: Mm;
  stripsPerPanel?: number;
  fabric?: FabricUse;
  lining?: FabricUse;
  /** Шторная лента, мм */
  tapeLength?: Mm;
  /** Римская: реек */
  rods?: number;
  /** Площадь готового изделия, м² */
  area?: number;
  warnings: string[];
  /** Пошаговые пояснения для швеи и для проверки */
  steps: string[];
}

export interface CalcContext {
  resolved: ResolvedMeasures;
  tech: TechSettings;
  materials: Map<string, Material>;
}

const fmt = (n: number) => Math.round(n).toLocaleString('ru-RU');
const dec = (n: number) => n.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
const m = (mm: number) => (mm / 1000).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function roundUp(value: Mm, step: Mm): Mm {
  if (step <= 0) return Math.ceil(value);
  return Math.ceil(value / step - 1e-9) * step;
}

/** Готовые размеры изделия: из самого изделия, иначе из замеров */
export function productSize(p: Product, r: ResolvedMeasures): { width?: Mm; height?: Mm; widthSource: string; heightSource: string } {
  const v = (k: MeasureKey) => r.values[k]?.value;
  if (p.type === 'roman' || p.type === 'roller') {
    const ow = v('openingWidth');
    const ch = v('corniceHeight');
    const sill = v('sillHeight');
    const top = sill !== undefined && v('openingHeight') !== undefined ? sill + v('openingHeight')! : undefined;
    const mountY = ch ?? (top !== undefined ? top + 100 : undefined);
    return {
      width: p.width ?? (ow !== undefined ? ow + 100 : undefined),
      height: p.height ?? (mountY !== undefined && sill !== undefined ? mountY - sill : undefined),
      widthSource: p.width ? 'задана' : 'проём + 2 × 50 мм',
      heightSource: p.height ? 'задана' : 'от карниза до подоконника',
    };
  }
  return {
    width: p.width ?? v('productWidth'),
    height: p.height ?? v('productHeight'),
    widthSource: p.width ? 'задана' : 'из замеров',
    heightSource: p.height ? 'задана' : 'из замеров',
  };
}

interface StripPlan {
  /** Длина каждой детали вдоль рулона */
  length: Mm;
  /** Ширины деталей поперёк рулона, с подписями */
  widths: { w: Mm; label: string }[];
}

/**
 * Раскладывает полосы одной длины поперёк рулона.
 * Целые полосы занимают всю ширину; неполные складываются вместе,
 * если помещаются в одну ширину (first-fit по убыванию).
 */
function layoutStrips(plan: StripPlan, rollWidth: Mm, startX: Mm): { pieces: LayoutPiece[]; rows: number } {
  const sorted = [...plan.widths].sort((a, b) => b.w - a.w);
  const rows: { used: Mm; items: { w: Mm; label: string }[] }[] = [];
  for (const it of sorted) {
    const row = rows.find((r) => r.used + it.w <= rollWidth + 0.5);
    if (row) {
      row.items.push(it);
      row.used += it.w;
    } else rows.push({ used: it.w, items: [it] });
  }
  const pieces: LayoutPiece[] = [];
  rows.forEach((row, i) => {
    let y = 0;
    for (const it of row.items) {
      pieces.push({ x: startX + i * plan.length, y, w: plan.length, h: it.w, label: it.label, kind: 'piece' });
      y += it.w;
    }
    if (rollWidth - y > 1) pieces.push({ x: startX + i * plan.length, y, w: plan.length, h: rollWidth - y, label: 'остаток', kind: 'rest' });
  });
  return { pieces, rows: rows.length };
}

function fabricUse(
  role: FabricUse['role'],
  mat: Material | undefined,
  fallbackRoll: Mm,
  panels: number,
  cutWidth: Mm,
  cutLength: Mm,
  tech: TechSettings,
  warnings: string[],
  steps: string[],
  allowJoin = true,
): { use: FabricUse; strips: number } {
  const roleName = role === 'fabric' ? 'Ткань' : 'Подкладка';
  let rollWidth = mat?.rollWidth ?? 0;
  if (!rollWidth) {
    rollWidth = fallbackRoll;
    warnings.push(`${roleName}: не задана ширина рулона — посчитано для ${fmt(rollWidth)} мм. Укажите ширину в справочнике.`);
  }
  const rapport = mat?.rapport ?? 0;
  let railroaded = !!mat?.railroaded;
  const seam = tech.seamAllowance;
  const pieces: LayoutPiece[] = [];
  let length = 0;
  let strips = 1;

  if (railroaded && cutLength > rollWidth) {
    warnings.push(`${roleName}: длина кроя ${fmt(cutLength)} мм больше ширины рулона ${fmt(rollWidth)} мм — «в высоту» не помещается, посчитано как ткань «в рост».`);
    railroaded = false;
  }

  if (railroaded) {
    // Каждое полотно — одна деталь: ширина кроя идёт вдоль рулона, высота — поперёк
    for (let i = 0; i < panels; i++) {
      pieces.push({ x: length, y: 0, w: cutWidth, h: cutLength, label: `полотно ${i + 1}`, kind: 'piece' });
      if (rollWidth - cutLength > 1) pieces.push({ x: length, y: cutLength, w: cutWidth, h: rollWidth - cutLength, label: 'остаток', kind: 'rest' });
      length += cutWidth;
    }
    steps.push(`${roleName} «в высоту»: ${panels} × ${fmt(cutWidth)} мм вдоль рулона = ${fmt(length)} мм.`);
  } else {
    // Сколько полос сшить, чтобы набрать ширину кроя (на каждом шве теряется 2 припуска)
    strips = 1;
    while (strips * rollWidth - 2 * seam * (strips - 1) < cutWidth) strips++;
    if (strips > 1 && !allowJoin) warnings.push(`${roleName}: ширина кроя ${fmt(cutWidth)} мм больше ширины рулона — понадобится шов по ширине.`);
    const stripLength = rapport > 0 ? roundUp(cutLength, rapport) : cutLength;
    if (rapport > 0 && stripLength !== cutLength) steps.push(`Раппорт ${fmt(rapport)} мм: длина полосы ${fmt(cutLength)} → ${fmt(stripLength)} мм.`);
    const widths: StripPlan['widths'] = [];
    for (let p = 0; p < panels; p++) {
      for (let s = 0; s < strips; s++) {
        const last = s === strips - 1;
        // последняя полоса: недостающая ширина (на каждом шве уходит по припуску с двух полос)
        const w = last ? cutWidth - (strips - 1) * (rollWidth - 2 * seam) : rollWidth;
        widths.push({ w: Math.min(rollWidth, Math.round(w)), label: strips > 1 ? `полотно ${p + 1}.${s + 1}` : `полотно ${p + 1}` });
      }
    }
    const res = layoutStrips({ length: stripLength, widths }, rollWidth, 0);
    pieces.push(...res.pieces);
    length = res.rows * stripLength;
    if (rapport > 0 && res.rows > 1) {
      length += rapport;
      steps.push(`Запас на совмещение рисунка: + ${fmt(rapport)} мм.`);
    }
    steps.push(
      `${roleName} «в рост»: на полотно ${strips} ${strips === 1 ? 'полоса' : strips < 5 ? 'полосы' : 'полос'} по ${fmt(rollWidth)} мм; ` +
        `всего по раскладке ${res.rows} × ${fmt(stripLength)} мм = ${fmt(length)} мм.`,
    );
  }

  const withReserve = length * (1 + tech.reservePercent / 100);
  const lengthRounded = roundUp(withReserve, tech.roundStep);
  if (tech.reservePercent) steps.push(`Запас ${tech.reservePercent}%: ${fmt(withReserve)} мм.`);
  steps.push(`${roleName} к закупке: ${m(lengthRounded)} м.`);

  const usedArea = pieces.filter((p) => p.kind === 'piece').reduce((s, p) => s + p.w * p.h, 0) / 1e6;
  const restArea = pieces.filter((p) => p.kind === 'rest').reduce((s, p) => s + p.w * p.h, 0) / 1e6;

  return {
    use: {
      role,
      materialId: mat?.id,
      name: mat?.name ?? (role === 'fabric' ? 'Ткань не выбрана' : 'Подкладка'),
      rollWidth,
      railroaded,
      rapport,
      pieceCount: pieces.filter((p) => p.kind === 'piece').length,
      layout: pieces,
      lengthRaw: length,
      lengthRounded,
      restArea,
      usedArea,
    },
    strips,
  };
}

export function calcProduct(p: Product, ctx: CalcContext): ProductCalc {
  const tech: TechSettings = { ...ctx.tech, ...p.tech };
  const warnings: string[] = [];
  const steps: string[] = [];
  const size = productSize(p, ctx.resolved);
  const out: ProductCalc = { productId: p.id, finishedWidth: size.width, finishedHeight: size.height, warnings, steps };

  if (!size.width || size.width <= 0) warnings.push('Не задана ширина изделия — введите замеры или ширину вручную.');
  if (!size.height || size.height <= 0) warnings.push('Не задана высота изделия — введите замеры или высоту вручную.');
  if (!size.width || !size.height || size.width <= 0 || size.height <= 0) return out;

  const W = size.width;
  const H = size.height;
  const n = Math.max(1, Math.round(p.panels));
  const fabric = p.fabricId ? ctx.materials.get(p.fabricId) : undefined;
  if (!fabric) warnings.push('Ткань не выбрана — расход посчитан для ширины рулона по умолчанию, без цены.');
  steps.push(`Готовое изделие: ${fmt(W)} × ${fmt(H)} мм (ширина ${size.widthSource}, высота ${size.heightSource}).`);

  if (p.type === 'classic' || p.type === 'tulle') {
    const K = p.fullness > 0 ? p.fullness : 1;
    const panelW = W / n;
    const cutW = Math.round(panelW * K + 2 * tech.sideHem);
    const cutL = Math.round(H + tech.topAllowance + tech.bottomHem);
    Object.assign(out, { panelWidth: Math.round(panelW), cutWidth: cutW, cutLength: cutL });
    steps.push(`Полотен: ${n}, ширина полотна ${fmt(panelW)} мм, сборка ×${dec(K)}.`);
    steps.push(`Ширина кроя: ${fmt(panelW)} × ${dec(K)} + 2 × ${fmt(tech.sideHem)} (боковые подгибы) = ${fmt(cutW)} мм.`);
    steps.push(`Длина кроя: ${fmt(H)} + ${fmt(tech.topAllowance)} (верх) + ${fmt(tech.bottomHem)} (низ) = ${fmt(cutL)} мм.`);
    const fallbackRoll = p.type === 'tulle' ? 2800 : 1400;
    const f = fabricUse('fabric', fabric, fallbackRoll, n, cutW, cutL, tech, warnings, steps);
    out.fabric = f.use;
    out.stripsPerPanel = f.strips;

    if (p.type === 'classic' && p.liningId) {
      const lin = ctx.materials.get(p.liningId);
      const linW = Math.round(panelW * K);
      const linL = Math.round(H + tech.topAllowance + tech.bottomHem / 2);
      steps.push(`Подкладка: ширина кроя ${fmt(linW)} мм (без боковых подгибов), длина ${fmt(linL)} мм.`);
      out.lining = fabricUse('lining', lin, 1500, n, linW, linL, tech, warnings, steps).use;
    }
    const tape = roundUp(n * (cutW - tech.sideHem) + n * 100, 100);
    out.tapeLength = tape;
    steps.push(`Шторная лента: ${n} × (${fmt(cutW)} − ${fmt(tech.sideHem)}) + запас 100 мм на полотно = ${m(tape)} м.`);
    if (K < 1.5) warnings.push(`Коэффициент сборки ×${dec(K)} — складки будут почти незаметны (обычно 1,5–3).`);
  } else if (p.type === 'roman') {
    const panelW = W / n;
    const rods = Math.max(1, Math.ceil(H / tech.romanRodStep) - 1);
    const cutW = Math.round(panelW + 2 * tech.sideHem);
    const cutL = Math.round(H + tech.topAllowance + tech.bottomHem + rods * tech.romanPocket);
    Object.assign(out, { panelWidth: Math.round(panelW), cutWidth: cutW, cutLength: cutL, rods: rods * n });
    steps.push(`Реек: ${rods} на полотно (шаг ${fmt(tech.romanRodStep)} мм), всего ${rods * n}.`);
    steps.push(`Ширина кроя: ${fmt(panelW)} + 2 × ${fmt(tech.sideHem)} = ${fmt(cutW)} мм.`);
    steps.push(`Длина кроя: ${fmt(H)} + ${fmt(tech.topAllowance)} + ${fmt(tech.bottomHem)} + ${rods} × ${fmt(tech.romanPocket)} (кулисы) = ${fmt(cutL)} мм.`);
    const f = fabricUse('fabric', fabric, 1500, n, cutW, cutL, tech, warnings, steps, false);
    out.fabric = f.use;
    out.stripsPerPanel = f.strips;
  } else {
    // Рулонная: полотно цельное, ширина не больше ширины рулона ткани
    const panelW = W / n;
    const cutL = Math.round(H + 300);
    Object.assign(out, { panelWidth: Math.round(panelW), cutWidth: Math.round(panelW), cutLength: cutL });
    out.area = (W * H) / 1e6;
    steps.push(`Полотно: ${fmt(panelW)} × ${fmt(H)} мм, + 300 мм на вал и утяжелитель.`);
    const f = fabricUse('fabric', fabric, 2000, n, Math.round(panelW), cutL, tech, warnings, steps, false);
    out.fabric = f.use;
    out.stripsPerPanel = f.strips;
    steps.push(`Площадь готового изделия: ${out.area.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} м².`);
  }
  return out;
}

/** Кронштейнов по длине карниза: по краям и не реже чем через 1,5 м */
export function bracketCount(corniceLength: Mm): number {
  return Math.max(2, Math.ceil(corniceLength / 1500) + 1);
}
