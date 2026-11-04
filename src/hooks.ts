import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
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

/** Фото и временная ссылка на него для <image> */
export function usePhoto(photoId: string | undefined): { photo?: Photo; url?: string } {
  const photo = useLiveQuery(() => (photoId ? db.photos.get(photoId) : undefined), [photoId]);
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!photo) {
      setUrl(undefined);
      return;
    }
    const u = URL.createObjectURL(photo.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [photo]);
  return { photo, url };
}
