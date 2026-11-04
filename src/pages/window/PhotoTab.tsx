import { useEffect, useRef, useState } from 'react';
import { db, savePhoto } from '../../db';
import { PhotoScene, photoMapping, projectPt, svgPoint, type PhotoMapping } from '../../drawing/PhotoScene';
import { usePhoto } from '../../hooks';
import { formatMm } from '../../model/measurements';
import type { Photo, Pt } from '../../model/types';
import { toast } from '../../ui';
import type { TabProps } from './common';

const DEFAULT_CORNERS: Pt[] = [
  { x: 0.3, y: 0.25 },
  { x: 0.7, y: 0.25 },
  { x: 0.7, y: 0.72 },
  { x: 0.3, y: 0.72 },
];
const CORNER_NAMES = ['левый верхний', 'правый верхний', 'правый нижний', 'левый нижний'];

/** Размеры поверх фото: контур проёма, карниз и подписи */
export function PhotoDims({ map, photo, resolved, showCornice = true }: { map: PhotoMapping; photo: Pick<Photo, 'width' | 'height'>; resolved: TabProps['resolved']; showCornice?: boolean }) {
  const H = map.H;
  if (!H) return null;
  const { opening: o, cornice: c } = map.geo;
  const fs = Math.max(photo.width, photo.height) * 0.026;
  const P = (x: number, y: number) => projectPt(H, x, y);
  const tl = P(o.x, o.y + o.h);
  const tr = P(o.x + o.w, o.y + o.h);
  const br = P(o.x + o.w, o.y);
  const bl = P(o.x, o.y);
  const label = (x: number, y: number, text: string, rotate = 0, color = '#fff') => (
    <text
      x={x}
      y={y}
      fontSize={fs}
      fontWeight={700}
      textAnchor="middle"
      fill={color}
      stroke="rgba(0,0,0,0.75)"
      strokeWidth={fs * 0.22}
      paintOrder="stroke"
      strokeLinejoin="round"
      transform={rotate ? `rotate(${rotate} ${x} ${y})` : undefined}
      fontFamily="system-ui, sans-serif"
    >
      {text}
    </text>
  );
  const ow = resolved.values.openingWidth?.value;
  const oh = resolved.values.openingHeight?.value;
  const cl = resolved.values.corniceLength?.value;
  const c1 = P(c.x1, c.y);
  const c2 = P(c.x2, c.y);
  const angleTop = (Math.atan2(tr.y - tl.y, tr.x - tl.x) * 180) / Math.PI;
  const angleLeft = (Math.atan2(tl.y - bl.y, tl.x - bl.x) * 180) / Math.PI;
  const sw = fs * 0.14;
  return (
    <g>
      <polygon points={[tl, tr, br, bl].map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#e8b34f" strokeWidth={sw} />
      {label((tl.x + tr.x) / 2, (tl.y + tr.y) / 2 + fs * 1.3, `${formatMm(ow)} мм`, angleTop, '#ffe3a8')}
      {label((tl.x + bl.x) / 2 + fs * 1.1, (tl.y + bl.y) / 2, `${formatMm(oh)} мм`, angleLeft, '#ffe3a8')}
      {showCornice && (
        <>
          <line x1={c1.x} y1={c1.y} x2={c2.x} y2={c2.y} stroke="#d8d8d8" strokeWidth={sw * 2.2} strokeLinecap="round" />
          <line x1={c1.x} y1={c1.y} x2={c2.x} y2={c2.y} stroke="#6b6f75" strokeWidth={sw * 1.2} strokeLinecap="round" />
          {cl !== undefined && label((c1.x + c2.x) / 2, (c1.y + c2.y) / 2 - fs * 0.6, `карниз ${formatMm(cl)} мм`, angleTop)}
        </>
      )}
    </g>
  );
}

export function PhotoTab({ win, resolved, setWin, goTab }: TabProps) {
  const { photo, url } = usePhoto(win.photoId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Pt[] | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const offset = useRef({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(null);
  }, [editing]);

  const takeFile = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try {
      const old = win.photoId;
      const p = await savePhoto(f);
      setWin((w) => ({ ...w, photoId: p.id, photoCorners: undefined }));
      if (old) await db.photos.delete(old);
      setEditing(true);
      toast('Фото сохранено. Отметьте углы проёма.');
    } catch (e) {
      alert((e as Error).message || 'Не удалось сохранить фото');
    } finally {
      setBusy(false);
    }
  };

  const removePhoto = async () => {
    if (!win.photoId || !confirm('Удалить фото этого окна?')) return;
    const id = win.photoId;
    setWin((w) => ({ ...w, photoId: undefined, photoCorners: undefined }));
    await db.photos.delete(id);
    setEditing(false);
  };

  const pickers = (
    <>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => (void takeFile(e.target.files?.[0]), (e.target.value = ''))} />
      <input ref={galleryRef} type="file" accept="image/*" hidden onChange={(e) => (void takeFile(e.target.files?.[0]), (e.target.value = ''))} />
    </>
  );

  if (!win.photoId || !photo || !url) {
    return (
      <div className="card later-box">
        {pickers}
        <div className="big">📷</div>
        <h2>Фото окна</h2>
        <p className="muted">Снимите окно целиком, с карнизом, потолком и полом, по возможности прямо напротив. Фото нужно для разметки и визуализации; точные размеры берутся из замеров.</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn accent" disabled={busy} onClick={() => cameraRef.current?.click()}>
            📷 Сфотографировать
          </button>
          <button className="btn" disabled={busy} onClick={() => galleryRef.current?.click()}>
            🖼 Выбрать из галереи
          </button>
        </div>
        {busy && <p className="muted small">Сохраняю фото…</p>}
      </div>
    );
  }

  const corners = draft ?? win.photoCorners ?? DEFAULT_CORNERS;
  const shownWin = editing ? { ...win, photoCorners: corners } : win;
  const map = photoMapping(shownWin, resolved, photo);
  const px = corners.map((c) => ({ x: c.x * photo.width, y: c.y * photo.height }));
  const k = svgRef.current ? photo.width / svgRef.current.clientWidth : photo.width / 360;
  const handleR = 16 * k;

  const down = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!editing || !svgRef.current) return;
    const p = svgPoint(svgRef.current, e.clientX, e.clientY);
    let best = -1;
    let dist = Infinity;
    px.forEach((c, i) => {
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < dist) {
        dist = d;
        best = i;
      }
    });
    if (dist > handleR * 3.5) return;
    offset.current = { x: px[best].x - p.x, y: px[best].y - p.y };
    setActive(best);
    setDraft(corners);
    svgRef.current.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    if (active === null || !svgRef.current) return;
    const p = svgPoint(svgRef.current, e.clientX, e.clientY);
    const x = Math.min(1, Math.max(0, (p.x + offset.current.x) / photo.width));
    const y = Math.min(1, Math.max(0, (p.y + offset.current.y) / photo.height));
    setDraft((d) => (d ?? corners).map((c, i) => (i === active ? { x, y } : c)));
  };
  const up = () => {
    if (active === null) return;
    setActive(null);
    if (draft) setWin((w) => ({ ...w, photoCorners: draft }));
  };

  // лупа — в углу, противоположном точке, которую двигаем
  const loupe = (() => {
    if (active === null) return null;
    const r = Math.min(photo.width, photo.height) * 0.17;
    const p = px[active];
    const cx = p.x < photo.width / 2 ? photo.width - r - 12 * k : r + 12 * k;
    const cy = r + 12 * k;
    const z = 3;
    return (
      <g data-noexport>
        <defs>
          <clipPath id="loupe-clip">
            <circle cx={cx} cy={cy} r={r} />
          </clipPath>
        </defs>
        <g clipPath="url(#loupe-clip)">
          <rect x={cx - r} y={cy - r} width={2 * r} height={2 * r} fill="#000" />
          <g transform={`translate(${cx} ${cy}) scale(${z}) translate(${-p.x} ${-p.y})`}>
            <image href={url} x={0} y={0} width={photo.width} height={photo.height} preserveAspectRatio="none" />
            <polygon points={px.map((c) => `${c.x},${c.y}`).join(' ')} fill="none" stroke="#e8b34f" strokeWidth={1.5 * k} />
          </g>
          <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke="#ff4d4d" strokeWidth={1.2 * k} />
          <line x1={cx} y1={cy - r} x2={cx} y2={cy + r} stroke="#ff4d4d" strokeWidth={1.2 * k} />
        </g>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#fff" strokeWidth={3 * k} />
      </g>
    );
  })();

  return (
    <div className="photo-layout">
      {pickers}
      <div className="photo-wrap">
        <PhotoScene ref={svgRef} url={url} photo={photo} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          {!editing && <PhotoDims map={map} photo={photo} resolved={resolved} />}
          {editing && (
            <g data-noexport>
              <polygon points={px.map((c) => `${c.x},${c.y}`).join(' ')} fill="rgba(232,179,79,0.18)" stroke={map.cornersValid ? '#e8b34f' : '#ff4d4d'} strokeWidth={2.5 * k} />
              {px.map((c, i) => (
                <g key={i}>
                  <circle cx={c.x} cy={c.y} r={handleR} fill={i === active ? 'rgba(232,179,79,0.55)' : 'rgba(0,0,0,0.35)'} stroke="#fff" strokeWidth={2.5 * k} />
                  <line x1={c.x - handleR * 0.6} y1={c.y} x2={c.x + handleR * 0.6} y2={c.y} stroke="#fff" strokeWidth={1.5 * k} />
                  <line x1={c.x} y1={c.y - handleR * 0.6} x2={c.x} y2={c.y + handleR * 0.6} stroke="#fff" strokeWidth={1.5 * k} />
                  <text x={c.x} y={c.y - handleR * 1.35} fontSize={13 * k} fill="#fff" stroke="#000" strokeWidth={3 * k} paintOrder="stroke" textAnchor="middle" fontFamily="system-ui, sans-serif">
                    {i + 1}
                  </text>
                </g>
              ))}
              {loupe}
            </g>
          )}
        </PhotoScene>
      </div>

      <div className="photo-side">
        {editing ? (
          <div className="card">
            <h2>Углы проёма</h2>
            <p className="small" style={{ marginTop: 0 }}>
              Перетащите 4 точки на углы оконного проёма: 1 — {CORNER_NAMES[0]}, 2 — {CORNER_NAMES[1]}, 3 — {CORNER_NAMES[2]}, 4 — {CORNER_NAMES[3]}. Лупа в углу экрана показывает точку под пальцем.
            </p>
            {!map.cornersValid && <div className="issue error">Точки перепутаны местами — четырёхугольник перекручен.</div>}
            <div className="row">
              <button className="btn primary" disabled={!map.cornersValid} onClick={() => (setWin((w) => ({ ...w, photoCorners: corners })), setEditing(false))}>
                Готово
              </button>
              <button className="btn" onClick={() => (setDraft(DEFAULT_CORNERS), setWin((w) => ({ ...w, photoCorners: DEFAULT_CORNERS })))}>
                Сбросить
              </button>
            </div>
          </div>
        ) : (
          <div className="card">
            <h2>Фото окна</h2>
            {!win.photoCorners && <p className="small">Отметьте углы проёма — тогда размеры, карниз и шторы встанут на фото в правильной перспективе.</p>}
            {win.photoCorners && !map.openingKnown && (
              <div className="issue">⚠️ Введите ширину и высоту проёма во вкладке «Замеры» — сейчас на фото типовые размеры.</div>
            )}
            {win.photoCorners && map.openingKnown && <p className="small muted">Размеры на фото — из замеров. По фото размеры не измеряются.</p>}
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn primary" onClick={() => setEditing(true)}>
                {win.photoCorners ? 'Поправить углы' : 'Отметить углы проёма'}
              </button>
              {win.photoCorners && (
                <button className="btn accent" onClick={() => goTab('visual')}>
                  Визуализация →
                </button>
              )}
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn small" onClick={() => cameraRef.current?.click()}>
                📷 Переснять
              </button>
              <button className="btn small" onClick={() => galleryRef.current?.click()}>
                🖼 Из галереи
              </button>
              <button className="btn small danger" onClick={removePhoto}>
                Удалить фото
              </button>
            </div>
            {busy && <p className="muted small">Сохраняю фото…</p>}
          </div>
        )}
      </div>
    </div>
  );
}
