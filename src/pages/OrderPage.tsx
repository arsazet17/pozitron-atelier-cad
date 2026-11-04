import { useMemo } from 'react';
import { deleteOrder } from '../db';
import { FacadeSchematic } from '../drawing/FacadeSchematic';
import { newRoom, newWindow } from '../model/factory';
import { completeness, resolveMeasures } from '../model/measurements';
import { ORDER_STATUS_LABEL, type Customer, type OrderStatus, type Room, type WindowItem } from '../model/types';
import { Seg, SelectField, TextField, TopBar, formatDate, go, toast, useOrderDoc } from '../ui';

const STATUS_OPTIONS = (Object.keys(ORDER_STATUS_LABEL) as OrderStatus[]).map((s) => ({ value: s, label: ORDER_STATUS_LABEL[s] }));

function WindowTile({ orderId, win }: { orderId: string; win: WindowItem }) {
  const resolved = useMemo(() => resolveMeasures(win), [win]);
  const { known, total } = completeness(resolved);
  const errors = resolved.issues.filter((i) => i.level === 'error').length;
  return (
    <a className="window-tile" href={`#/order/${orderId}/window/${win.id}`}>
      <div className="mini">
        <FacadeSchematic win={win} resolved={resolved} errorKeys={new Set()} mini />
      </div>
      <div className="name">{win.name}</div>
      <div className="progress" title={`Основных размеров: ${known} из ${total}`}>
        <i style={{ width: `${(known / total) * 100}%` }} />
      </div>
      <div className="small muted">
        {known === total ? 'Основные размеры есть' : `Размеров: ${known} из ${total}`}
        {errors > 0 && <span style={{ color: 'var(--danger)' }}> · ошибок: {errors}</span>}
      </div>
    </a>
  );
}

export function OrderPage({ id }: { id: string }) {
  const { order, update } = useOrderDoc(id);

  if (order === undefined) return <TopBar title="Загрузка…" back="/" />;
  if (order === null) {
    return (
      <>
        <TopBar title="Заказ не найден" back="/" />
        <main>
          <p className="muted">Этот заказ удалён или открыт на другом устройстве.</p>
        </main>
      </>
    );
  }

  const setCustomer = (patch: Partial<Customer>) => update((o) => ({ ...o, customer: { ...o.customer, ...patch } }));
  const setRoom = (roomId: string, fn: (r: Room) => Room) => update((o) => ({ ...o, rooms: o.rooms.map((r) => (r.id === roomId ? fn(r) : r)) }));
  const c = order.customer;

  const addWindow = (roomId: string) => {
    const room = order.rooms.find((r) => r.id === roomId)!;
    const w = newWindow(room.windows.length + 1);
    setRoom(roomId, (r) => ({ ...r, windows: [...r.windows, w] }));
    go(`/order/${order.id}/window/${w.id}`);
  };

  const removeRoom = (room: Room) => {
    if (!confirm(`Удалить помещение «${room.name}» и все его окна (${room.windows.length})?`)) return;
    update((o) => ({ ...o, rooms: o.rooms.filter((r) => r.id !== room.id) }));
  };

  const removeOrder = async () => {
    if (!confirm(`Удалить заказ № ${order.number} целиком? Это нельзя отменить.`)) return;
    await deleteOrder(order.id);
    toast(`Заказ № ${order.number} удалён`);
    go('/');
  };

  return (
    <>
      <TopBar title={`Заказ № ${order.number}`} sub={`создан ${formatDate(order.createdAt)}`} back="/" />
      <main>
        <div className="card">
          <div className="grid2">
            <TextField label="Название заказа" placeholder="Например: квартира на Ленина" value={order.title} onChange={(title) => update((o) => ({ ...o, title }))} />
            <SelectField label="Статус" value={order.status} options={STATUS_OPTIONS} onChange={(status) => update((o) => ({ ...o, status }))} />
          </div>
        </div>

        <div className="section-title">Заказчик</div>
        <div className="card">
          <div style={{ marginBottom: 12 }}>
            <Seg
              value={c.kind}
              options={[
                { value: 'person', label: 'Частное лицо' },
                { value: 'company', label: 'Организация / ИП' },
              ]}
              onChange={(kind) => setCustomer({ kind })}
            />
          </div>
          <div className="grid2">
            <TextField label={c.kind === 'person' ? 'ФИО' : 'Наименование'} value={c.name} onChange={(name) => setCustomer({ name })} autoComplete="name" />
            <TextField label="Телефон" type="tel" inputMode="tel" value={c.phone} onChange={(phone) => setCustomer({ phone })} />
            <TextField label="Эл. почта" type="email" inputMode="email" value={c.email} onChange={(email) => setCustomer({ email })} />
            <TextField label="Адрес объекта" value={c.objectAddress} onChange={(objectAddress) => setCustomer({ objectAddress })} />
            {c.kind === 'company' && (
              <>
                <TextField label="ИНН" inputMode="numeric" value={c.inn} onChange={(inn) => setCustomer({ inn })} />
                <TextField label="КПП" inputMode="numeric" value={c.kpp} onChange={(kpp) => setCustomer({ kpp })} />
                <TextField label="Юридический адрес" value={c.legalAddress} onChange={(legalAddress) => setCustomer({ legalAddress })} />
                <TextField label="Представитель (ФИО, должность)" value={c.representative} onChange={(representative) => setCustomer({ representative })} />
              </>
            )}
          </div>
          <div style={{ marginTop: 12 }}>
            <TextField label="Примечание" multiline value={c.note} onChange={(note) => setCustomer({ note })} />
          </div>
          {c.phone && (
            <div className="row" style={{ marginTop: 12 }}>
              <a className="btn small" href={`tel:${c.phone.replace(/[^\d+]/g, '')}`}>
                📞 Позвонить
              </a>
              {c.email && (
                <a className="btn small" href={`mailto:${c.email}`}>
                  ✉️ Написать
                </a>
              )}
            </div>
          )}
        </div>

        <div className="section-title">Помещения и окна</div>
        {order.rooms.map((room) => (
          <div className="card room" key={room.id}>
            <div className="room-head">
              <input aria-label="Название помещения" value={room.name} onChange={(e) => setRoom(room.id, (r) => ({ ...r, name: e.target.value }))} />
              <span className="small muted">окон: {room.windows.length}</span>
              <button className="icon-btn" aria-label="Удалить помещение" title="Удалить помещение" onClick={() => removeRoom(room)} style={{ fontSize: 18 }}>
                🗑
              </button>
            </div>
            <div className="window-tiles">
              {room.windows.map((w) => (
                <WindowTile key={w.id} orderId={order.id} win={w} />
              ))}
              <button className="window-tile add" onClick={() => addWindow(room.id)}>
                <span style={{ fontSize: 28 }}>＋</span>
                Добавить окно
              </button>
            </div>
          </div>
        ))}
        <div className="row" style={{ marginTop: 12 }}>
          <button
            className="btn"
            onClick={() => {
              const name = prompt('Название помещения', 'Спальня');
              if (name?.trim()) update((o) => ({ ...o, rooms: [...o.rooms, newRoom(name.trim())] }));
            }}
          >
            + Помещение
          </button>
          <span className="spacer" />
          <button className="btn danger" onClick={removeOrder}>
            Удалить заказ
          </button>
        </div>
      </main>
    </>
  );
}
