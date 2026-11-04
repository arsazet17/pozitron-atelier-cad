import type { ReactNode } from 'react';
import type { ResolvedMeasures } from '../model/measurements';
import type { MeasureKey, WindowItem } from '../model/types';
import { facadeGeometry } from './geometry';

/**
 * Схема фасада окна с размерными цепочками.
 * Нажатие на размер выбирает соответствующее поле ввода.
 * Это схема для замера; полноценный чертёж с листом и штампом — шаг 3.
 */

/** Изделие на чертеже, в координатах стены */
export interface DrawnProduct {
  id: string;
  name: string;
  type: 'classic' | 'tulle' | 'roman' | 'roller';
  x: number;
  y: number;
  w: number;
  h: number;
  panels: number;
}

interface Props {
  win: Pick<WindowItem, 'hasRadiator' | 'corniceMount'>;
  resolved: ResolvedMeasures;
  focus?: MeasureKey;
  errorKeys: Set<MeasureKey>;
  onPick?: (key: MeasureKey) => void;
  /** Миниатюра без размеров — для плиток окон */
  mini?: boolean;
  className?: string;
  /** Размещение внутри листа чертежа (вложенный svg) */
  frame?: { x: number; y: number; width: number; height: number };
  /** Размер шрифта в мм стены; по умолчанию — от размера стены */
  fontMm?: number;
  /** Изделия; если заданы — рисуются вместо общего контура изделия */
  products?: DrawnProduct[];
}

const fmt = (n: number) => (n < 0 ? '−' : '') + Math.round(Math.abs(n)).toLocaleString('ru-RU');

function layout(W: number, H: number, mini?: boolean, fontMm?: number) {
  const S = Math.max(W, H);
  const fs = fontMm ?? S * 0.03; // размер шрифта
  const sw = fontMm ? fontMm / 21 : S / 700; // толщина тонкой линии
  const tier = fs * 2.6; // шаг ярусов размерных линий
  const gap = fs * 1.4; // отступ первого яруса от контура
  const m = mini ? S * 0.04 : 0;
  const left = mini ? -m : -(gap + tier * 2 + fs);
  const right = mini ? W + m : W + gap + tier * 2 + fs;
  const topY = mini ? -(H + m) : -(H + gap + tier * 2 + fs * 0.6);
  const bottomY = mini ? m : gap + tier * 2 + fs * 0.6;
  return { S, fs, sw, tier, gap, left, right, topY, bottomY };
}

/** Габарит схемы с размерными линиями, мм стены */
export function facadeBounds(win: Pick<WindowItem, 'hasRadiator' | 'corniceMount'>, resolved: ResolvedMeasures, fontMm?: number) {
  const g = facadeGeometry(win, resolved);
  const l = layout(g.wall.width, g.wall.height, false, fontMm);
  return { left: l.left, top: l.topY, width: l.right - l.left, height: l.bottomY - l.topY };
}

