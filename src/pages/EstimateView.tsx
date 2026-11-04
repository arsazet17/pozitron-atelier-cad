import { useMemo, useState } from 'react';
import { useMaterials, useTech } from '../hooks';
import { clientEstimate, money, orderEstimate, qtyText, windowEstimate, type EstimateLine } from '../model/estimate';
import { uid } from '../model/factory';
import type { Order } from '../model/types';
import { NumberField, Seg, TextField, go } from '../ui';
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

type EstimateMode = 'client' | 'detailed';
const MODE_KEY = 'estimate-mode';
function savedMode(): EstimateMode {
  try {
    return localStorage.getItem(MODE_KEY) === 'detailed' ? 'detailed' : 'client';
  } catch {
    return 'client';
  }
}

/** Поле цены готового изделия: пишет в заказ, когда ввод закончен */
function PriceInput({ value, onCommit }: { value?: number; onCommit: (v: number | undefined) => void }) {
  return (
    <input
      className={'price-input num' + (value === undefined ? ' empty' : '')}
      inputMode="decimal"
      placeholder="цена"
      defaultValue={value ?? ''}
      key={value ?? 'none'}
      onBlur={(e) => {
        const t = e.target.value.replace(/\s/g, '').replace(',', '.');
        const n = t === '' ? undefined : Number(t);
        if (n === undefined || (!Number.isNaN(n) && n >= 0)) onCommit(n);
      }}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  );
}

