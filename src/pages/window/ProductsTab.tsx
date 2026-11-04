import { useMemo } from 'react';
import { useMaterials, useTech } from '../../hooks';
import { bracketCount, calcProduct, productSize, type ProductCalc } from '../../model/calc';
import { newProduct } from '../../model/factory';
import { formatMm } from '../../model/measurements';
import { HEADING_LABEL, MATERIAL_KIND_LABEL, PRODUCT_TYPE_LABEL, type HeadingType, type Material, type MaterialKind, type Product, type ProductType, type TechSettings } from '../../model/types';
import { NumberField, Seg, SelectField, TextField } from '../../ui';
import type { TabProps } from './common';

const TYPES: ProductType[] = ['classic', 'tulle', 'roman', 'roller'];
const FULLNESS = [1.5, 2, 2.5, 3];

function MatSelect({ label, kinds, list, value, onChange }: { label: string; kinds: MaterialKind[]; list: Material[]; value?: string; onChange: (id: string | undefined) => void }) {
  const options = list.filter((m) => kinds.includes(m.kind));
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">{options.length ? '— не выбрано —' : `— в справочнике нет: ${kinds.map((k) => MATERIAL_KIND_LABEL[k].toLowerCase()).join(', ')} —`}</option>
        {options.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
            {m.price ? ` · ${m.price.toLocaleString('ru-RU')} ₽/${m.unit}` : ''}
          </option>
        ))}
      </select>
    </label>
  );
}

const m2 = (mm: number) => (mm / 1000).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function CalcSummary({ calc }: { calc: ProductCalc }) {
  return (
    <div className="calc-summary">
      {calc.cutWidth && calc.cutLength && (
        <div className="calc-grid">
          <div>
            <span>Готовое изделие</span>
            <b className="num">
              {formatMm(calc.finishedWidth)} × {formatMm(calc.finishedHeight)}
            </b>
          </div>
          <div>
            <span>Крой полотна</span>
            <b className="num">
              {formatMm(calc.cutWidth)} × {formatMm(calc.cutLength)}
            </b>
          </div>
          {calc.fabric && (
            <div>
              <span>{calc.fabric.railroaded ? 'Ткань (в высоту)' : `Ткань, полос на полотно: ${calc.stripsPerPanel}`}</span>
              <b className="num">{m2(calc.fabric.lengthRounded)} м</b>
            </div>
          )}
          {calc.lining && (
            <div>
              <span>Подкладка</span>
              <b className="num">{m2(calc.lining.lengthRounded)} м</b>
            </div>
          )}
          {calc.tapeLength !== undefined && (
            <div>
              <span>Шторная лента</span>
              <b className="num">{m2(calc.tapeLength)} м</b>
            </div>
          )}
          {calc.threadLength !== undefined && (
            <div>
              <span>Нитки (ориентир.)</span>
              <b className="num">{Math.round(calc.threadLength / 1000)} м</b>
            </div>
          )}
          {calc.rods !== undefined && (
            <div>
              <span>Рейки</span>
              <b className="num">{calc.rods} шт</b>
            </div>
          )}
        </div>
      )}
      {calc.warnings.map((w, i) => (
        <div key={i} className="issue" style={{ marginTop: 8 }}>
          <span>⚠️</span>
          <span>{w}</span>
        </div>
      ))}
    </div>
  );
}

