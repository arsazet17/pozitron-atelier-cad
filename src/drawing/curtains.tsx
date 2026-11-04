import type { ReactNode } from 'react';
import type { ProductCalc } from '../model/calc';
import type { Material, Product } from '../model/types';
import { shade } from '../pages/window/common';
import type { FacadeGeometry } from './geometry';
import { projectPolygon, rectPts, type Matrix3 } from './homography';

/**
 * Визуализация изделий на фото: каждое полотно разбивается на вертикальные
 * полосы-складки, каждая полоса проецируется на фото в перспективе.
 * Это иллюстрация для клиента, а не фотореалистичный рендер ткани.
 */

const TONES = [1.0, 0.84, 0.74, 0.9];
const ORDER: Record<Product['type'], number> = { roller: 0, roman: 1, tulle: 2, classic: 3 };

export function productColor(p: Product, materials: Map<string, Material>): string {
  const m = p.fabricId ? materials.get(p.fabricId) : undefined;
  return m?.color || p.color;
}

function panelFolds(H: Matrix3, x: number, y: number, w: number, h: number, color: string, opacity: number, key: string): ReactNode {
  const folds = Math.max(4, Math.min(60, Math.round(w / 85)));
  const sw = w / folds;
  const strips: ReactNode[] = [];
  for (let i = 0; i < folds; i++) {
    strips.push(<polygon key={i} points={projectPolygon(H, rectPts(x + i * sw - 0.5, y, sw + 1, h))} fill={shade(color, TONES[i % TONES.length])} />);
  }
  // тесьма по верху
  strips.push(<polygon key="tape" points={projectPolygon(H, rectPts(x, y + h - 70, w, 70))} fill={shade(color, 0.7)} opacity={0.5} />);
  return (
    <g key={key} opacity={opacity}>
      {strips}
    </g>
  );
}

export function renderProducts(
  H: Matrix3,
  geo: FacadeGeometry,
  items: { product: Product; calc: ProductCalc }[],
  open: number,
  materials: Map<string, Material>,
): ReactNode[] {
  const c = geo.cornice;
  const center = (c.x1 + c.x2) / 2;
  const sill = geo.opening.y;
  const nodes: ReactNode[] = [];
  const sorted = [...items].sort((a, b) => ORDER[a.product.type] - ORDER[b.product.type]);

  for (const { product: p, calc } of sorted) {
    const color = productColor(p, materials);
    const W = calc.finishedWidth ?? c.x2 - c.x1;
    const Hh = calc.finishedHeight ?? c.y;
    const x0 = center - W / 2;

    if (p.type === 'classic' || p.type === 'tulle') {
      const top = c.y;
      const bottom = top - Hh;
      const n = Math.max(1, Math.round(p.panels));
      const pw = W / n;
      const o = p.type === 'tulle' ? 0 : open;
      const vis = pw * (1 - 0.78 * o);
      const leftCount = n === 1 ? 1 : Math.floor(n / 2);
      const rightCount = n === 1 ? 0 : Math.floor(n / 2);
      for (let i = 0; i < n; i++) {
        let x: number;
        if (i < leftCount) x = x0 + i * vis;
        else if (i >= n - rightCount) x = x0 + W - (n - i) * vis;
        else x = center - vis / 2; // средняя панель при нечётном количестве
        nodes.push(panelFolds(H, x, bottom, vis, Hh, color, p.opacity, `${p.id}-${i}`));
      }
    } else {
      const top = sill + Hh;
      const vis = Hh * (1 - (p.type === 'roller' ? 0.9 : 0.85) * open);
      const y = top - vis;
      const parts: ReactNode[] = [<polygon key="body" points={projectPolygon(H, rectPts(x0, y, W, vis))} fill={color} />];
      if (p.type === 'roman') {
        const step = 300;
        for (let yy = top - step; yy > y + 20; yy -= step) {
          parts.push(<polygon key={yy} points={projectPolygon(H, rectPts(x0, yy - 12, W, 24))} fill={shade(color, 0.78)} />);
        }
        // собранные складки внизу
        const stack = Math.min(vis, 60 + 220 * open);
        parts.push(<polygon key="stack" points={projectPolygon(H, rectPts(x0, y, W, stack))} fill={shade(color, 0.88)} />);
      } else {
        parts.push(<polygon key="tube" points={projectPolygon(H, rectPts(x0 - 20, top - 60, W + 40, 60))} fill={shade(color, 0.6)} />);
        parts.push(<polygon key="bar" points={projectPolygon(H, rectPts(x0, y, W, 30))} fill={shade(color, 0.55)} />);
      }
      nodes.push(
        <g key={p.id} opacity={p.opacity}>
          {parts}
        </g>,
      );
    }
  }

  // карниз поверх полотен
  if (items.some((i) => i.product.type === 'classic' || i.product.type === 'tulle') || items.length === 0) {
    nodes.push(
      <g key="rod">
        <polygon points={projectPolygon(H, rectPts(c.x1, c.y - 12, c.x2 - c.x1, 24))} fill="#5b5f66" />
        <polygon points={projectPolygon(H, rectPts(c.x1 - 40, c.y - 30, 40, 60))} fill="#3e4247" />
        <polygon points={projectPolygon(H, rectPts(c.x2, c.y - 30, 40, 60))} fill="#3e4247" />
      </g>,
    );
  }
  return nodes;
}
