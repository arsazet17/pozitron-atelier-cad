import type { ReactNode } from 'react';
import type { ProductCalc } from '../model/calc';
import type { ResolvedMeasures } from '../model/measurements';
import type { AtelierProfile, MeasureKey, Order, Product, Room, WindowItem } from '../model/types';
import { FacadeSchematic, facadeBounds, type DrawnProduct } from './FacadeSchematic';
import { facadeGeometry } from './geometry';

/**
 * Лист чертежа: рамка, вид спереди, вид сбоку, примечания и штамп.
 * Координаты листа — миллиметры бумаги, поэтому при печати масштаб точный.
 */

export type SheetFormat = 'A4' | 'A3';
export const SHEET_SIZE: Record<SheetFormat, { w: number; h: number }> = {
  A4: { w: 297, h: 210 },
  A3: { w: 420, h: 297 },
};
const SCALES = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100];
/** Высота основного текста размеров на бумаге, мм */
const TEXT_MM = 2.8;

export function drawnProducts(win: WindowItem, resolved: ResolvedMeasures, items: { product: Product; calc: ProductCalc }[]): DrawnProduct[] {
  const g = facadeGeometry(win, resolved);
  const c = g.cornice;
  const center = (c.x1 + c.x2) / 2;
  const out: DrawnProduct[] = [];
  for (const { product: p, calc } of items) {
    if (!calc.finishedWidth || !calc.finishedHeight) continue;
    const W = calc.finishedWidth;
    const H = calc.finishedHeight;
    const curtain = p.type === 'classic' || p.type === 'tulle';
    const top = curtain ? c.y : g.opening.y + H;
    out.push({ id: p.id, name: p.name, type: p.type, x: center - W / 2, y: top - H, w: W, h: H, panels: p.panels });
  }
  // тюль рисуем первым (он ближе к окну), портьеры поверх
  return out.sort((a, b) => (a.type === 'tulle' ? -1 : 0) - (b.type === 'tulle' ? -1 : 0));
}

interface SideParams {
  fs: number;
  sw: number;
}

/** Вид сбоку: стена слева, комната справа. Возвращает элементы и габарит. */
function sideView(win: WindowItem, r: ResolvedMeasures, p: SideParams) {
  const v = (k: MeasureKey) => r.values[k]?.value;
  const g = facadeGeometry(win, r);
  const H = g.wall.height;
  const sillY = g.opening.y;
  const sillD = v('sillDepth') ?? 250;
  const proj = v('corniceProjection') ?? 100;
  const cy = g.cornice.y;
  const rows = Math.max(1, win.cornice.rows);
  const radD = win.hasRadiator ? v('radiatorDepth') ?? 100 : 0;
  const reach = Math.max(sillD, proj + (rows - 1) * 80, radD) + 300;
  const { fs, sw } = p;
  const Y = (y: number) => -y;
  const els: ReactNode[] = [];
  const known = (k: string) => r.values[k as keyof typeof r.values] !== undefined;
  const lbl = (k: string, n: number) => (known(k) ? Math.round(n).toLocaleString('ru-RU') : '?');

  // стена со штриховкой
  els.push(<rect key="wall" x={-150} y={Y(H)} width={150} height={H} fill="url(#side-hatch)" stroke="var(--ink)" strokeWidth={sw * 1.6} />);
  els.push(<rect key="opening" x={-150} y={Y(g.opening.y + g.opening.h)} width={150} height={g.opening.h} fill="var(--glass)" stroke="var(--ink)" strokeWidth={sw} />);
  els.push(<line key="floor" x1={-150} y1={0} x2={reach} y2={0} stroke="var(--ink)" strokeWidth={sw * 2.4} />);
  els.push(<line key="ceil" x1={-150} y1={Y(H)} x2={reach} y2={Y(H)} stroke="var(--ink)" strokeWidth={sw * 2.4} />);
  // подоконник
  els.push(<rect key="sill" x={-60} y={Y(sillY)} width={sillD + 60} height={40} fill="var(--paper)" stroke="var(--ink)" strokeWidth={sw * 1.4} />);
  // батарея
  if (win.hasRadiator && g.radiator) {
    els.push(<rect key="rad" x={Math.min(40, radD - 20)} y={Y(g.radiator.y + g.radiator.h)} width={Math.max(20, radD - Math.min(40, radD - 20))} height={g.radiator.h} fill="var(--paper)" stroke="var(--ink-soft)" strokeWidth={sw * 1.2} rx={sw * 3} />);
  }
  // карниз: кронштейн и ряды
  els.push(<line key="bracket" x1={0} y1={Y(cy) - 25} x2={proj + (rows - 1) * 80} y2={Y(cy) - 25} stroke="var(--metal)" strokeWidth={sw * 3} />);
  for (let i = 0; i < rows; i++) {
    const x = proj + i * 80;
    els.push(<circle key={`rod${i}`} cx={x} cy={Y(cy)} r={14} fill="var(--metal)" />);
  }
  // полотна (схематично: первый ряд — тюль, внешний — портьеры)
  const clear = v('floorClearance') ?? 0;
  for (let i = 0; i < rows; i++) {
    const x = proj + i * 80;
    els.push(<line key={`cur${i}`} x1={x} y1={Y(cy) + 20} x2={x} y2={Y(clear)} stroke="var(--fabric)" strokeWidth={sw * (i === rows - 1 ? 3.2 : 1.8)} strokeDasharray={i < rows - 1 ? `${sw * 6} ${sw * 4}` : undefined} />);
  }

  const t = fs * 0.3;
  const hd = (key: string, x1: number, x2: number, y: number, text: string) => (
    <g key={key}>
      <line x1={x1} y1={Y(y)} x2={x2} y2={Y(y)} stroke="var(--ink)" strokeWidth={sw} />
      <line x1={x1 - t} y1={Y(y) + t} x2={x1 + t} y2={Y(y) - t} stroke="var(--ink)" strokeWidth={sw * 1.8} />
      <line x1={x2 - t} y1={Y(y) + t} x2={x2 + t} y2={Y(y) - t} stroke="var(--ink)" strokeWidth={sw * 1.8} />
      <text x={(x1 + x2) / 2} y={Y(y) - fs * 0.3} fontSize={fs} textAnchor="middle" fill={text === '?' ? 'var(--accent)' : 'var(--ink)'}>
        {text}
      </text>
    </g>
  );
  els.push(hd('d-sill', 0, sillD, sillY + 40 + fs * 1.2, lbl('sillDepth', sillD)));
  els.push(hd('d-proj', 0, proj, cy + fs * 1.6, lbl('corniceProjection', proj)));
  if (win.hasRadiator && g.radiator) els.push(hd('d-rad', 0, radD, g.radiator.y - fs * 1.2, lbl('radiatorDepth', radD)));
  els.push(
    <text key="t" x={reach / 2 - 75} y={Y(H) - fs * 1.6} fontSize={fs * 1.1} textAnchor="middle" fill="var(--ink)" fontWeight={600}>
      Вид сбоку
    </text>,
  );
  return { els, minX: -150 - fs, maxX: reach + fs, height: H };
}