function ProductCard({ p, calc, list, tech, resolved, onChange, onRemove }: { p: Product; calc: ProductCalc; list: Material[]; tech: TechSettings; resolved: TabProps['resolved']; onChange: (patch: Partial<Product>) => void; onRemove: () => void }) {
  const size = productSize({ ...p, width: undefined, height: undefined }, resolved);
  const curtain = p.type === 'classic' || p.type === 'tulle';
  const setTech = (k: keyof TechSettings, v: number | undefined) => {
    const t = { ...p.tech };
    if (v === undefined) delete t[k];
    else t[k] = v;
    onChange({ tech: t });
  };
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div className="row" style={{ marginBottom: 10 }}>
        <span className="badge">{PRODUCT_TYPE_LABEL[p.type]}</span>
        <span className="spacer" />
        <button className="btn small danger" onClick={onRemove}>
          Удалить
        </button>
      </div>
      <div className="grid2">
        <TextField label="Название" value={p.name} onChange={(name) => onChange({ name })} />
        <NumberField label="Цена готового изделия" suffix="₽" placeholder="для сметы по готовым изделиям" value={p.price} onChange={(price) => onChange({ price: price !== undefined && price >= 0 ? price : undefined })} />
        {curtain && (
          <SelectField
            label="Обработка верха"
            value={p.heading ?? 'tape'}
            options={(Object.keys(HEADING_LABEL) as HeadingType[]).map((h) => ({ value: h, label: HEADING_LABEL[h][0].toUpperCase() + HEADING_LABEL[h].slice(1) }))}
            onChange={(heading) => onChange({ heading })}
          />
        )}
        <label className="field">
          <span>Полотен</span>
          <div className="stepper">
            <button className="btn small" onClick={() => onChange({ panels: Math.max(1, p.panels - 1) })} aria-label="Меньше">
              −
            </button>
            <b className="num">{p.panels}</b>
            <button className="btn small" onClick={() => onChange({ panels: Math.min(8, p.panels + 1) })} aria-label="Больше">
              +
            </button>
          </div>
        </label>
        {curtain && (
          <label className="field">
            <span>Коэффициент сборки</span>
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <Seg value={String(p.fullness)} options={FULLNESS.map((f) => ({ value: String(f), label: '×' + String(f).replace('.', ',') }))} onChange={(v) => onChange({ fullness: Number(v) })} />
            </div>
          </label>
        )}
        {curtain && <NumberField label="Сборка вручную" value={p.fullness} onChange={(v) => v && v > 0 && v < 6 && onChange({ fullness: v })} />}
        <NumberField label="Ширина изделия" suffix="мм" placeholder={size.width ? `${formatMm(size.width)} (${size.widthSource})` : 'нет замеров'} value={p.width} onChange={(width) => onChange({ width: width ? Math.round(width) : undefined })} />
        <NumberField label="Высота изделия" suffix="мм" placeholder={size.height ? `${formatMm(size.height)} (${size.heightSource})` : 'нет замеров'} value={p.height} onChange={(height) => onChange({ height: height ? Math.round(height) : undefined })} />
        <MatSelect label="Ткань" kinds={['fabric']} list={list} value={p.fabricId} onChange={(fabricId) => onChange({ fabricId })} />
        {p.type === 'classic' && <MatSelect label="Подкладка" kinds={['lining']} list={list} value={p.liningId} onChange={(liningId) => onChange({ liningId })} />}
        {curtain && <MatSelect label="Шторная лента" kinds={['tape']} list={list} value={p.tapeId} onChange={(tapeId) => onChange({ tapeId })} />}
        {p.type !== 'roller' && <MatSelect label="Нитки" kinds={['fitting']} list={list} value={p.threadId} onChange={(threadId) => onChange({ threadId })} />}
        <MatSelect label="Пошив / изготовление" kinds={['work']} list={list} value={p.sewingId} onChange={(sewingId) => onChange({ sewingId })} />
      </div>
      <details className="tech-details">
        <summary>Припуски для этого изделия</summary>
        <div className="grid2" style={{ marginTop: 10 }}>
          <NumberField label="Верх (под тесьму)" suffix="мм" placeholder={String(tech.topAllowance)} value={p.tech.topAllowance} onChange={(v) => setTech('topAllowance', v)} />
          <NumberField label="Низ" suffix="мм" placeholder={String(tech.bottomHem)} value={p.tech.bottomHem} onChange={(v) => setTech('bottomHem', v)} />
          <NumberField label="Боковой подгиб, на сторону" suffix="мм" placeholder={String(tech.sideHem)} value={p.tech.sideHem} onChange={(v) => setTech('sideHem', v)} />
          <NumberField label="Шов стачивания, на сторону" suffix="мм" placeholder={String(tech.seamAllowance)} value={p.tech.seamAllowance} onChange={(v) => setTech('seamAllowance', v)} />
          {p.type === 'roman' && <NumberField label="Шаг реек" suffix="мм" placeholder={String(tech.romanRodStep)} value={p.tech.romanRodStep} onChange={(v) => setTech('romanRodStep', v)} />}
        </div>
      </details>
      <div style={{ marginTop: 10 }}>
        <TextField label="Примечание для производства" value={p.note} onChange={(note) => onChange({ note })} />
      </div>
      <CalcSummary calc={calc} />
    </div>
  );
}

