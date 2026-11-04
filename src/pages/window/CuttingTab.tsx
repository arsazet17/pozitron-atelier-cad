import { useMemo } from 'react';
import { CuttingLayout } from '../../drawing/CuttingLayout';
import { useMaterials, useTech } from '../../hooks';
import { calcProduct, type FabricUse, type ProductCalc } from '../../model/calc';
import type { Product } from '../../model/types';
import type { TabProps } from './common';

const m = (mm: number) => (mm / 1000).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Таблица деталей кроя */
export function PieceTable({ use }: { use: FabricUse }) {
  const groups = new Map<string, number>();
  for (const p of use.layout) {
    if (p.kind !== 'piece') continue;
    const k = `${p.w}×${p.h}`;
    groups.set(k, (groups.get(k) ?? 0) + 1);
  }
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Деталь, мм (вдоль × поперёк рулона)</th>
          <th className="r">Кол-во</th>
        </tr>
      </thead>
      <tbody>
        {[...groups].map(([k, n]) => (
          <tr key={k}>
            <td className="num">{k}</td>
            <td className="r num">{n}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function FabricBlock({ use, title }: { use: FabricUse; title: string }) {
  return (
    <div className="fabric-block">
      <div className="row">
        <b>{title}</b>
        <span className="spacer" />
        <span className="num">
          {m(use.lengthRounded)} м
          {use.lengthRounded !== use.lengthRaw && <span className="muted small"> (по раскладке {m(use.lengthRaw)})</span>}
        </span>
      </div>
      <div className="small muted">
        {use.name} · рулон {use.rollWidth.toLocaleString('ru-RU')} мм · {use.railroaded ? 'в высоту' : 'в рост'}
        {use.rapport ? ` · раппорт ${use.rapport} мм` : ''} · остаток {use.restArea.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} м²
      </div>
      <CuttingLayout use={use} />
      <PieceTable use={use} />
    </div>
  );
}

export function ProductCutting({ product, calc }: { product: Product; calc: ProductCalc }) {
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <h2>{product.name}</h2>
      {calc.fabric && <FabricBlock use={calc.fabric} title="Основная ткань" />}
      {calc.lining && <FabricBlock use={calc.lining} title="Подкладка" />}
      {calc.warnings.map((w, i) => (
        <div key={i} className="issue" style={{ marginTop: 8 }}>
          <span>⚠️</span>
          <span>{w}</span>
        </div>
      ))}
      {calc.steps.length > 0 && (
        <>
          <div className="section-title" style={{ marginTop: 12 }}>
            Как посчитано — для швеи
          </div>
          <ol className="steps">
            {calc.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </>
      )}
      {product.note && <p className="small">Примечание: {product.note}</p>}
    </div>
  );
}

export function CuttingTab({ win, resolved, goTab }: TabProps) {
  const { map } = useMaterials();
  const tech = useTech();
  const items = useMemo(() => win.products.map((p) => ({ product: p, calc: calcProduct(p, { resolved, tech, materials: map }) })), [win.products, resolved, tech, map]);

  if (items.length === 0) {
    return (
      <div className="card later-box">
        <div className="big">✂️</div>
        <h2>Раскрой</h2>
        <p className="muted">Добавьте изделия — раскрой посчитается автоматически по замерам и ткани.</p>
        <button className="btn accent" onClick={() => goTab('products')}>
          К изделиям
        </button>
      </div>
    );
  }
  return (
    <div className="narrow">
      {items.map((it) => (
        <ProductCutting key={it.product.id} {...it} />
      ))}
    </div>
  );
}
