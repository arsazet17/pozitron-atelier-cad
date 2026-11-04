import { useLiveQuery } from 'dexie-react-hooks';
import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { db, getOrder, getProfile } from '../db';
import { CuttingLayout } from '../drawing/CuttingLayout';
import { renderProducts } from '../drawing/curtains';
import { PhotoScene, photoMapping } from '../drawing/PhotoScene';
import { DrawingSheet, SHEET_SIZE, type SheetFormat } from '../drawing/Sheet';
import { useMaterials, usePhoto, useTech } from '../hooks';
import { clientEstimate, money, orderEstimate, qtyText, type ClientEstimate, type OrderEstimate, type WindowEstimate } from '../model/estimate';
import { emptyProfile, executorName, signerShort } from '../model/factory';
import { formatMm } from '../model/measurements';
import { ORDER_STATUS_LABEL, PRODUCT_TYPE_LABEL, type AtelierProfile, type Order } from '../model/types';
import { Seg, TopBar } from '../ui';
import { PieceTable } from './window/CuttingTab';
import { savedFormat } from './window/DrawingTab';

/**
 * Печатные документы. Все страницы одного задания — одного формата (A4 или A3, альбомная):
 * так печать и «Сохранить как PDF» одинаково работают в Chrome, Safari и на компьютере.
 */

const DOC_TITLE: Record<string, string> = {
  drawing: 'Чертёж',
  cutting: 'Карта раскроя',
  client: 'Предварительный расчёт стоимости',
  estimate: 'Подробная смета',
  production: 'Комплект для производства',
  all: 'Предварительный расчёт стоимости',
};

const m = (mm: number) => (mm / 1000).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function DocHeader({ profile, order, title }: { profile: AtelierProfile; order: Order; title: string }) {
  const contacts = [profile.phone, profile.email, profile.site].filter(Boolean).join(' · ');
  return (
    <header className="doc-header">
      <div>
        <div className="doc-atelier">{executorName(profile)}</div>
        {(profile.inn || profile.legalAddress) && (
          <div className="doc-small">
            {profile.inn && `ИНН ${profile.inn}`}
            {profile.inn && profile.legalAddress && ' · '}
            {profile.legalAddress}
          </div>
        )}
        {contacts && <div className="doc-small">{contacts}</div>}
      </div>
      <div className="doc-right">
        <div className="doc-title">{title}</div>
        <div className="doc-small">
          Заказ № {order.number} от {new Date(order.createdAt).toLocaleDateString('ru-RU')}
        </div>
        <div className="doc-small">Заказчик: {order.customer.name || '—'}</div>
        {order.customer.objectAddress && <div className="doc-small">Объект: {order.customer.objectAddress}</div>}
      </div>
    </header>
  );
}

const rub = (n: number) => n.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' ₽';

