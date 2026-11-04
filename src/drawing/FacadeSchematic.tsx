import type { ReactNode } from 'react';
import type { ResolvedMeasures } from '../model/measurements';
import type { MeasureKey, WindowItem } from '../model/types';
import { facadeGeometry } from './geometry';

/**
 * Схема фасада окна с размерными цепочками.
 * Нажатие на размер выбирает соответствующее поле ввода.
 * Это схема для замера; полноценный чертёж с листом и штампом — шаг 3.
 */

interface Props {
  win: Pick<WindowItem, 'hasRadiator' | 'corniceMount'>;
  resolved: ResolvedMeasures;
  focus?: MeasureKey;
  errorKeys: Set<MeasureKey>;
  onPick?: (key: MeasureKey) => void;
  /** Миниатюра без размеров — для плиток окон */
  mini?: boolean;
}

const fmt = (n: number) => (n < 0 ? '−' : '') + Math.round(Math.abs(n)).toLocaleString('ru-RU');

export function FacadeSchematic({ win, resolved, focus, errorKeys, onPick, mini }: Props) {
  const g = facadeGeometry(win, resolved);
  const W = g.wall.width;
  const H = g.wall.height;
  const S = Math.max(W, H);
  const fs = S * 0.03; // размер шрифта
  const sw = S / 700; // толщина тонкой линии
  const tier = fs * 2.6; // шаг ярусов размерных линий
  const gap = fs * 1.4; // отступ первого яруса от контура

  const m = mini ? S * 0.04 : 0;
  const left = mini ? -m : -(gap + tier * 2 + fs);
  const right = mini ? W + m : W + gap + tier * 2 + fs;
  const topY = mini ? -(H + m) : -(H + gap + tier * 2 + fs * 0.6);
  const bottomY = mini ? m : gap + tier * 2 + fs * 0.6;
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
      className={mini ? 'schematic-mini' : 'schematic'}
      viewBox={`${left} ${topY} ${right - left} ${bottomY - topY}`}
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

      {/* предполагаемое изделие */}
      {g.product && (
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
      {g.product && vdim('productHeight', g.product.y, g.product.y + g.product.h, g.product.x + g.product.w, colR2)}
      {g.product && g.product.y > 1 && vdim('floorClearance', 0, g.product.y, g.product.x + g.product.w, colR2)}

      {/* батарея — местные размеры */}
      {g.radiator && hdim('radiatorWidth', g.radiator.x, g.radiator.x + g.radiator.w, g.radiator.y + g.radiator.h, g.radiator.y + g.radiator.h + fs * 0.7)}
      {g.radiator && vdim('radiatorHeight', g.radiator.y, g.radiator.y + g.radiator.h, g.radiator.x, g.radiator.x - fs * 1.1)}
      </>}
    </svg>
  );
}
