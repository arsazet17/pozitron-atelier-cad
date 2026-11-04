import type { MeasureKey, Mm, WindowItem } from './types';

/**
 * Описание всех размеров окна и правила их связи.
 * Замерщик вводит то, что измерил; недостающие звенья цепочек
 * вычисляются, а лишние — проверяются на сходимость.
 */

export type MeasureGroup = 'wall' | 'opening' | 'sill' | 'radiator' | 'cornice' | 'product';

export interface MeasureDef {
  key: MeasureKey;
  label: string;
  /** Короткая подпись для чертежа */
  short: string;
  group: MeasureGroup;
  hint: string;
  /** Поле показывается, только если выполнено условие */
  visible?: (w: Pick<WindowItem, 'hasRadiator' | 'corniceMount'>) => boolean;
}

export const GROUP_LABEL: Record<MeasureGroup, string> = {
  wall: 'Стена и помещение',
  opening: 'Оконный проём',
  sill: 'Подоконник',
  radiator: 'Батарея',
  cornice: 'Карниз',
  product: 'Предполагаемое изделие',
};

const withRadiator = (w: Pick<WindowItem, 'hasRadiator'>) => w.hasRadiator;

export const MEASURE_DEFS: MeasureDef[] = [
  { key: 'wallWidth', label: 'Ширина стены', short: 'стена', group: 'wall', hint: 'От угла до угла по стене с окном' },
  { key: 'leftPier', label: 'Простенок слева', short: 'простенок', group: 'wall', hint: 'От левого угла стены до проёма' },
  { key: 'rightPier', label: 'Простенок справа', short: 'простенок', group: 'wall', hint: 'От проёма до правого угла стены' },
  { key: 'ceilingHeight', label: 'Высота помещения', short: 'пол — потолок', group: 'wall', hint: 'От чистового пола до потолка' },

  { key: 'openingWidth', label: 'Ширина проёма', short: 'проём', group: 'opening', hint: 'По внешней кромке откосов' },
  { key: 'openingHeight', label: 'Высота проёма', short: 'проём', group: 'opening', hint: 'От подоконника до верха проёма' },
  { key: 'sillHeight', label: 'Расстояние до пола', short: 'до пола', group: 'opening', hint: 'От пола до низа проёма (верх подоконника)' },
  { key: 'topToCeiling', label: 'Расстояние до потолка', short: 'до потолка', group: 'opening', hint: 'От верха проёма до потолка' },

  { key: 'sillDepth', label: 'Выступ подоконника', short: 'выступ', group: 'sill', hint: 'Насколько подоконник выходит от стены в комнату' },
  { key: 'sillLength', label: 'Длина подоконника', short: 'подоконник', group: 'sill', hint: 'Полная длина вдоль стены' },

  { key: 'radiatorWidth', label: 'Ширина батареи', short: 'батарея', group: 'radiator', hint: 'По внешним точкам', visible: withRadiator },
  { key: 'radiatorHeight', label: 'Высота батареи', short: 'батарея', group: 'radiator', hint: '', visible: withRadiator },
  { key: 'radiatorFromFloor', label: 'Батарея от пола', short: 'от пола', group: 'radiator', hint: 'От пола до низа батареи', visible: withRadiator },
  { key: 'radiatorOffset', label: 'Смещение батареи', short: 'смещение', group: 'radiator', hint: 'От левого края проёма до левого края батареи (влево — минус)', visible: withRadiator },
  { key: 'radiatorDepth', label: 'Выступ батареи', short: 'выступ', group: 'radiator', hint: 'От стены до передней точки батареи', visible: withRadiator },

  { key: 'corniceLength', label: 'Длина карниза', short: 'карниз', group: 'cornice', hint: 'Полная длина без наконечников' },
  { key: 'corniceOverhangLeft', label: 'Заход карниза слева', short: 'заход', group: 'cornice', hint: 'На сколько карниз выходит за левый край проёма' },
  { key: 'corniceOverhangRight', label: 'Заход карниза справа', short: 'заход', group: 'cornice', hint: 'На сколько карниз выходит за правый край проёма' },
  { key: 'corniceHeight', label: 'Высота установки карниза', short: 'карниз от пола', group: 'cornice', hint: 'От пола до точки подвеса (крючков)' },
  { key: 'corniceToCeiling', label: 'Карниз — потолок', short: 'до потолка', group: 'cornice', hint: 'От точки подвеса до потолка' },
  { key: 'corniceProjection', label: 'Вынос карниза от стены', short: 'вынос', group: 'cornice', hint: 'От стены до ближнего ряда' },

  { key: 'productWidth', label: 'Ширина изделия', short: 'изделие', group: 'product', hint: 'По умолчанию равна длине карниза' },
  { key: 'floorClearance', label: 'Зазор до пола', short: 'зазор', group: 'product', hint: 'Сколько не доходит низ изделия до пола (0 — в пол)' },
  { key: 'productHeight', label: 'Высота изделия', short: 'изделие', group: 'product', hint: 'По умолчанию: высота карниза минус зазор до пола' },
];

