import { useMemo } from 'react';
import { useMaterials, useTech } from '../hooks';
import { money, orderEstimate, qtyText, windowEstimate, type EstimateLine } from '../model/estimate';
import { uid } from '../model/factory';
import type { Order } from '../model/types';
import { NumberField, go } from '../ui';
import type { TabProps } from './window/common';

/** Таблица строк сметы; цену можно исправить прямо в таблице */
export function EstimateTable({ lines, onPrice, showPrices = true }: { lines: EstimateLine[]; onPrice?: (key: string, price: number | undefined) => void; showPrices?: boolean }) {
  if (lines.length === 0) return <p className="muted small">Строк нет: выберите материалы и работы в изделиях и карнизе.</p>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Наименование</th>
            <th className="r">Кол-во</th>
            <th>Ед.</th>
            {showPrices && <th className="r">Цена, ₽</th>}
            {showPrices && <th className="r">Сумма</th>}
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.key}>
              <td>
                {l.name}
                {l.basis && <div className="small muted">{l.basis}</div>}
              </td>
              <td className="r num">{qtyText(l.qty)}</td>
              <td>{l.unit}</td>
              {showPrices && (
                <td className="r">
                  {onPrice ? (
                    <input
                      className={'price-input num' + (l.overridden ? ' overridden' : '')}
                      inputMode="decimal"
                      defaultValue={l.price}
                      key={l.price}
                      title={l.overridden ? 'Цена исправлена вручную. Очистите поле, чтобы вернуть цену из справочника.' : 'Цена из справочника'}
                      onBlur={(e) => {
                        const t = e.target.value.replace(/\s/g, '').replace(',', '.');
                        onPrice(l.key, t === '' ? undefined : Number(t));
                      }}
                    />
                  ) : (
                    <span className="num">{l.price.toLocaleString('ru-RU')}</span>
                  )}
                </td>
              )}
              {showPrices && <td className="r num">{money(l.sum)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function setPriceOverride(update: TabProps['update'], key: string, price: number | undefined) {
  update((o) => {
    const priceOverrides = { ...o.priceOverrides };
    if (price === undefined || Number.isNaN(price)) delete priceOverrides[key];
    else priceOverrides[key] = price;
    return { ...o, priceOverrides };
  });
}

export function EstimateTab({ order, room, win, update, goTab }: TabProps) {
  const { map } = useMaterials();
  const tech = useTech();
  const est = useMemo(() => windowEstimate(room, win, map, tech, order.priceOverrides), [room, win, map, tech, order.priceOverrides]);
  return (
    <div className="narrow">
      <div className="card">
        <h2>Смета окна: {win.name}</h2>
        <EstimateTable lines={est.lines} onPrice={(k, p) => setPriceOverride(update, k, p)} />
        <div className="total-row">
          <span>Итого по окну</span>
          <b className="num">{money(est.total)}</b>
        </div>
        <p className="small muted">Цены берутся из справочника. Исправленная вручную цена выделена цветом и действует только в этом заказе.</p>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn" onClick={() => goTab('products')}>
          ← Изделия
        </button>
        <span className="spacer" />
        <button className="btn primary" onClick={() => go(`/order/${order.id}`)}>
          Смета всего заказа
        </button>
      </div>
    </div>
  );
}

/** Смета заказа в карточке заказа */
export function OrderEstimateCard({ order, update }: { order: Order; update: TabProps['update'] }) {
  const { map } = useMaterials();
  const tech = useTech();
  const est = useMemo(() => orderEstimate(order, map, tech), [order, map, tech]);
  const setLine = (id: string, patch: Partial<Order['extraLines'][number]>) => update((o) => ({ ...o, extraLines: o.extraLines.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));

  return (
    <div className="card">
      {est.windows.map((w) => (
        <div key={w.window.id} className="est-window">
          <div className="row">
            <a href={`#/order/${order.id}/window/${w.window.id}`}>
              {w.room.name} — {w.window.name}
            </a>
            <span className="spacer" />
            <b className="num">{money(w.total)}</b>
          </div>
          {w.lines.length > 0 && (
            <div className="small muted">
              {w.lines.map((l) => l.name.split(' — ')[0]).join(' · ')}
            </div>
          )}
        </div>
      ))}

      <div className="section-title">Дополнительно</div>
      {order.extraLines.map((x) => (
        <div key={x.id} className="extra-line">
          <input className="extra-name" placeholder="Например: доставка" value={x.name} onChange={(e) => setLine(x.id, { name: e.target.value })} />
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <NumberField label="Кол-во" value={x.qty} onChange={(qty) => setLine(x.id, { qty: qty ?? 0 })} />
            <label className="field" style={{ width: 80 }}>
              <span>Ед.</span>
              <input value={x.unit} onChange={(e) => setLine(x.id, { unit: e.target.value })} />
            </label>
            <NumberField label="Цена, ₽" value={x.price} onChange={(price) => setLine(x.id, { price: price ?? 0 })} />
            <button className="icon-btn" aria-label="Удалить строку" style={{ fontSize: 16, alignSelf: 'flex-end' }} onClick={() => update((o) => ({ ...o, extraLines: o.extraLines.filter((y) => y.id !== x.id) }))}>
              ✕
            </button>
          </div>
        </div>
      ))}
      <button className="btn small" onClick={() => update((o) => ({ ...o, extraLines: [...o.extraLines, { id: uid(), name: '', unit: 'усл', qty: 1, price: 0 }] }))}>
        + Строка (доставка, доп. работы)
      </button>

      <div className="grid2" style={{ marginTop: 12 }}>
        <NumberField label="Скидка, % (наценка — с минусом)" value={order.discountPercent || undefined} onChange={(v) => update((o) => ({ ...o, discountPercent: v ?? 0 }))} />
      </div>

      <div className="total-row">
        <span>Сумма</span>
        <span className="num">{money(est.subtotal)}</span>
      </div>
      {est.discount !== 0 && (
        <div className="total-row">
          <span>{est.discount > 0 ? `Скидка ${est.discountPercent}%` : `Наценка ${-est.discountPercent}%`}</span>
          <span className="num">{est.discount > 0 ? '−' : '+'}{money(Math.abs(est.discount))}</span>
        </div>
      )}
      <div className="total-row big">
        <span>Итого по заказу</span>
        <b className="num">{money(est.total)}</b>
      </div>

      <div className="section-title">Печать и PDF</div>
      <div className="row">
        <a className="btn primary" href={`#/print/${order.id}/estimate`}>
          🖨 Смета
        </a>
        <a className="btn" href={`#/print/${order.id}/production`}>
          🧵 Комплект для производства
        </a>
        <a className="btn" href={`#/print/${order.id}/all`}>
          📚 Всё по заказу
        </a>
      </div>
    </div>
  );
}