interface SheetProps {
  order: Order;
  room: Room;
  win: WindowItem;
  resolved: ResolvedMeasures;
  items: { product: Product; calc: ProductCalc }[];
  profile: AtelierProfile;
  format: SheetFormat;
  className?: string;
}

export function DrawingSheet({ order, room, win, resolved, items, profile, format, className }: SheetProps) {
  const { w: SW, h: SH } = SHEET_SIZE[format];
  const frame = { x: 20, y: 5, w: SW - 25, h: SH - 10 };
  const stamp = { w: 185, h: 40 };
  const area = { x: frame.x + 5, y: frame.y + 8, w: frame.w - 10, h: frame.h - stamp.h - 14 };
  const products = drawnProducts(win, resolved, items);

  // подбор масштаба: вид спереди + вид сбоку должны поместиться в поле листа
  let scale = SCALES[SCALES.length - 1];
  let fb = facadeBounds(win, resolved, TEXT_MM * scale);
  let side = sideView(win, resolved, { fs: TEXT_MM * scale, sw: (TEXT_MM * scale) / 21 });
  for (const s of SCALES) {
    const b = facadeBounds(win, resolved, TEXT_MM * s);
    const sv = sideView(win, resolved, { fs: TEXT_MM * s, sw: (TEXT_MM * s) / 21 });
    const needW = b.width / s + 10 + (sv.maxX - sv.minX) / s;
    const needH = Math.max(b.height, sv.height + TEXT_MM * s * 8) / s;
    if (needW <= area.w && needH <= area.h) {
      scale = s;
      fb = b;
      side = sv;
      break;
    }
  }
  const fw = fb.width / scale;
  const fh = fb.height / scale;
  const sideW = (side.maxX - side.minX) / scale;
  const fx = area.x + Math.max(0, (area.w - fw - 10 - sideW) / 2);
  const fy = area.y + Math.max(0, (area.h - fh) / 2);
  // низ вида сбоку на уровне пола вида спереди: пол фасада — y = 0 в его координатах
  const floorPaperY = fy + (0 - fb.top) / scale;
  const sx = fx + fw + 10;
  const sideTopWorld = -(side.height + TEXT_MM * scale * 3);
  const sideFrame = { x: sx, y: floorPaperY + sideTopWorld / scale, width: sideW, height: -sideTopWorld / scale + TEXT_MM * 2 };

  const date = new Date().toLocaleDateString('ru-RU');
  const productNames = products.map((p) => p.name).join(', ') || 'изделия не выбраны';
  const errors = resolved.issues.filter((i) => i.level === 'error');
  const notes = [
    'Размеры в мм. Курсивом — вычисленные значения, «?» — размер не измерен.',
    ...items.filter((i) => i.product.note).map((i) => `${i.product.name}: ${i.product.note}`),
    ...(win.comment ? [`Замер: ${win.comment}`] : []),
    ...win.extras.filter((x) => x.label).map((x) => `${x.label}: ${x.value !== undefined ? x.value.toLocaleString('ru-RU') + ' мм' : '—'}`),
  ];
  const sx0 = SW - 5 - stamp.w;
  const sy0 = SH - 5 - stamp.h;
  const cell = (x: number, y: number, w: number, h: number, label: string, value: string, big = false) => (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="none" stroke="#000" strokeWidth={0.35} />
      <text x={x + 1.5} y={y + 3} fontSize={2} fill="#555">
        {label}
      </text>
      <text x={x + 1.5} y={y + h - 2} fontSize={big ? 4 : 3} fill="#000" fontWeight={big ? 700 : 400}>
        {value.length > (big ? 60 : 48 * (w / 100)) ? value.slice(0, Math.floor(big ? 60 : 48 * (w / 100)) - 1) + '…' : value}
      </text>
    </g>
  );

  return (
    <svg
      className={className ?? 'sheet-svg'}
      viewBox={`0 0 ${SW} ${SH}`}
      width={`${SW}mm`}
      height={`${SH}mm`}
      xmlns="http://www.w3.org/2000/svg"
      fontFamily="Arial, Helvetica, sans-serif"
      style={
        {
          // чертёж всегда на белой бумаге, даже в тёмной теме
          '--ink': '#111',
          '--ink-soft': '#555',
          '--paper': '#fff',
          '--wall': '#fafafa',
          '--glass': '#e3edf3',
          '--line-quiet': '#9a9a9a',
          '--accent': '#b5822e',
          '--danger': '#c0392b',
          '--fabric': '#c9a25d',
          '--metal': '#555',
          background: '#fff',
        } as React.CSSProperties
      }
    >
      <defs>
        <pattern id="side-hatch" width={60} height={60} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="60" stroke="#999" strokeWidth={6} />
        </pattern>
      </defs>
      <rect x={0} y={0} width={SW} height={SH} fill="#fff" />
      <rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} fill="none" stroke="#000" strokeWidth={0.7} />
      <text x={frame.x + 4} y={frame.y + 6} fontSize={4} fontWeight={700}>
        {win.name} · {room.name}
      </text>
      <text x={frame.x + 4} y={frame.y + 10.5} fontSize={2.6} fill="#555">
        Вид спереди (со стороны комнаты) и вид сбоку · М 1:{scale}
      </text>

      <FacadeSchematic win={win} resolved={resolved} errorKeys={new Set()} fontMm={TEXT_MM * scale} products={products.length ? products : undefined} className="sheet-facade" frame={{ x: fx, y: fy, width: fw, height: fh }} />

      <svg x={sideFrame.x} y={sideFrame.y} width={sideFrame.width} height={sideFrame.height} viewBox={`${side.minX} ${sideTopWorld} ${side.maxX - side.minX} ${-sideTopWorld + TEXT_MM * 2 * scale}`}>
        {side.els}
      </svg>

      {/* примечания */}
      <g>
        <text x={frame.x + 4} y={sy0 + 3} fontSize={3} fontWeight={700}>
          Примечания
        </text>
        {notes.slice(0, 7).map((n, i) => (
          <text key={i} x={frame.x + 4} y={sy0 + 7.5 + i * 4} fontSize={2.5}>
            {i + 1}. {n.length > 95 ? n.slice(0, 94) + '…' : n}
          </text>
        ))}
        {errors.slice(0, 2).map((e, i) => (
          <text key={'e' + i} x={frame.x + 4} y={sy0 + 7.5 + (Math.min(7, notes.length) + i) * 4} fontSize={2.5} fill="#c0392b">
            ! {e.message.length > 95 ? e.message.slice(0, 94) + '…' : e.message}
          </text>
        ))}
      </g>

      {/* штамп */}
      <g>
        <rect x={sx0} y={sy0} width={stamp.w} height={stamp.h} fill="#fff" stroke="#000" strokeWidth={0.7} />
        {cell(sx0, sy0, 185, 10, 'Исполнитель', profile.name || 'ПОЗИТРОН АТЕЛЬЕ', true)}
        {cell(sx0, sy0 + 10, 50, 10, 'Заказ №', order.number, true)}
        {cell(sx0 + 50, sy0 + 10, 135, 10, 'Заказчик', order.customer.name || '—')}
        {cell(sx0, sy0 + 20, 185, 10, 'Изделия', productNames)}
        {cell(sx0, sy0 + 30, 50, 10, 'Масштаб', `1:${scale}`)}
        {cell(sx0 + 50, sy0 + 30, 45, 10, 'Формат', format)}
        {cell(sx0 + 95, sy0 + 30, 45, 10, 'Дата', date)}
        {cell(sx0 + 140, sy0 + 30, 45, 10, 'Лист', '1')}
      </g>
    </svg>
  );
}