export const DEF_BY_KEY: Record<MeasureKey, MeasureDef> = Object.fromEntries(
  MEASURE_DEFS.map((d) => [d.key, d]),
) as Record<MeasureKey, MeasureDef>;

/** Цепочка размеров: total = сумма parts. Недостающее звено вычисляется. */
export interface Chain {
  id: string;
  title: string;
  total: MeasureKey;
  parts: MeasureKey[];
  /** Цепочка участвует, только если выполнено условие */
  when?: (w: Pick<WindowItem, 'hasRadiator' | 'corniceMount'>) => boolean;
}

export const CHAINS: Chain[] = [
  { id: 'horizontal', title: 'Стена по горизонтали', total: 'wallWidth', parts: ['leftPier', 'openingWidth', 'rightPier'] },
  { id: 'vertical', title: 'Стена по вертикали', total: 'ceilingHeight', parts: ['sillHeight', 'openingHeight', 'topToCeiling'] },
  { id: 'cornice', title: 'Длина карниза', total: 'corniceLength', parts: ['corniceOverhangLeft', 'openingWidth', 'corniceOverhangRight'] },
  { id: 'corniceVertical', title: 'Карниз по вертикали', total: 'ceilingHeight', parts: ['corniceHeight', 'corniceToCeiling'] },
];

/** Допуск сходимости цепочки, мм */
export const CHAIN_TOLERANCE: Mm = 3;

export type ValueSource = 'measured' | 'derived' | 'default';

export interface ResolvedValue {
  value: Mm;
  source: ValueSource;
  /** Как получено вычисленное значение — для подсказки */
  formula?: string;
}

export type IssueLevel = 'error' | 'warning';

export interface MeasureIssue {
  level: IssueLevel;
  keys: MeasureKey[];
  message: string;
}

export interface ResolvedMeasures {
  values: Partial<Record<MeasureKey, ResolvedValue>>;
  issues: MeasureIssue[];
}

/** 3400 → «3 400», −50 → «−50» (типографский минус) */
const fmt = (n: Mm) => (n < 0 ? '−' : '') + Math.abs(n).toLocaleString('ru-RU');

