import { forwardRef, type ReactNode } from 'react';
import type { ResolvedMeasures } from '../model/measurements';
import type { Photo, WindowItem } from '../model/types';
import { facadeGeometry, type FacadeGeometry } from './geometry';
import { apply, homography, isConvexQuad, rectPts, type Matrix3 } from './homography';

/**
 * Перспективная связь «стена (мм) → фото (пиксели)» по четырём углам проёма.
 */
export interface PhotoMapping {
  geo: FacadeGeometry;
  /** Проекция точки стены на фото; нет, если углы не отмечены */
  H: Matrix3 | null;
  /** Размеры проёма известны (а не типовые) */
  openingKnown: boolean;
  cornersValid: boolean;
}

export function photoMapping(win: WindowItem, resolved: ResolvedMeasures, photo: Pick<Photo, 'width' | 'height'>): PhotoMapping {
  const geo = facadeGeometry(win, resolved);
  const openingKnown = !!resolved.values.openingWidth && !!resolved.values.openingHeight;
  const corners = win.photoCorners;
  if (!corners || corners.length !== 4) return { geo, H: null, openingKnown, cornersValid: false };
  const dst = corners.map((c) => ({ x: c.x * photo.width, y: c.y * photo.height }));
  const cornersValid = isConvexQuad(dst);
  const o = geo.opening;
  const src = rectPts(o.x, o.y, o.w, o.h); // ЛВ, ПВ, ПН, ЛН
  return { geo, H: cornersValid ? homography(src, dst) : null, openingKnown, cornersValid };
}

export const projectPt = (H: Matrix3, x: number, y: number) => apply(H, { x, y });

interface SceneProps {
  url: string;
  photo: Pick<Photo, 'width' | 'height'>;
  children?: ReactNode;
  onPointerDown?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerMove?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerUp?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerCancel?: (e: React.PointerEvent<SVGSVGElement>) => void;
  /** Захватывать касания (разметка углов). Иначе фото прокручивается пальцем, как обычная картинка. */
  captureTouch?: boolean;
}

/** Фото с наложенной графикой в координатах снимка */
export const PhotoScene = forwardRef<SVGSVGElement, SceneProps>(function PhotoScene({ url, photo, children, captureTouch, ...handlers }, ref) {
  return (
    <svg
      ref={ref}
      className="photo-scene"
      viewBox={`0 0 ${photo.width} ${photo.height}`}
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      style={{ touchAction: captureTouch ? 'none' : 'auto' }}
      {...handlers}
    >
      <image href={url} x={0} y={0} width={photo.width} height={photo.height} preserveAspectRatio="none" />
      {children}
    </svg>
  );
});

/** Перевод координат указателя в координаты снимка */
export function svgPoint(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const m = svg.getScreenCTM();
  if (!m) return { x: 0, y: 0 };
  const r = pt.matrixTransform(m.inverse());
  return { x: r.x, y: r.y };
}

/** Перерисовать сцену в PNG в полном разрешении фото */
export async function sceneToPng(svg: SVGSVGElement, photoBlob: Blob, photo: Pick<Photo, 'width' | 'height'>): Promise<Blob> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(photoBlob);
  });
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('width', String(photo.width));
  clone.setAttribute('height', String(photo.height));
  clone.querySelectorAll('image').forEach((im) => im.setAttribute('href', dataUrl));
  clone.querySelectorAll('[data-noexport]').forEach((n) => n.remove());
  // переменные CSS в отдельном файле SVG не работают — подставляем значения
  const cs = getComputedStyle(document.documentElement);
  let text = new XMLSerializer().serializeToString(clone);
  text = text.replace(/var\((--[a-z-]+)\)/g, (_, v) => cs.getPropertyValue(v).trim() || '#000');
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text);
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = photo.width;
  canvas.height = photo.height;
  canvas.getContext('2d')!.drawImage(img, 0, 0);
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Не удалось сохранить картинку'))), 'image/jpeg', 0.9));
}
