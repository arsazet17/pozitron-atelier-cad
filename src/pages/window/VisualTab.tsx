import { useMemo, useRef, useState } from 'react';
import { productColor, renderProducts } from '../../drawing/curtains';
import { PhotoScene, photoMapping, sceneToPng } from '../../drawing/PhotoScene';
import { useMaterials, usePhoto, useTech } from '../../hooks';
import { calcProduct } from '../../model/calc';
import { newProduct } from '../../model/factory';
import { toast } from '../../ui';
import { shareOrDownload, type TabProps } from './common';
import { PhotoDims } from './PhotoTab';

export function VisualTab({ order, win, resolved, setWin, goTab }: TabProps) {
  const { photo, url } = usePhoto(win.photoId);
  const { map: materials } = useMaterials();
  const tech = useTech();
  const svgRef = useRef<SVGSVGElement>(null);
  const [saving, setSaving] = useState(false);

  const items = useMemo(() => win.products.map((p) => ({ product: p, calc: calcProduct(p, { resolved, tech, materials }) })), [win.products, resolved, tech, materials]);

  if (!photo || !url) {
    return (
      <div className="card later-box">
        <div className="big">🖼</div>
        <h2>Визуализация</h2>
        <p className="muted">Сначала сфотографируйте окно и отметьте углы проёма.</p>
        <button className="btn accent" onClick={() => goTab('photo')}>
          К фото
        </button>
      </div>
    );
  }

  const map = photoMapping(win, resolved, photo);
  if (!map.H) {
    return (
      <div className="card later-box">
        <div className="big">📐</div>
        <h2>Отметьте углы проёма</h2>
        <p className="muted">По четырём углам программа строит перспективу, чтобы шторы встали на фото правильно.</p>
        <button className="btn accent" onClick={() => goTab('photo')}>
          Отметить углы
        </button>
      </div>
    );
  }

  const setOpen = (open: number) => setWin((w) => ({ ...w, visual: { ...w.visual, open } }));
  const setProduct = (id: string, patch: Partial<(typeof win.products)[number]>) =>
    setWin((w) => ({ ...w, products: w.products.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));

  const save = async () => {
    if (!svgRef.current) return;
    setSaving(true);
    try {
      const blob = await sceneToPng(svgRef.current, photo.blob, photo);
      await shareOrDownload(blob, `zakaz-${order.number}-${win.name.replace(/\s+/g, '-')}.jpg`, `Заказ № ${order.number} — ${win.name}`);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="photo-layout">
      <div className="photo-wrap">
        <PhotoScene ref={svgRef} url={url} photo={photo}>
          {renderProducts(map.H, map.geo, items, win.visual.open, materials)}
          {win.visual.showDims && <PhotoDims map={map} photo={photo} resolved={resolved} showCornice={false} />}
        </PhotoScene>
      </div>
      <div className="photo-side">
        <div className="card">
          <h2>Визуализация</h2>
          {!map.openingKnown && <div className="issue" style={{ marginBottom: 8 }}>⚠️ Размеры проёма не введены — картинка построена по типовым размерам.</div>}
          {win.products.length === 0 ? (
            <>
              <p className="small">Изделий пока нет — показан только карниз. Добавьте шторы, чтобы увидеть их на фото.</p>
              <div className="row">
                <button className="btn accent" onClick={() => setWin((w) => ({ ...w, products: [...w.products, newProduct('tulle'), newProduct('classic')] }))}>
                  + Портьеры и тюль
                </button>
                <button className="btn" onClick={() => goTab('products')}>
                  Другие изделия
                </button>
              </div>
            </>
          ) : (
            <>
              <label className="field">
                <span>Шторы: {win.visual.open < 0.05 ? 'задёрнуты' : win.visual.open > 0.95 ? 'раздвинуты' : `приоткрыты на ${Math.round(win.visual.open * 100)}%`}</span>
                <input type="range" min={0} max={100} value={Math.round(win.visual.open * 100)} onChange={(e) => setOpen(Number(e.target.value) / 100)} />
              </label>
              {win.products.map((p) => {
                const fabric = p.fabricId ? materials.get(p.fabricId) : undefined;
                return (
                  <div key={p.id} className="row" style={{ marginTop: 10, flexWrap: 'nowrap' }}>
                    <input
                      type="color"
                      aria-label={`Цвет: ${p.name}`}
                      value={productColor(p, materials)}
                      disabled={!!fabric?.color}
                      onChange={(e) => setProduct(p.id, { color: e.target.value })}
                      className="color-input"
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 550 }}>{p.name}</div>
                      <div className="small muted">{fabric ? `${fabric.name}${fabric.color ? ' (цвет ткани)' : ''}` : 'ткань не выбрана'}</div>
                    </div>
                    <label className="small muted" style={{ width: 110 }}>
                      прозрачность
                      <input type="range" min={20} max={100} value={Math.round(p.opacity * 100)} onChange={(e) => setProduct(p.id, { opacity: Number(e.target.value) / 100 })} style={{ width: '100%' }} />
                    </label>
                  </div>
                );
              })}
            </>
          )}
          <label className="switch" style={{ marginTop: 8 }}>
            <input type="checkbox" checked={win.visual.showDims} onChange={(e) => setWin((w) => ({ ...w, visual: { ...w.visual, showDims: e.target.checked } }))} />
            Показывать размеры
          </label>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn primary" disabled={saving} onClick={save}>
              {saving ? 'Сохраняю…' : 'Сохранить картинку'}
            </button>
            <button className="btn" onClick={() => goTab('products')}>
              Изделия →
            </button>
          </div>
          <p className="small muted" style={{ marginBottom: 0 }}>
            Картинку можно отправить клиенту как вариант оформления. Для другого варианта смените цвет или ткань и сохраните ещё раз.
          </p>
        </div>
      </div>
    </div>
  );
}