/** Смета заказа в карточке заказа: по готовым изделиям (для клиента) или подробная */
export function OrderEstimateCard({ order, update }: { order: Order; update: TabProps['update'] }) {
  const { map } = useMaterials();
  const tech = useTech();
  const [mode, setModeState] = useState<EstimateMode>(savedMode);
  const setMode = (m: EstimateMode) => {
    setModeState(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* без сохранения */
    }
  };
  const est = useMemo(() => orderEstimate(order, map, tech), [order, map, tech]);
  const client = useMemo(() => clientEstimate(order, map, tech), [order, map, tech]);
  const setLine = (id: string, patch: Partial<Order['extraLines'][number]>) => update((o) => ({ ...o, extraLines: o.extraLines.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  const setPrice = (windowId: string, productId: string, price: number | undefined) =>
    update((o) => ({
      ...o,
      rooms: o.rooms.map((r) => ({
        ...r,
        windows: r.windows.map((w) => (w.id === windowId ? { ...w, products: w.products.map((p) => (p.id === productId ? { ...p, price } : p)) } : w)),
      })),
    }));
  const totals = mode === 'client' ? client : est;

  return (
    <div className="card">
      <Seg
        value={mode}
        options={[
          { value: 'client', label: 'По готовым изделиям' },
          { value: 'detailed', label: 'Подробная' },
        ]}
        onChange={setMode}
      />
      <p className="small muted">
        {mode === 'client'
          ? 'Для клиента: одна цена за каждое готовое изделие. Описание собирается само из замеров и изделий.'
          : 'Для расчёта: метраж ткани, шторной ленты, нитки и работы по ценам справочника.'}
      </p>

      {mode === 'client' &&
        (client.rooms.length === 0 ? (
          <p className="muted small">Изделий пока нет. Откройте окно → 🧵 Изделия и добавьте портьеры, тюль и т. д.</p>
        ) : (
          client.rooms.map((r, ri) => (
            <div key={r.room.id} className="client-room">
              <div className="client-room-title">
                {ri + 1}. {r.room.name}
              </div>
              {r.groups.map((g, gi) => (
                <div key={g.key} className="client-group">
                  <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'baseline' }}>
                    <b>
                      {ri + 1}.{gi + 1}. {g.title}
                    </b>
                    <span className="muted small">— {g.qtyText}</span>
                    <span className="spacer" />
                    <b className="num">{g.missing ? '—' : money(g.sum)}</b>
                  </div>
                  {g.description.map((d, i) => (
                    <div key={i} className="small">
                      {d}
                    </div>
                  ))}
                  {g.items.map((it) => (
                    <div key={it.productId} className="client-item">
                      <a className="small" href={`#/order/${order.id}/window/${it.windowId}/products`}>
                        {it.windowName}
                        {it.corniceLength ? ` · карниз ${(it.corniceLength / 1000).toLocaleString('ru-RU', { minimumFractionDigits: 2 })} м` : ''} · {it.panels} пол.
                      </a>
                      <span className="spacer" />
                      {it.detailedSum > 0 && it.price === undefined && (
                        <button className="btn small" title="Взять сумму из подробной сметы" onClick={() => setPrice(it.windowId, it.productId, Math.round(it.detailedSum))}>
                          ≈ {Math.round(it.detailedSum).toLocaleString('ru-RU')}
                        </button>
                      )}
                      <PriceInput value={it.price} onCommit={(v) => setPrice(it.windowId, it.productId, v)} />
                      <span className="small muted">₽</span>
                    </div>
                  ))}
                </div>
              ))}
              <div className="total-row">
                <span>Итого: {r.room.name.toLowerCase()}</span>
                <span className="num">{money(r.total)}</span>
              </div>
            </div>
          ))
        ))}

      {mode === 'detailed' &&
        est.windows.map((w) => (
          <div key={w.window.id} className="est-window">
            <div className="row">
              <a href={`#/order/${order.id}/window/${w.window.id}/estimate`}>
                {w.room.name} — {w.window.name}
              </a>
              <span className="spacer" />
              <b className="num">{money(w.total)}</b>
            </div>
            {w.lines.length > 0 && <div className="small muted">{w.lines.map((l) => l.name.split(' — ')[0]).join(' · ')}</div>}
          </div>
        ))}

      <div className="section-title">Фурнитура и дополнительные работы</div>
      {order.extraLines.map((x) => (
        <div key={x.id} className="extra-line">
          <input className="extra-name" placeholder="Например: шторовод (ручка-водилка)" value={x.name} onChange={(e) => setLine(x.id, { name: e.target.value })} />
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <NumberField label="Кол-во" value={x.qty} onChange={(qty) => setLine(x.id, { qty: qty ?? 0 })} />
            <label className="field">
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
      <button className="btn small" onClick={() => update((o) => ({ ...o, extraLines: [...o.extraLines, { id: uid(), name: '', unit: 'шт', qty: 1, price: 0 }] }))}>
        + Строка (фурнитура, доставка, доп. работы)
      </button>

      <div className="grid2" style={{ marginTop: 12 }}>
        <NumberField label="Скидка, % (наценка — с минусом)" value={order.discountPercent || undefined} onChange={(v) => update((o) => ({ ...o, discountPercent: v ?? 0 }))} />
      </div>

      {mode === 'client' && (
        <div className="grid2" style={{ marginTop: 12 }}>
          <TextField label="Пояснение под заголовком" multiline value={order.estimateNote} onChange={(estimateNote) => update((o) => ({ ...o, estimateNote }))} />
          <TextField label="Примечание в конце" multiline value={order.estimateFooter} onChange={(estimateFooter) => update((o) => ({ ...o, estimateFooter }))} />
        </div>
      )}

      <div className="total-row">
        <span>Сумма</span>
        <span className="num">{money(totals.subtotal)}</span>
      </div>
      {totals.discount !== 0 && (
        <div className="total-row">
          <span>{totals.discount > 0 ? `Скидка ${totals.discountPercent}%` : `Наценка ${-totals.discountPercent}%`}</span>
          <span className="num">
            {totals.discount > 0 ? '−' : '+'}
            {money(Math.abs(totals.discount))}
          </span>
        </div>
      )}
      <div className="total-row big">
        <span>Итого по заказу</span>
        <b className="num">{money(totals.total)}</b>
      </div>
      {mode === 'client' && client.missing > 0 && <div className="issue">⚠️ Не указана цена у изделий: {client.missing}. Без цены они не входят в итог.</div>}

      <div className="section-title">Печать и PDF</div>
      <div className="print-buttons">
        <a className="btn primary" href={`#/print/${order.id}/all`}>
          📨 Клиенту: смета + визуализация + размеры
        </a>
        <a className="btn" href={`#/print/${order.id}/client`}>
          🖨 Смета по готовым изделиям
        </a>
        <a className="btn" href={`#/print/${order.id}/estimate`}>
          🖨 Подробная смета
        </a>
        <a className="btn" href={`#/print/${order.id}/production`}>
          🧵 Для производства
        </a>
      </div>
    </div>
  );
}
