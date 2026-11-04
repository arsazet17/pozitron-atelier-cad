import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useRef, useState } from 'react';
import { getProfile } from '../../db';
import { DrawingSheet, type SheetFormat } from '../../drawing/Sheet';
import { useMaterials, useTech } from '../../hooks';
import { calcProduct } from '../../model/calc';
import { emptyProfile } from '../../model/factory';
import { Seg } from '../../ui';
import { shareOrDownload, type TabProps } from './common';

/** SVG в самостоятельный файл: CSS-переменные заменяются значениями */
export function svgFileText(svg: SVGSVGElement): string {
  const cs = getComputedStyle(svg);
  let text = new XMLSerializer().serializeToString(svg);
  text = text.replace(/var\((--[a-z-]+)\)/g, (_, v) => cs.getPropertyValue(v).trim() || '#000');
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + text;
}

const FORMAT_KEY = 'drawing-format';
export function savedFormat(): SheetFormat {
  try {
    return localStorage.getItem(FORMAT_KEY) === 'A4' ? 'A4' : 'A3';
  } catch {
    return 'A3';
  }
}

export function DrawingTab({ order, room, win, resolved }: TabProps) {
  const { map } = useMaterials();
  const tech = useTech();
  const profile = useLiveQuery(getProfile, []) ?? emptyProfile();
  const ref = useRef<HTMLDivElement>(null);
  const items = useMemo(() => win.products.map((p) => ({ product: p, calc: calcProduct(p, { resolved, tech, materials: map }) })), [win.products, resolved, tech, map]);
  const [format, setFormatState] = useState<SheetFormat>(savedFormat);
  const setFormat = (f: SheetFormat) => {
    setFormatState(f);
    try {
      localStorage.setItem(FORMAT_KEY, f);
    } catch {
      /* без сохранения */
    }
  };

  const downloadSvg = () => {
    const svg = ref.current?.querySelector('svg');
    if (!svg) return;
    const blob = new Blob([svgFileText(svg)], { type: 'image/svg+xml' });
    void shareOrDownload(blob, `chertezh-${order.number}-${win.name.replace(/\s+/g, '-')}.svg`, `Чертёж — заказ № ${order.number}`);
  };

  return (
    <div>
      <div className="row" style={{ marginBottom: 12 }}>
        <Seg value={format} options={[{ value: 'A4', label: 'A4' }, { value: 'A3', label: 'A3' }]} onChange={setFormat} />
        <span className="spacer" />
        <a className="btn primary" href={`#/print/${order.id}/drawing/${win.id}`}>
          🖨 Печать / PDF
        </a>
        <button className="btn" onClick={downloadSvg}>
          SVG
        </button>
      </div>
      <div className="sheet-preview" ref={ref}>
        <DrawingSheet order={order} room={room} win={win} resolved={resolved} items={items} profile={profile} format={format} />
      </div>
      <p className="small muted">
        Чертёж строится из замеров и изделий и перестраивается при любом изменении. Масштаб подбирается сам, чтобы виды поместились на лист. Подписи и размеры исправляются во вкладках «Замеры» и «Изделия».
      </p>
    </div>
  );
}
