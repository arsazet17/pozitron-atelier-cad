import Dexie, { type Table } from 'dexie';
import type { AtelierProfile, Material, NumberingSettings, Order } from './model/types';
import { DEFAULT_NUMBERING, emptyProfile, formatOrderNumber, newOrder } from './model/factory';

/**
 * Локальная база на устройстве (IndexedDB). Работает без интернета.
 * Заказ хранится одним документом: так его проще целиком заморозить
 * в согласованную версию (этап 2).
 */

interface SettingRow {
  key: string;
  value: unknown;
}

class AtelierDB extends Dexie {
  orders!: Table<Order, string>;
  materials!: Table<Material, string>;
  settings!: Table<SettingRow, string>;

  constructor() {
    super('pozitron-atelier-cad');
    this.version(1).stores({
      orders: 'id, number, updatedAt, status',
      materials: 'id, kind, name',
      settings: 'key',
    });
  }
}

export const db = new AtelierDB();

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return row ? (row.value as T) : fallback;
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  await db.settings.put({ key, value });
}

export const getProfile = () => getSetting<AtelierProfile>('profile', emptyProfile());
export const getNumbering = () => getSetting<NumberingSettings>('numbering', DEFAULT_NUMBERING);

/** Создаёт заказ со следующим номером и сдвигает счётчик в одной транзакции. */
export async function createOrder(): Promise<Order> {
  return db.transaction('rw', db.orders, db.settings, async () => {
    const numbering = await getNumbering();
    const order = newOrder(formatOrderNumber(numbering.nextNumber, numbering.digits));
    await db.orders.add(order);
    await setSetting('numbering', { ...numbering, nextNumber: numbering.nextNumber + 1 });
    return order;
  });
}

export async function saveOrder(order: Order): Promise<void> {
  await db.orders.put({ ...order, updatedAt: Date.now() });
}

export async function deleteOrder(id: string): Promise<void> {
  await db.orders.delete(id);
}

// ---------- Резервная копия ----------

export interface Backup {
  app: 'pozitron-atelier-cad';
  format: 1;
  exportedAt: string;
  orders: Order[];
  materials: Material[];
  settings: SettingRow[];
}

export async function exportBackup(): Promise<Backup> {
  const [orders, materials, settings] = await Promise.all([db.orders.toArray(), db.materials.toArray(), db.settings.toArray()]);
  return { app: 'pozitron-atelier-cad', format: 1, exportedAt: new Date().toISOString(), orders, materials, settings };
}

/** Восстанавливает копию: записи с теми же id заменяются, остальные сохраняются. */
export async function importBackup(data: unknown): Promise<{ orders: number; materials: number }> {
  const b = data as Partial<Backup>;
  if (!b || b.app !== 'pozitron-atelier-cad' || !Array.isArray(b.orders)) {
    throw new Error('Это не файл резервной копии ПОЗИТРОН АТЕЛЬЕ CAD.');
  }
  await db.transaction('rw', db.orders, db.materials, db.settings, async () => {
    await db.orders.bulkPut(b.orders as Order[]);
    if (Array.isArray(b.materials)) await db.materials.bulkPut(b.materials);
    if (Array.isArray(b.settings)) await db.settings.bulkPut(b.settings);
  });
  return { orders: b.orders.length, materials: b.materials?.length ?? 0 };
}

/** Просим браузер не удалять данные при нехватке места (важно для iPhone/iPad). */
export async function requestPersistentStorage(): Promise<boolean | undefined> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* браузер не поддерживает */
  }
  return undefined;
}
