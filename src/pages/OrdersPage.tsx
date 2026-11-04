import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { createOrder, db } from '../db';
import { ORDER_STATUS_LABEL, type Order } from '../model/types';
import { TopBar, formatDate, go } from '../ui';
import { InstallBanner } from '../pwa';

function windowCount(o: Order) {
  return o.rooms.reduce((n, r) => n + r.windows.length, 0);
}

function matches(o: Order, q: string) {
  if (!q) return true;
  const s = q.toLowerCase();
  return [o.number, o.title, o.customer.name, o.customer.phone, o.customer.objectAddress].some((f) => f.toLowerCase().includes(s));
}

const HOWTO_KEY = 'howto-hidden';

/** Короткая памятка: где что находится */
function HowTo() {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(HOWTO_KEY) === '1';
    } catch {
      return false;
    }
  });
  if (hidden) return null;
  return (
    <div className="card how-to">
      <div className="row">
        <b>Как работать</b>
        <span className="spacer" />
        <button
          className="btn small"
          onClick={() => {
            setHidden(true);
            try {
              localStorage.setItem(HOWTO_KEY, '1');
            } catch {
              /* приватный режим */
            }
          }}
        >
          Понятно
        </button>
      </div>
      <ol>
        <li>
          <b>+ Новый заказ</b> — заказчик и адрес.
        </li>
        <li>В заказе нажмите на <b>окно</b>.</li>
        <li>
          Внизу экрана окна — разделы: 📷 Фото, 📏 Замеры, 🧵 Изделия, 🖼 Визуал, 📐 Чертёж, ✂️ Раскрой, 💰 Смета.
        </li>
        <li>Смета всего заказа и печать — внизу карточки заказа.</li>
        <li>
          Ткани, цены и реквизиты — в <b>⚙️ Настройках</b>.
        </li>
      </ol>
    </div>
  );
}

export function OrdersPage() {
  const orders = useLiveQuery(() => db.orders.orderBy('updatedAt').reverse().toArray(), []);
  const [q, setQ] = useState('');

  const add = async () => {
    const o = await createOrder();
    go(`/order/${o.id}`);
  };

  const list = (orders ?? []).filter((o) => matches(o, q.trim()));

  return (
    <>
      <TopBar title="ПОЗИТРОН АТЕЛЬЕ CAD" sub={`Заказы · версия ${__APP_VERSION__}`} />
      <main>
        <InstallBanner />
        <HowTo />
        <div className="toolbar">
          <label className="field">
            <input type="search" placeholder="Поиск: номер, заказчик, телефон, адрес" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Поиск заказов" />
          </label>
          <button className="btn primary" onClick={add}>
            + Новый заказ
          </button>
        </div>

        {orders && orders.length === 0 && (
          <div className="card empty">
            <div className="big">🪟</div>
            <p>
              Заказов пока нет.
              <br />
              Создайте первый — внесите заказчика и замеры окна.
            </p>
            <button className="btn accent" onClick={add}>
              Создать заказ
            </button>
          </div>
        )}

        {orders && orders.length > 0 && list.length === 0 && <p className="muted">Ничего не найдено.</p>}

        <div className="order-list">
          {list.map((o) => (
            <a key={o.id} className="card order-item" href={`#/order/${o.id}`}>
              <div className="row">
                <span className="no">№ {o.number}</span>
                <span className="spacer" />
                <span className={'badge' + (o.status === 'approved' || o.status === 'done' ? ' ok' : '')}>{ORDER_STATUS_LABEL[o.status]}</span>
              </div>
              <div className="who">{o.customer.name || o.title || 'Заказчик не указан'}</div>
              <div className="meta">
                {o.customer.objectAddress && <div>{o.customer.objectAddress}</div>}
                <div>
                  Помещений: {o.rooms.length} · Окон: {windowCount(o)} · изменён {formatDate(o.updatedAt)}
                </div>
              </div>
            </a>
          ))}
        </div>
      </main>
    </>
  );
}
