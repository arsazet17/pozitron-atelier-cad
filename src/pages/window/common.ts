import type { ResolvedMeasures } from '../../model/measurements';
import type { Order, Room, WindowItem } from '../../model/types';

export interface TabProps {
  order: Order;
  room: Room;
  win: WindowItem;
  resolved: ResolvedMeasures;
  setWin: (fn: (w: WindowItem) => WindowItem) => void;
  update: (fn: (o: Order) => Order) => void;
  goTab: (tab: string) => void;
}

/** Затемнение/осветление цвета #rrggbb на коэффициент */
export function shade(hex: string, k: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(k >= 1 ? v + (255 - v) * (k - 1) : v * k)));
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

/** Сохранить или поделиться файлом (на телефоне — системное меню «Поделиться») */
export async function shareOrDownload(blob: Blob, name: string, title: string): Promise<void> {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