/** Смета по готовым изделиям — документ для клиента */
function ClientEstimateDoc({ est, order, profile }: { est: ClientEstimate; order: Order; profile: AtelierProfile }) {
  const extraNo = est.rooms.length + 1;
  return (
    <section className="print-page flow">
      <DocHeader profile={profile} order={order} title="Предварительный расчёт стоимости" />
      {order.estimateNote && <p className="doc-p doc-note">{order.estimateNote}</p>}
      <table className="table doc-table client-table">
        <thead>
          <tr>
            <th style={{ width: '9%' }}>№</th>
            <th>Наименование и описание</th>
            <th style={{ width: '16%' }}>Кол-во</th>
            <th className="r" style={{ width: '16%' }}>
              Стоимость
            </th>
          </tr>
        </thead>
        <tbody>
          {est.rooms.map((r, ri) => (
            <Fragment key={r.room.id}>
              <tr className="group-row">
                <td>{ri + 1}.</td>
                <td colSpan={3}>{r.room.name}</td>
              </tr>
              {r.groups.map((g, gi) => (
                <tr key={g.key}>
                  <td>
                    {ri + 1}.{gi + 1}.
                  </td>
                  <td>
                    <b>{g.title}</b>
                    {g.description.map((d, i) => (
                      <div key={i} className="doc-desc">
                        {d}
                      </div>
                    ))}
                  </td>
                  <td>{g.qtyText}</td>
                  <td className="r">
                    <b>{g.missing ? 'по запросу' : rub(g.sum)}</b>
                  </td>
                </tr>
              ))}
              <tr className="subtotal-row">
                <td />
                <td colSpan={2}>Итого: {r.room.name.toLowerCase()}</td>
                <td className="r">{rub(r.total)}</td>
              </tr>
            </Fragment>
          ))}
          {est.extra.length > 0 && (
            <tr className="group-row">
              <td>{extraNo}.</td>
              <td colSpan={3}>Фурнитура и дополнительные работы</td>
            </tr>
          )}
          {est.extra.map((l, i) => (
            <tr key={l.key}>
              <td>
                {extraNo}.{i + 1}.
              </td>
              <td>
                <b>{l.name}</b>
              </td>
              <td>
                {qtyText(l.qty)} {l.unit}
              </td>
              <td className="r">
                <b>{rub(l.sum)}</b>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="doc-totals">
        {est.discount !== 0 && (
          <>
            <div>
              <span>Сумма</span>
              <span>{rub(est.subtotal)}</span>
            </div>
            <div>
              <span>{est.discount > 0 ? `Скидка ${est.discountPercent}%` : `Наценка ${-est.discountPercent}%`}</span>
              <span>
                {est.discount > 0 ? '−' : '+'}
                {rub(Math.abs(est.discount))}
              </span>
            </div>
          </>
        )}
        <div className="grand">
          <span>ИТОГО</span>
          <span>{rub(est.total)}</span>
        </div>
      </div>
      {order.estimateFooter && <p className="doc-p doc-note">{order.estimateFooter}</p>}
      <div className="doc-sign">
        <div>Исполнитель ____________________ {signerShort(profile)}</div>
      </div>
    </section>
  );
}

function EstimateDoc({ est, order, profile }: { est: OrderEstimate; order: Order; profile: AtelierProfile }) {
  return (
    <section className="print-page flow">
      <DocHeader profile={profile} order={order} title="Подробная смета" />
      <table className="table doc-table">
        <thead>
          <tr>
            <th>№</th>
            <th>Наименование</th>
            <th className="r">Кол-во</th>
            <th>Ед.</th>
            <th className="r">Цена, ₽</th>
            <th className="r">Сумма, ₽</th>
          </tr>
        </thead>
        <tbody>
          {est.windows.map((w) => (
            <WindowRows key={w.window.id} w={w} />
          ))}
          {est.extra.length > 0 && (
            <tr className="group-row">
              <td colSpan={6}>Дополнительно</td>
            </tr>
          )}
          {est.extra.map((l, i) => (
            <tr key={l.key}>
              <td>{i + 1}</td>
              <td>{l.name}</td>
              <td className="r">{qtyText(l.qty)}</td>
              <td>{l.unit}</td>
              <td className="r">{l.price.toLocaleString('ru-RU', { minimumFractionDigits: 2 })}</td>
              <td className="r">{l.sum.toLocaleString('ru-RU', { minimumFractionDigits: 2 })}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="doc-totals">
        <div>
          <span>Сумма</span>
          <span>{money(est.subtotal)}</span>
        </div>
        {est.discount !== 0 && (
          <div>
            <span>{est.discount > 0 ? `Скидка ${est.discountPercent}%` : `Наценка ${-est.discountPercent}%`}</span>
            <span>
              {est.discount > 0 ? '−' : '+'}
              {money(Math.abs(est.discount))}
            </span>
          </div>
        )}
        <div className="grand">
          <span>Итого</span>
          <span>{money(est.total)}</span>
        </div>
      </div>
      <div className="doc-sign">
        <div>Исполнитель ____________________ {signerShort(profile)}</div>
        <div>Заказчик ____________________ {order.customer.name}</div>
      </div>
    </section>
  );
}

function WindowRows({ w }: { w: WindowEstimate }) {
  return (
    <>
      <tr className="group-row">
        <td colSpan={5}>
          {w.room.name} — {w.window.name}
        </td>
        <td className="r">{w.total.toLocaleString('ru-RU', { minimumFractionDigits: 2 })}</td>
      </tr>
      {w.lines.map((l, i) => (
        <tr key={l.key}>
          <td>{i + 1}</td>
          <td>{l.name}</td>
          <td className="r">{qtyText(l.qty)}</td>
          <td>{l.unit}</td>
          <td className="r">{l.price.toLocaleString('ru-RU', { minimumFractionDigits: 2 })}</td>
          <td className="r">{l.sum.toLocaleString('ru-RU', { minimumFractionDigits: 2 })}</td>
        </tr>
      ))}
      {w.lines.length === 0 && (
        <tr>
          <td />
          <td colSpan={5} className="doc-small">
            материалы и работы не выбраны
          </td>
        </tr>
      )}
    </>
  );
}

/** Спецификация для производства: без цен */
function SpecDoc({ w, order, profile }: { w: WindowEstimate; order: Order; profile: AtelierProfile }) {
  const cl = w.resolved.values.corniceLength?.value;
  return (
    <section className="print-page flow">
      <DocHeader profile={profile} order={order} title={`Задание на изготовление: ${w.room.name} — ${w.window.name}`} />
      <table className="table doc-table">
        <thead>
          <tr>
            <th>Изделие</th>
            <th>Готовый размер, мм</th>
            <th>Полотен × сборка</th>
            <th>Крой полотна, мм</th>
            <th>Ткань</th>
            <th className="r">Расход</th>
          </tr>
        </thead>
        <tbody>
          {w.products.map(({ product: p, calc }) => (
            <tr key={p.id}>
              <td>
                <b>{p.name}</b>
                <div className="doc-small">{PRODUCT_TYPE_LABEL[p.type]}</div>
                {p.note && <div className="doc-small">Примечание: {p.note}</div>}
              </td>
              <td>
                {formatMm(calc.finishedWidth)} × {formatMm(calc.finishedHeight)}
              </td>
              <td>
                {p.panels} × {p.type === 'classic' || p.type === 'tulle' ? p.fullness.toLocaleString('ru-RU') : '—'}
              </td>
              <td>
                {formatMm(calc.cutWidth)} × {formatMm(calc.cutLength)}
                {calc.stripsPerPanel && calc.stripsPerPanel > 1 && <div className="doc-small">{calc.stripsPerPanel} полосы на полотно</div>}
              </td>
              <td>
                {calc.fabric?.name ?? '—'}
                {calc.lining && <div className="doc-small">подкладка: {calc.lining.name}</div>}
                {calc.tapeLength !== undefined && <div className="doc-small">лента: {m(calc.tapeLength)} м</div>}
                {calc.rods !== undefined && <div className="doc-small">рейки: {calc.rods} шт</div>}
              </td>
              <td className="r">
                {calc.fabric ? `${m(calc.fabric.lengthRounded)} м` : '—'}
                {calc.lining && <div className="doc-small">{m(calc.lining.lengthRounded)} м</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="doc-p">
        <b>Карниз:</b> длина {formatMm(cl)} мм, рядов {w.window.cornice.rows}, кронштейнов {w.brackets ?? '—'}, крепление {w.window.corniceMount === 'wall' ? 'настенное' : 'потолочное'}, вынос{' '}
        {formatMm(w.resolved.values.corniceProjection?.value)} мм, высота установки {formatMm(w.resolved.values.corniceHeight?.value)} мм.
      </p>
      {w.window.comment && (
        <p className="doc-p">
          <b>Замер:</b> {w.window.comment}
        </p>
      )}
      {w.products.flatMap(({ product, calc }) =>
        calc.warnings.map((x, i) => (
          <p key={product.id + i} className="doc-p doc-warn">
            ! {product.name}: {x}
          </p>
        )),
      )}
    </section>
  );
}

function CuttingDoc({ w, order, profile }: { w: WindowEstimate; order: Order; profile: AtelierProfile }) {
  const withFabric = w.products.filter((i) => i.calc.fabric);
  if (withFabric.length === 0) return null;
  return (
    <section className="print-page flow">
      <DocHeader profile={profile} order={order} title={`Карта раскроя: ${w.room.name} — ${w.window.name}`} />
      {withFabric.map(({ product, calc }) => (
        <div key={product.id} className="doc-block">
          <h3>{product.name}</h3>
          {[calc.fabric!, ...(calc.lining ? [calc.lining] : [])].map((use) => (
            <div key={use.role} className="doc-cut">
              <div className="doc-small">
                <b>{use.role === 'fabric' ? 'Ткань' : 'Подкладка'}:</b> {use.name}, рулон {use.rollWidth.toLocaleString('ru-RU')} мм, {use.railroaded ? 'в высоту' : 'в рост'}
                {use.rapport ? `, раппорт ${use.rapport} мм` : ''} — <b>{m(use.lengthRounded)} м</b>
              </div>
              <CuttingLayout use={use} className="doc-cut-svg" />
              <PieceTable use={use} />
            </div>
          ))}
          <ol className="doc-steps">
            {calc.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
      ))}
    </section>
  );
}

function VisualDoc({ w, order, profile }: { w: WindowEstimate; order: Order; profile: AtelierProfile }) {
  const { photo, url } = usePhoto(w.window.photoId, true);
  const { map } = useMaterials();
  if (!photo || !url) return null;
  const mapping = photoMapping(w.window, w.resolved, photo);
  if (!mapping.H) return null;
  return (
    <section className="print-page flow">
      <DocHeader profile={profile} order={order} title={`Визуализация: ${w.room.name} — ${w.window.name}`} />
      <div className="doc-visual">
        <PhotoScene url={url} photo={photo}>
          {renderProducts(mapping.H, mapping.geo, w.products, w.window.visual.open, map)}
        </PhotoScene>
      </div>
      <p className="doc-small">Изображение иллюстрирует оформление окна. Размеры изделий — по чертежу.</p>
    </section>
  );
}

export function PrintPage({ id, doc, windowId }: { id: string; doc: string; windowId?: string }) {
  const [order, setOrder] = useState<Order | null>();
  const { map } = useMaterials();
  const tech = useTech();
  const profile = useLiveQuery(getProfile, []) ?? emptyProfile();
  const [format, setFormat] = useState<SheetFormat>(savedFormat);
  const photosReady = useLiveQuery(() => db.photos.count(), []);
  const [viewW, setViewW] = useState(() => document.documentElement.clientWidth);
  useEffect(() => {
    const on = () => setViewW(document.documentElement.clientWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);

  useEffect(() => {
    void getOrder(id).then((o) => setOrder(o ?? null));
  }, [id]);

  const est = useMemo(() => (order ? orderEstimate(order, map, tech) : undefined), [order, map, tech]);
  const client = useMemo(() => (order ? clientEstimate(order, map, tech) : undefined), [order, map, tech]);
  const { w: SW, h: SH } = SHEET_SIZE[format];

  // Имя PDF при «Сохранить как PDF» берётся из заголовка страницы:
  // «Чертёж — заказ 000002 — Пашкова Наталья — Окно 1»
  useEffect(() => {
    if (!order) return;
    const win = windowId ? order.rooms.flatMap((r) => r.windows).find((w) => w.id === windowId) : undefined;
    const surname = order.customer.name.trim().split(/\s+/).slice(0, 2).join(' ');
    const parts = [DOC_TITLE[doc] ?? 'Документы', `заказ ${order.number}`, surname, win?.name].filter(Boolean);
    const prev = document.title;
    document.title = parts.join(' — ').replace(/[\\/:*?"<>|]/g, '');
    return () => {
      document.title = prev;
    };
  }, [order, doc, windowId]);

  if (order === undefined || !est || photosReady === undefined) return <TopBar title="Готовлю документы…" back="/" />;
  if (order === null) return <TopBar title="Заказ не найден" back="/" />;

  const windows = est.windows.filter((w) => !windowId || w.window.id === windowId);
  const sheet = (w: WindowEstimate) => (
    <section key={'d' + w.window.id} className="print-page sheet">
      <DrawingSheet order={order} room={w.room} win={w.window} resolved={w.resolved} items={w.products} profile={profile} format={format} />
    </section>
  );

  const pages: ReactNode[] = [];
  // «Клиенту»: смета по готовым изделиям + визуализация + чертёж с размерами (без раскроя и цен материалов)
  if ((doc === 'client' || doc === 'all') && client) pages.push(<ClientEstimateDoc key="client" est={client} order={order} profile={profile} />);
  if (doc === 'estimate') pages.push(<EstimateDoc key="est" est={est} order={order} profile={profile} />);
  for (const w of windows) {
    if (doc === 'all') pages.push(<VisualDoc key={'v' + w.window.id} w={w} order={order} profile={profile} />);
    if (doc === 'drawing' || doc === 'production' || doc === 'all') pages.push(sheet(w));
    if (doc === 'production') pages.push(<SpecDoc key={'s' + w.window.id} w={w} order={order} profile={profile} />);
    if (doc === 'cutting' || doc === 'production') pages.push(<CuttingDoc key={'c' + w.window.id} w={w} order={order} profile={profile} />);
  }

  const back = windowId ? `/order/${order.id}/window/${windowId}/${doc === 'drawing' ? 'drawing' : 'cutting'}` : `/order/${order.id}`;

  return (
    <div className="print-root">
      <style>{`@page { size: ${format} landscape; margin: 0; } .print-page { --page-w: ${SW}mm; --page-h: ${SH}mm; }`}</style>
      <div className="no-print">
        <TopBar title={DOC_TITLE[doc] ?? 'Печать'} sub={`Заказ № ${order.number} · ${ORDER_STATUS_LABEL[order.status]}`} back={back} />
        <div className="print-toolbar">
          <Seg
            value={format}
            options={[
              { value: 'A4', label: 'A4' },
              { value: 'A3', label: 'A3' },
            ]}
            onChange={(f) => {
              setFormat(f);
              try {
                localStorage.setItem('drawing-format', f);
              } catch {
                /* без сохранения */
              }
            }}
          />
          <button className="btn primary" onClick={() => window.print()}>
            🖨 Печать / сохранить PDF
          </button>
          <span className="small muted">Альбомная ориентация. Для PDF выберите в окне печати «Сохранить как PDF».</span>
        </div>
      </div>
      {/* предпросмотр: лист в настоящем размере, уменьшенный под ширину экрана (как в PDF) */}
      <div className="print-pages" style={{ zoom: Math.min(1, (viewW - 16) / ((SW * 96) / 25.4)) }}>
        {pages}
      </div>
      <p className="no-print small muted" style={{ textAlign: 'center', padding: '0 16px 32px' }}>
        Лист показан целиком; чтобы рассмотреть, увеличьте двумя пальцами.
      </p>
    </div>
  );
}