export function ProductsTab({ win, resolved, setWin, goTab }: TabProps) {
  const { list, map } = useMaterials();
  const tech = useTech();
  const calcs = useMemo(() => new Map(win.products.map((p) => [p.id, calcProduct(p, { resolved, tech, materials: map })])), [win.products, resolved, tech, map]);
  const cl = resolved.values.corniceLength?.value;

  const setProduct = (id: string, patch: Partial<Product>) => setWin((w) => ({ ...w, products: w.products.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));

  return (
    <div className="narrow">
      {list.length === 0 && (
        <div className="banner">
          <span>Справочник материалов пуст: без него нет цен и ширины рулона. Добавьте ткани, тесьму, карнизы и работы в настройках.</span>
          <a className="btn small" href="#/settings">
            Справочник
          </a>
        </div>
      )}

      <div className="card">
        <h2>Карниз</h2>
        <p className="small muted" style={{ marginTop: 0 }}>
          Длина по замерам: <b className="num">{formatMm(cl)} мм</b>
          {cl ? `, кронштейнов по длине: ${bracketCount(cl)}` : ' — введите длину или заходы во вкладке «Замеры»'}.
        </p>
        <div className="grid2">
          <MatSelect label="Карниз" kinds={['cornice']} list={list} value={win.cornice.materialId} onChange={(materialId) => setWin((w) => ({ ...w, cornice: { ...w.cornice, materialId } }))} />
          <label className="field">
            <span>Рядов</span>
            <Seg value={String(win.cornice.rows)} options={['1', '2', '3'].map((v) => ({ value: v, label: v }))} onChange={(v) => setWin((w) => ({ ...w, cornice: { ...w.cornice, rows: Number(v) } }))} />
          </label>
          <NumberField
            label="Кронштейнов"
            placeholder={cl ? `${bracketCount(cl)} (по длине)` : ''}
            value={win.cornice.brackets}
            onChange={(v) => setWin((w) => ({ ...w, cornice: { ...w.cornice, brackets: v ? Math.round(v) : undefined } }))}
          />
          <MatSelect label="Монтаж" kinds={['work']} list={list} value={win.cornice.installId} onChange={(installId) => setWin((w) => ({ ...w, cornice: { ...w.cornice, installId } }))} />
        </div>
      </div>

      {win.products.map((p) => (
        <ProductCard
          key={p.id}
          p={p}
          calc={calcs.get(p.id)!}
          list={list}
          tech={tech}
          resolved={resolved}
          onChange={(patch) => setProduct(p.id, patch)}
          onRemove={() => confirm(`Удалить «${p.name}»?`) && setWin((w) => ({ ...w, products: w.products.filter((x) => x.id !== p.id) }))}
        />
      ))}

      <div className="section-title">Добавить изделие</div>
      <div className="row">
        {TYPES.map((t) => (
          <button key={t} className="btn" onClick={() => setWin((w) => ({ ...w, products: [...w.products, newProduct(t)] }))}>
            + {PRODUCT_TYPE_LABEL[t].replace(/ \(.*\)/, '')}
          </button>
        ))}
      </div>
      <p className="small muted">Австрийские и французские шторы, ламбрекены, подхваты и жалюзи — в следующих версиях.</p>

      {win.products.length > 0 && (
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn accent" onClick={() => goTab('cutting')}>
            Раскрой →
          </button>
          <button className="btn" onClick={() => goTab('estimate')}>
            Смета →
          </button>
        </div>
      )}
    </div>
  );
}
