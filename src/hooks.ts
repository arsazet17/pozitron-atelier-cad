import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { db } from './db';
import { DEFAULT_TECH } from './model/factory';
import type { Material, Photo, TechSettings } from './model/types';

/** Справочник материалов как Map по id (обновляется сам при изменениях) */
export function useMaterials(): { list: Material[]; map: Map<string, Material> } {
  const list = useLiveQuery(() => db.materials.orderBy('name').toArray(), []) ?? [];
  const map = useMemo(() => new Map(list.map((m) => [m.id, m])), [list]);
  return { list, map };
}

export function useTech(): TechSettings {
  const row = useLiveQuery(() => db.settings.get('tech'), []);
  return useMemo(() => ({ ...DEFAULT_TECH, ...((row?.value as Partial<TechSettings>) ?? {}) }), [row]);
}

/** Сторона уменьшенной копии фото для экрана, px */
const PREVIEW_SIDE = 1280;
/** Уменьшенные копии по id фото — чтобы не пересчитывать при каждом открытии вкладки */
const previewCache = new Map<string, string>();

async function makePreview(photo: Photo): Promise<string> {
  const k = Math.min(1, PREVIEW_SIDE / Math.max(photo.width, photo.height));
  if (k >= 1) return URL.createObjectURL(photo.blob);
  const bmp = await createImageBitmap(photo.blob);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(photo.width * k);
  canvas.height = Math.round(photo.height * k);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close?.();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
  return URL.createObjectURL(blob ?? photo.blob);
}

/**
 * Фото и ссылка для показа на экране.
 * На экран идёт уменьшенная копия (до 1280 px): телефон рисует её в разы быстрее,
 * а сохранение картинки по-прежнему берёт полное фото.
 */
export function usePhoto(photoId: string | undefined, full = false): { photo?: Photo; url?: string } {
  const photo = useLiveQuery(() => (photoId ? db.photos.get(photoId) : undefined), [photoId]);
  const [url, setUrl] = useState<string | undefined>(() => (photoId && !full ? previewCache.get(photoId) : undefined));
  useEffect(() => {
    if (!photo) {
      setUrl(undefined);
      return;
    }
    if (full) {
      // для печати — полное фото
      const u = URL.createObjectURL(photo.blob);
      setUrl(u);
      return () => URL.revokeObjectURL(u);
    }
    const cached = previewCache.get(photo.id);
    if (cached) {
      setUrl(cached);
      return;
    }
    let alive = true;
    makePreview(photo)
      .catch(() => URL.createObjectURL(photo.blob))
      .then((u) => {
        previewCache.set(photo.id, u);
        if (alive) setUrl(u);
      });
    return () => {
      alive = false;
    };
  }, [photo, full]);
  return { photo, url };
}

/**
 * Значение ползунка: двигается сразу на экране, а в заказ записывается,
 * когда палец остановился (не на каждый сдвиг).
 */
export function useDeferredCommit<T>(value: T, commit: (v: T) => void, delay = 250): [T, (v: T) => void] {
  const [local, setLocal] = useState(value);
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef(commit);
  latest.current = commit;
  useEffect(() => setLocal(value), [value]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const set = (v: T) => {
    setLocal(v);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => latest.current(v), delay);
  };
  return [local, set];
}