export function FacadeSchematic({ win, resolved, focus, errorKeys, onPick, mini, className, frame, fontMm, products }: Props) {
  const g = facadeGeometry(win, resolved);
  const W = g.wall.width;
  const H = g.wall.height;
  const { S, fs, sw, tier, gap, left, right, topY, bottomY } = layout(W, H, mini, fontMm);
  const Y = (y: number) => -y;

  const color = (key: MeasureKey) =>
    key === focus ? 'var(--accent)' : errorKeys.has(key) ? 'var(--danger)' : 'var(--ink)';

  const label = (key: MeasureKey) => {
    const rv = resolved.values[key];
    if (!rv) return '?';
    return fmt(rv.value);
  };

  /** Горизонтальный размер от x1 до x2 на высоте yLine; база — y0 (откуда выносные). */
  const hdim = (key: MeasureKey, x1: number, x2: number, y0: number, yLine: number): ReactNode => {
    if (Math.abs(x2 - x1) < 1) return null;
    const c = color(key);
    const known = !!resolved.values[key];
    const derived = known && resolved.values[key]!.source !== 'measured';
    const t = fs * 0.35;
    const dir = yLine > y0 ? 1 : -1;
    return (
      <g key={key + x1} className="dim" onClick={() => onPick?.(key)} style={{ cursor: onPick ? 'pointer' : undefined }}>
        <line x1={x1} y1={Y(y0) - dir * fs * 0.3} x2={x1} y2={Y(yLine) - dir * t * 1.6} stroke="var(--line-quiet)" strokeWidth={sw} />
        <line x1={x2} y1={Y(y0) - dir * fs * 0.3} x2={x2} y2={Y(yLine) - dir * t * 1.6} stroke="var(--line-quiet)" strokeWidth={sw} />
        <line x1={x1} y1={Y(yLine)} x2={x2} y2={Y(yLine)} stroke={c} strokeWidth={key === focus ? sw * 2.5 : sw * 1.2} />
        <line x1={x1 - t} y1={Y(yLine) + t} x2={x1 + t} y2={Y(yLine) - t} stroke={c} strokeWidth={sw * 2} />
        <line x1={x2 - t} y1={Y(yLine) + t} x2={x2 + t} y2={Y(yLine) - t} stroke={c} strokeWidth={sw * 2} />
        <rect x={Math.min(x1, x2)} y={Y(yLine) - fs * 1.3} width={Math.abs(x2 - x1)} height={fs * 1.7} fill="transparent" />
        <text
          x={(x1 + x2) / 2}
          y={Y(yLine) - fs * 0.35}
          fontSize={fs}
          textAnchor="middle"
          fill={known ? c : 'var(--accent)'}
          fontStyle={derived ? 'italic' : undefined}
          fontWeight={key === focus ? 700 : 500}
        >
          {label(key)}
        </text>
      </g>
    );
  };

  /** Вертикальный размер от y1 до y2 на абсциссе xLine; база — x0. */
  const vdim = (key: MeasureKey, y1: number, y2: number, x0: number, xLine: number): ReactNode => {
    if (Math.abs(y2 - y1) < 1) return null;
    const c = color(key);
    const known = !!resolved.values[key];
    const derived = known && resolved.values[key]!.source !== 'measured';
    const t = fs * 0.35;
    const dir = xLine > x0 ? 1 : -1;
    const ty = (Y(y1) + Y(y2)) / 2;
    const tx = xLine - fs * 0.35;
    return (
      <g key={key + y1} className="dim" onClick={() => onPick?.(key)} style={{ cursor: onPick ? 'pointer' : undefined }}>
        <line x1={x0 + dir * fs * 0.3} y1={Y(y1)} x2={xLine + dir * t * 1.6} y2={Y(y1)} stroke="var(--line-quiet)" strokeWidth={sw} />
        <line x1={x0 + dir * fs * 0.3} y1={Y(y2)} x2={xLine + dir * t * 1.6} y2={Y(y2)} stroke="var(--line-quiet)" strokeWidth={sw} />
        <line x1={xLine} y1={Y(y1)} x2={xLine} y2={Y(y2)} stroke={c} strokeWidth={key === focus ? sw * 2.5 : sw * 1.2} />
        <line x1={xLine - t} y1={Y(y1) + t} x2={xLine + t} y2={Y(y1) - t} stroke={c} strokeWidth={sw * 2} />
        <line x1={xLine - t} y1={Y(y2) + t} x2={xLine + t} y2={Y(y2) - t} stroke={c} strokeWidth={sw * 2} />
        <rect x={xLine - fs * 1.3} y={Math.min(Y(y1), Y(y2))} width={fs * 1.7} height={Math.abs(y2 - y1)} fill="transparent" />
        <text
          x={tx}
          y={ty}
          fontSize={fs}
          textAnchor="middle"
          transform={`rotate(-90 ${tx} ${ty})`}
          fill={known ? c : 'var(--accent)'}
          fontStyle={derived ? 'italic' : undefined}
          fontWeight={key === focus ? 700 : 500}
        >
          {label(key)}
        </text>
      </g>
    );
  };

  /** Размер изделия (не поле замера): горизонтальный, на высоте y */
  const pdim = (x1: number, x2: number, y: number, text: string, key: string): ReactNode => {
    const t = fs * 0.3;
    return (
      <g key={key} className="dim">
        <line x1={x1} y1={Y(y)} x2={x2} y2={Y(y)} stroke="var(--ink)" strokeWidth={sw} />
        <line x1={x1 - t} y1={Y(y) + t} x2={x1 + t} y2={Y(y) - t} stroke="var(--ink)" strokeWidth={sw * 1.8} />
        <line x1={x2 - t} y1={Y(y) + t} x2={x2 + t} y2={Y(y) - t} stroke="var(--ink)" strokeWidth={sw * 1.8} />
        <text x={(x1 + x2) / 2} y={Y(y) - fs * 0.3} fontSize={fs * 0.85} textAnchor="middle" fill="var(--ink)">
          {text}
        </text>
      </g>
    );
  };
  /** Вертикальный размер изделия */
  const pvdim = (y1: number, y2: number, x0: number, xLine: number, text: string): ReactNode => {
    const t = fs * 0.35;
    const ty = (Y(y1) + Y(y2)) / 2;
    const tx = xLine - fs * 0.35;
    return (
      <g key={`pv${y1}`} className="dim">
        <line x1={x0 + fs * 0.3} y1={Y(y1)} x2={xLine + t * 1.6} y2={Y(y1)} stroke="var(--line-quiet)" strokeWidth={sw} />
        <line x1={x0 + fs * 0.3} y1={Y(y2)} x2={xLine + t * 1.6} y2={Y(y2)} stroke="var(--line-quiet)" strokeWidth={sw} />
        <line x1={xLine} y1={Y(y1)} x2={xLine} y2={Y(y2)} stroke="var(--ink)" strokeWidth={sw * 1.2} />
        <line x1={xLine - t} y1={Y(y1) + t} x2={xLine + t} y2={Y(y1) - t} stroke="var(--ink)" strokeWidth={sw * 2} />
        <line x1={xLine - t} y1={Y(y2) + t} x2={xLine + t} y2={Y(y2) - t} stroke="var(--ink)" strokeWidth={sw * 2} />
        <text x={tx} y={ty} fontSize={fs} textAnchor="middle" transform={`rotate(-90 ${tx} ${ty})`} fill="var(--ink)" fontWeight={500}>
          {text}
        </text>
      </g>
    );
  };

  const o = g.opening;
  const c = g.cornice;
  const top = o.y + o.h;
  const rowB1 = -(gap); // нижние ярусы (под полом)
  const rowB2 = -(gap + tier);
  const rowT1 = H + gap;
  const rowT2 = H + gap + tier;
  const colL1 = -gap;
  const colL2 = -(gap + tier);
  const colR1 = W + gap;
  const colR2 = W + gap + tier;
  const hl = (k: MeasureKey) => (k === focus ? 'var(--accent)' : undefined);

  return (
    <svg
      className={className ?? (mini ? 'schematic-mini' : 'schematic')}
      viewBox={`${left} ${topY} ${right - left} ${bottomY - topY}`}
      {...(frame ?? {})}
      role="img"
      aria-label="Схема окна с размерами"
      fontFamily="var(--font-ui)"
    >
      <defs>
        <pattern id="hatch" width={S / 60} height={S / 60} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2={S / 60} stroke="var(--line-quiet)" strokeWidth={sw} />
        </pattern>
      </defs>

      {/* стена */}
      <rect x={0} y={Y(H)} width={W} height={H} fill="var(--wall)" stroke="none" />
      <rect x={0} y={Y(0)} width={W} height={fs * 0.6} fill="url(#hatch)" />
      <rect x={0} y={Y(H) - fs * 0.6} width={W} height={fs * 0.6} fill="url(#hatch)" />
      <line x1={0} y1={Y(0)} x2={W} y2={Y(0)} stroke="var(--ink)" strokeWidth={sw * 2.4} />
      <line x1={0} y1={Y(H)} x2={W} y2={Y(H)} stroke="var(--ink)" strokeWidth={sw * 2.4} />
      <line x1={0} y1={Y(0)} x2={0} y2={Y(H)} stroke="var(--ink)" strokeWidth={sw * 1.6} />
      <line x1={W} y1={Y(0)} x2={W} y2={Y(H)} stroke="var(--ink)" strokeWidth={sw * 1.6} />
      {!mini && <text x={W - fs * 0.4} y={Y(0) - fs * 0.5} fontSize={fs * 0.75} textAnchor="end" fill="var(--ink-soft)">пол</text>}
      {!mini && <text x={W - fs * 0.4} y={Y(H) + fs * 1.1} fontSize={fs * 0.75} textAnchor="end" fill="var(--ink-soft)">потолок</text>}

      {/* батарея */}
      {g.radiator && (
        <g>
          <rect x={g.radiator.x} y={Y(g.radiator.y + g.radiator.h)} width={g.radiator.w} height={g.radiator.h} fill="var(--paper)" stroke={hl('radiatorWidth') ?? 'var(--ink-soft)'} strokeWidth={sw * 1.4} rx={sw * 3} />
          {Array.from({ length: Math.max(3, Math.floor(g.radiator.w / 100)) }, (_, i) => {
            const fins = Math.max(3, Math.floor(g.radiator!.w / 100));
            const x = g.radiator!.x + ((i + 1) * g.radiator!.w) / (fins + 1);
            return <line key={i} x1={x} y1={Y(g.radiator!.y + g.radiator!.h * 0.1)} x2={x} y2={Y(g.radiator!.y + g.radiator!.h * 0.9)} stroke="var(--line-quiet)" strokeWidth={sw} />;
          })}
        </g>
      )}

      {/* проём и окно */}
      <rect x={o.x} y={Y(top)} width={o.w} height={o.h} fill="var(--glass)" stroke={hl('openingWidth') ?? hl('openingHeight') ?? 'var(--ink)'} strokeWidth={sw * 2} />
      <line x1={o.x + o.w / 2} y1={Y(top)} x2={o.x + o.w / 2} y2={Y(o.y)} stroke="var(--ink-soft)" strokeWidth={sw * 1.2} />
      <rect x={o.x + o.w * 0.04} y={Y(top - o.h * 0.04)} width={o.w * 0.42} height={o.h * 0.92} fill="none" stroke="var(--ink-soft)" strokeWidth={sw} />
      <rect x={o.x + o.w * 0.54} y={Y(top - o.h * 0.04)} width={o.w * 0.42} height={o.h * 0.92} fill="none" stroke="var(--ink-soft)" strokeWidth={sw} />

      {/* подоконник */}
      <rect x={g.sill.x} y={Y(g.sill.y + g.sill.h)} width={g.sill.w} height={g.sill.h} fill="var(--paper)" stroke={hl('sillLength') ?? 'var(--ink)'} strokeWidth={sw * 1.4} />

      {/* изделия по конструктору */}
      {products?.map((p) => {
        const curtain = p.type === 'classic' || p.type === 'tulle';
        const n = curtain ? Math.max(1, p.panels) : 1;
        const pw = p.w / n;
        return (
          <g key={p.id}>
            {Array.from({ length: n }, (_, i) => (
              <g key={i}>
                <rect
                  x={p.x + i * pw}
                  y={Y(p.y + p.h)}
                  width={pw}
                  height={p.h}
                  fill="var(--fabric)"
                  fillOpacity={p.type === 'tulle' ? 0.06 : 0.14}
                  stroke="var(--ink)"
                  strokeWidth={sw * 1.3}
                  strokeDasharray={p.type === 'tulle' ? `${sw * 6} ${sw * 4}` : undefined}
                />
                {curtain &&
                  Array.from({ length: 3 }, (_, j) => (
                    <line key={j} x1={p.x + i * pw + (pw * (j + 1)) / 4} y1={Y(p.y + p.h) + fs * 0.4} x2={p.x + i * pw + (pw * (j + 1)) / 4} y2={Y(p.y) - fs * 0.4} stroke="var(--line-quiet)" strokeWidth={sw * 0.8} />
                  ))}
                {!mini && n > 1 && pdim(p.x + i * pw, p.x + (i + 1) * pw, p.y + p.h * (p.type === 'tulle' ? 0.12 : 0.2), fmt(pw), `${p.id}-${i}`)}
              </g>
            ))}
            {!mini && (
              <text x={p.x + p.w / 2} y={Y(p.y + p.h) + fs * (p.type === 'tulle' ? 2.6 : 1.4)} fontSize={fs * 0.8} textAnchor="middle" fill="var(--ink)">
                {p.name}
              </text>
            )}
          </g>
        );
      })}

      {/* предполагаемое изделие */}
      {!products && g.product && (
        <g>
          <rect x={g.product.x} y={Y(g.product.y + g.product.h)} width={g.product.w} height={g.product.h} fill="var(--fabric)" fillOpacity={0.28} stroke={hl('productWidth') ?? hl('productHeight') ?? 'var(--fabric)'} strokeWidth={sw * 1.4} strokeDasharray={`${sw * 8} ${sw * 5}`} />
          <text x={g.product.x + g.product.w / 2} y={Y(g.product.y + g.product.h) + fs * 1.6} fontSize={fs * 0.75} textAnchor="middle" fill="var(--ink-soft)">изделие</text>
        </g>
      )}

      {/* карниз */}
      <line x1={c.x1} y1={Y(c.y)} x2={c.x2} y2={Y(c.y)} stroke={hl('corniceLength') ?? hl('corniceHeight') ?? 'var(--metal)'} strokeWidth={sw * 4} strokeLinecap="round" />
      {[c.x1 + (c.x2 - c.x1) * 0.06, (c.x1 + c.x2) / 2, c.x2 - (c.x2 - c.x1) * 0.06].map((x) => (
        <rect key={x} x={x - sw * 4} y={Y(c.y) - sw * 3} width={sw * 8} height={sw * 10} fill="var(--metal)" />
      ))}

      {!mini && <>
      {/* размеры: низ — стена по горизонтали */}
      {hdim('leftPier', 0, o.x, 0, rowB1)}
      {hdim('openingWidth', o.x, o.x + o.w, o.y, rowB1)}
      {hdim('rightPier', o.x + o.w, W, 0, rowB1)}
      {hdim('wallWidth', 0, W, 0, rowB2)}

      {/* верх — карниз */}
      {hdim('corniceOverhangLeft', c.x1, o.x, c.y, rowT1)}
      {hdim('corniceOverhangRight', o.x + o.w, c.x2, c.y, rowT1)}
      {hdim('corniceLength', c.x1, c.x2, c.y, rowT2)}

      {/* слева — вертикальная цепочка проёма */}
      {vdim('sillHeight', 0, o.y, o.x, colL1)}
      {vdim('openingHeight', o.y, top, o.x, colL1)}
      {vdim('topToCeiling', top, H, o.x, colL1)}
      {vdim('ceilingHeight', 0, H, 0, colL2)}

      {/* справа — карниз и изделие */}
      {win.corniceMount === 'wall' && vdim('corniceHeight', 0, c.y, c.x2, colR1)}
      {win.corniceMount === 'wall' && vdim('corniceToCeiling', c.y, H, c.x2, colR1)}
      {!products && g.product && vdim('productHeight', g.product.y, g.product.y + g.product.h, g.product.x + g.product.w, colR2)}
      {!products && g.product && g.product.y > 1 && vdim('floorClearance', 0, g.product.y, g.product.x + g.product.w, colR2)}
      {products?.[0] && pvdim(products[0].y, products[0].y + products[0].h, products[0].x + products[0].w, colR2, fmt(products[0].h))}
      {products?.[0] && products[0].y > 1 && pvdim(0, products[0].y, products[0].x + products[0].w, colR2, fmt(products[0].y))}

      {/* батарея — местные размеры */}
      {g.radiator && hdim('radiatorWidth', g.radiator.x, g.radiator.x + g.radiator.w, g.radiator.y + g.radiator.h, g.radiator.y + g.radiator.h + fs * 0.7)}
      {g.radiator && vdim('radiatorHeight', g.radiator.y, g.radiator.y + g.radiator.h, g.radiator.x, g.radiator.x - fs * 1.1)}
      </>}
    </svg>
  );
}