function isSet(v: Mm | undefined): v is Mm {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Разбор ввода в целые миллиметры. Пусто → undefined. */
export function parseMm(text: string): Mm | undefined | 'invalid' {
  const t = text.replace(/\s/g, '').replace(',', '.');
  if (t === '' || t === '-') return undefined;
  if (!/^-?\d+(\.\d+)?$/.test(t)) return 'invalid';
  return Math.round(Number(t));
}

export function isFieldVisible(def: MeasureDef, w: Pick<WindowItem, 'hasRadiator' | 'corniceMount'>): boolean {
  return def.visible ? def.visible(w) : true;
}

/**
 * Сводит введённые размеры в полную картину:
 * 1) недостающее звено каждой цепочки вычисляется (повторяется, пока что-то меняется);
 * 2) полностью заданные цепочки проверяются на сходимость;
 * 3) размеры изделия получают значения по умолчанию;
 * 4) проверяются физические ограничения.
 */
export function resolveMeasures(w: Pick<WindowItem, 'measures' | 'hasRadiator' | 'corniceMount'>): ResolvedMeasures {
  const values: Partial<Record<MeasureKey, ResolvedValue>> = {};
  const issues: MeasureIssue[] = [];

  for (const def of MEASURE_DEFS) {
    const v = w.measures[def.key];
    if (isSet(v) && isFieldVisible(def, w)) values[def.key] = { value: v, source: 'measured' };
  }

  const get = (k: MeasureKey) => values[k]?.value;
  const chains = CHAINS.filter((c) => (c.when ? c.when(w) : true));

  // 1. Вычисление недостающих звеньев
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 10) {
    changed = false;
    for (const c of chains) {
      const members = [c.total, ...c.parts];
      const missing = members.filter((k) => !isSet(get(k)));
      if (missing.length !== 1) continue;
      const k = missing[0];
      const partsSum = c.parts.filter((p) => p !== k).reduce((s, p) => s + (get(p) as Mm), 0);
      if (k === c.total) {
        values[k] = {
          value: partsSum,
          source: 'derived',
          formula: c.parts.map((p) => DEF_BY_KEY[p].label.toLowerCase()).join(' + '),
        };
      } else {
        const others = c.parts.filter((p) => p !== k).map((p) => DEF_BY_KEY[p].label.toLowerCase());
        values[k] = {
          value: (get(c.total) as Mm) - partsSum,
          source: 'derived',
          formula: `${DEF_BY_KEY[c.total].label.toLowerCase()} − ${others.join(' − ')}`,
        };
      }
      changed = true;
    }
  }

  // 2. Сходимость полностью заданных цепочек
  for (const c of chains) {
    const members = [c.total, ...c.parts];
    if (!members.every((k) => isSet(get(k)))) continue;
    // Звено, вычисленное из этой же цепочки, сходится само; проверка ловит
    // противоречия между цепочками с общими звеньями (ширина проёма, высота помещения).
    const sum = c.parts.reduce((s, p) => s + (get(p) as Mm), 0);
    const total = get(c.total) as Mm;
    const diff = total - sum;
    if (Math.abs(diff) > CHAIN_TOLERANCE) {
      issues.push({
        level: 'error',
        keys: members,
        message: `${c.title}: ${DEF_BY_KEY[c.total].label.toLowerCase()} ${fmt(total)} мм, а сумма звеньев ${fmt(sum)} мм — расхождение ${diff > 0 ? '+' : ''}${fmt(diff)} мм. Перемерьте одно из звеньев.`,
      });
    }
  }

  // 3. Изделие по умолчанию
  if (!isSet(get('productWidth')) && isSet(get('corniceLength'))) {
    values.productWidth = { value: get('corniceLength') as Mm, source: 'default', formula: 'равна длине карниза' };
  }
  if (!isSet(get('productHeight')) && isSet(get('corniceHeight'))) {
    const clearance = get('floorClearance') ?? 0;
    values.productHeight = {
      value: (get('corniceHeight') as Mm) - clearance,
      source: 'default',
      formula: isSet(get('floorClearance')) ? 'высота карниза − зазор до пола' : 'высота карниза (зазор до пола не задан)',
    };
  }

  // 4. Физические ограничения
  for (const [k, rv] of Object.entries(values) as [MeasureKey, ResolvedValue][]) {
    if (k === 'radiatorOffset') continue; // может быть отрицательным
    if (k === 'floorClearance' && rv.value === 0) continue;
    if (rv.value <= 0) {
      issues.push({
        level: 'error',
        keys: [k],
        message:
          rv.source === 'measured'
            ? `${DEF_BY_KEY[k].label}: размер должен быть больше нуля.`
            : `${DEF_BY_KEY[k].label} получается ${fmt(rv.value)} мм — проверьте связанные размеры.`,
      });
    } else if (rv.value > 30000) {
      issues.push({ level: 'error', keys: [k], message: `${DEF_BY_KEY[k].label}: ${fmt(rv.value)} мм — похоже на опечатку.` });
    }
  }

  const ceiling = get('ceilingHeight');
  const openingTop = isSet(get('sillHeight')) && isSet(get('openingHeight')) ? (get('sillHeight') as Mm) + (get('openingHeight') as Mm) : undefined;
  const cornice = get('corniceHeight');
  if (isSet(cornice) && isSet(openingTop) && w.corniceMount === 'wall' && cornice < openingTop) {
    issues.push({
      level: 'warning',
      keys: ['corniceHeight'],
      message: `Карниз (${fmt(cornice)} мм) ниже верха проёма (${fmt(openingTop)} мм). Проверьте высоту установки.`,
    });
  }
  if (isSet(cornice) && isSet(ceiling) && cornice > ceiling) {
    issues.push({ level: 'error', keys: ['corniceHeight'], message: 'Карниз выше потолка.' });
  }
  const pw = get('productWidth');
  const cl = get('corniceLength');
  if (isSet(pw) && isSet(cl) && pw > cl) {
    issues.push({
      level: 'warning',
      keys: ['productWidth'],
      message: `Ширина изделия (${fmt(pw)} мм) больше длины карниза (${fmt(cl)} мм).`,
    });
  }
  const ph = get('productHeight');
  if (isSet(ph) && isSet(cornice) && ph > cornice) {
    issues.push({
      level: 'warning',
      keys: ['productHeight'],
      message: `Высота изделия (${fmt(ph)} мм) больше высоты карниза (${fmt(cornice)} мм) — изделие ляжет на пол.`,
    });
  }
  if (w.hasRadiator) {
    const rf = get('radiatorFromFloor');
    const rh = get('radiatorHeight');
    const sill = get('sillHeight');
    if (isSet(rf) && isSet(rh) && isSet(sill) && rf + rh > sill) {
      issues.push({ level: 'warning', keys: ['radiatorHeight', 'radiatorFromFloor'], message: 'Батарея заходит выше подоконника — проверьте её размеры.' });
    }
  }

  return { values, issues };
}

/** Сколько обязательных для чертежа размеров уже известно */
export const CORE_KEYS: MeasureKey[] = ['openingWidth', 'openingHeight', 'sillHeight', 'ceilingHeight', 'corniceLength', 'corniceHeight'];

export function completeness(r: ResolvedMeasures): { known: number; total: number } {
  return { known: CORE_KEYS.filter((k) => r.values[k] !== undefined).length, total: CORE_KEYS.length };
}

export function formatMm(v: Mm | undefined): string {
  return v === undefined ? '—' : fmt(v);
}
