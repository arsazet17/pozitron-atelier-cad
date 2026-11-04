/**
 * Проективное преобразование плоскости по четырём парам точек.
 * Связывает координаты стены (мм) с пикселями фото: углы проёма на фото
 * известны (их отметил замерщик), их размеры в мм тоже — значит любую точку
 * стены (карниз, край шторы) можно нарисовать на фото в правильной перспективе.
 */

export interface P2 {
  x: number;
  y: number;
}

export type Matrix3 = [number, number, number, number, number, number, number, number, number];

/** Решение системы 8×8 методом Гаусса с выбором главного элемента */
function solve(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[piv][c])) piv = r;
    if (Math.abs(m[piv][c]) < 1e-12) return null;
    [m[c], m[piv]] = [m[piv], m[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = m[r][c] / m[c][c];
      for (let k = c; k <= n; k++) m[r][k] -= f * m[c][k];
    }
  }
  return m.map((row, i) => row[n] / row[i]);
}

/** Матрица, переводящая точки src[i] в dst[i] */
export function homography(src: P2[], dst: P2[]): Matrix3 | null {
  const a: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  const h = solve(a, b);
  return h ? ([...h, 1] as Matrix3) : null;
}

export function apply(h: Matrix3, p: P2): P2 {
  const w = h[6] * p.x + h[7] * p.y + h[8];
  return { x: (h[0] * p.x + h[1] * p.y + h[2]) / w, y: (h[3] * p.x + h[4] * p.y + h[5]) / w };
}

/** Строка points для SVG-многоугольника из точек стены */
export function projectPolygon(h: Matrix3, pts: P2[]): string {
  return pts
    .map((p) => apply(h, p))
    .map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`)
    .join(' ');
}

/** Прямоугольник стены (x, y — левый нижний угол, Y вверх) как четыре точки */
export function rectPts(x: number, y: number, w: number, h: number): P2[] {
  return [
    { x, y: y + h },
    { x: x + w, y: y + h },
    { x: x + w, y },
    { x, y },
  ];
}

/** Четырёхугольник выпуклый и обходится в одном направлении — иначе углы перепутаны */
export function isConvexQuad(p: P2[]): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = p[i];
    const b = p[(i + 1) % 4];
    const c = p[(i + 2) % 4];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    const s = Math.sign(cross);
    if (s === 0) return false;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}
