import Dexie, { type Table } from 'dexie';
import type { AtelierProfile, Material, NumberingSettings, Order, Photo, TechSettings } from './model/types';
import { DEFAULT_NUMBERING, DEFAULT_TECH, emptyProfile, formatOrderNumber, newOrder, normalizeOrder } from './model/factory';

/**
 * Локальная база на устройстве (IndexedDB). Работает без интернета.
 * Заказ хранится одним документом: так его проще целиком заморозить
 * в согласованную версию (этап 2). Фото — отдельно, чтобы заказ оставался лёгким.
 */

interface SettingRow {
  key: string;
  value: unknown;
}

class AtelierDB extends Dexie {
  orders!: Table<Order, string>;
  materials!: Table<Material, string>;
  settings!: Table<SettingRow, string>;
  photos!: Table<Photo, string>;

  constructor() {
    super('pozitron-atelier-cad');
    this.version(1).stores({
      orders: 'id, number, updatedAt, status',
      materials: 'id, kind, name',
      settings: 'key',
    });
    this.version(2).stores({
      photos: 'id',
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
export const getTech = async () => ({ ...DEFAULT_TECH, ...(await getSetting<Partial<TechSettings>>('tech', {})) });

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

export async function getOrder(id: string): Promise<Order | undefined> {
  const o = await db.orders.get(id);
  return o ? normalizeOrder(o) : undefined;
}

export async function saveOrder(order: Order): Promise<void> {
  await db.orders.put({ ...order, updatedAt: Date.now() });
}

export async function deleteOrder(id: string): Promise<void> {
  const o = await db.orders.get(id);
  const photoIds = o?.rooms.flatMap((r) => r.windows.map((w) => w.photoId).filter(Boolean) as string[]) ?? [];
  await db.transaction('rw', db.orders, db.photos, async () => {
    await db.photos.bulkDelete(photoIds);
    await db.orders.delete(id);
  });
}

// ---------- Фото ----------

const MAX_SIDE = 2400;

/** Уменьшает снимок до 2400 px по большей стороне и сохраняет JPEG. Поворот по EXIF учитывается. */
export async function savePhoto(file: Blob): Promise<Photo> {
  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  } catch {
    source = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Не удалось открыть изображение.'));
      img.src = URL.createObjectURL(file);
    });
  }
  const sw = 'naturalWidth' in source ? source.naturalWidth : source.width;
  const sh = 'naturalHeight' in source ? source.naturalHeight : source.height;
  const k = Math.min(1, MAX_SIDE / Math.max(sw, sh));
  const width = Math.round(sw * k);
  const height = Math.round(sh * k);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(source, 0, 0, width, height);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Не удалось сохранить фото.'))), 'image/jpeg', 0.86));
  const photo: Photo = { id: crypto.randomUUID?.() ?? String(Date.now()), blob, width, height, createdAt: Date.now() };
  await db.photos.put(photo);
  return photo;
}

// ---------- Резервная копия ----------

interface PhotoDump extends Omit<Photo, 'blob'> {
  dataUrl: string;
}

export interface Backup {
  app: 'pozitron-atelier-cad';
  format: 1 | 2;
  exportedAt: string;
  orders: Order[];
  materials: Material[];
  settings: SettingRow[];
  photos?: PhotoDump[];
}

const blobToDataUrl = (b: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });

export async function exportBackup(): Promise<Backup> {
  const [orders, materials, settings, photos] = await Promise.all([db.orders.toArray(), db.materials.toArray(), db.settings.toArray(), db.photos.toArray()]);
  const dumps: PhotoDump[] = [];
  for (const p of photos) dumps.push({ id: p.id, width: p.width, height: p.height, createdAt: p.createdAt, dataUrl: await blobToDataUrl(p.blob) });
  return { app: 'pozitron-atelier-cad', format: 2, exportedAt: new Date().toISOString(), orders, materials, settings, photos: dumps };
}

/** Восстанавливает копию: записи с теми же id заменяются, остальные сохраняются. */
export async function importBackup(data: unknown): Promise<{ orders: number; materials: number }> {
  const b = data as Partial<Backup>;
  if (!b || b.app !== 'pozitron-atelier-cad' || !Array.isArray(b.orders)) {
    throw new Error('Это не файл резервной копии ПОЗИТРОН АТЕЛЬЕ CAD.');
  }
  const photos: Photo[] = [];
  for (const p of b.photos ?? []) {
    const blob = await (await fetch(p.dataUrl)).blob();
    photos.push({ id: p.id, width: p.width, height: p.height, createdAt: p.createdAt, blob });
  }
  await db.transaction('rw', [db.orders, db.materials, db.settings, db.photos], async () => {
    await db.orders.bulkPut(b.orders as Order[]);
    if (Array.isArray(b.materials)) await db.materials.bulkPut(b.materials);
    if (Array.isArray(b.settings)) await db.settings.bulkPut(b.settings);
    if (photos.length) await db.photos.bulkPut(photos);
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
