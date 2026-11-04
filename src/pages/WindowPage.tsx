import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { db } from '../db';
import { FacadeSchematic } from '../drawing/FacadeSchematic';
import { uid } from '../model/factory';
import {
  DEF_BY_KEY,
  GROUP_LABEL,
  MEASURE_DEFS,
  formatMm,
  isFieldVisible,
  parseMm,
  resolveMeasures,
  type MeasureGroup,
  type ResolvedValue,
} from '../model/measurements';
import type { MeasureKey, Mm, WindowItem } from '../model/types';
import { Seg, TextField, TopBar, go, useOrderDoc } from '../ui';
import { EstimateTab } from './EstimateView';
import type { TabProps } from './window/common';
import { CuttingTab } from './window/CuttingTab';
import { DrawingTab } from './window/DrawingTab';
import { PhotoTab } from './window/PhotoTab';
import { ProductsTab } from './window/ProductsTab';
import { VisualTab } from './window/VisualTab';

type Tab = 'photo' | 'measures' | 'products' | 'visual' | 'drawing' | 'cutting' | 'estimate';

/** Порядок вкладок повторяет порядок работы: фото → замеры → изделия → … → смета */
export const WINDOW_TABS: { id: Tab; icon: string; label: string; title: string }[] = [
  { id: 'photo', icon: '📷', label: 'Фото', title: 'Фото окна' },
  { id: 'measures', icon: '📏', label: 'Замеры', title: 'Замеры' },
  { id: 'products', icon: '🧵', label: 'Изделия', title: 'Изделия и карниз' },
  { id: 'visual', icon: '🖼', label: 'Визуал', title: 'Визуализация' },
  { id: 'drawing', icon: '📐', label: 'Чертёж', title: 'Чертёж' },
  { id: 'cutting', icon: '✂️', label: 'Раскрой', title: 'Раскрой' },
  { id: 'estimate', icon: '💰', label: 'Смета', title: 'Смета' },
];
const TABS = WINDOW_TABS;

const GROUPS: MeasureGroup[] = ['opening', 'wall', 'sill', 'radiator', 'cornice', 'product'];

/** Поле ввода миллиметров. Пустое поле показывает вычисленное значение подсказкой. */
function MmInput(props: {
  id: string;
  value: Mm | undefined;
  resolved?: ResolvedValue;
  allowNegative?: boolean;
  onCommit: (v: Mm | undefined) => void;
  onFocus: () => void;
  onEnter: () => void;
  inputRef: (el: HTMLInputElement | null) => void;
}) {
  const [text, setText] = useState(props.value === undefined ? '' : String(props.value));
  const [bad, setBad] = useState(false);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) {
      setText(props.value === undefined ? '' : String(props.value));
      setBad(false);
    }
  }, [props.value]);

  const placeholder = props.resolved && props.resolved.source !== 'measured' ? formatMm(props.resolved.value) : '';

  return (
    <div className="mm-input">
      <input
        id={props.id}
        ref={props.inputRef}
        className={bad ? 'bad' : ''}
        inputMode={props.allowNegative ? 'text' : 'numeric'}
        enterKeyHint="next"
        autoComplete="off"
        value={text}
        placeholder={placeholder}
        onFocus={(e) => {
          focused.current = true;
          props.onFocus();
          e.target.select();
        }}
        onBlur={() => {
          focused.current = false;
          if (bad) {
            setText(props.value === undefined ? '' : String(props.value));
            setBad(false);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            props.onEnter();
          }
        }}
        onChange={(e) => {
          setText(e.target.value);
          const p = parseMm(e.target.value);
          if (p === 'invalid' || (p !== undefined && p < 0 && !props.allowNegative)) {
            setBad(true);
            return;
          }
          setBad(false);
          props.onCommit(p);
        }}
      />
      <span className="unit">мм</span>
    </div>
  );
}

function MeasuresTab({ order, win, resolved, setWin, update }: TabProps) {
  const [focus, setFocus] = useState<MeasureKey | undefined>();
  const inputs = useRef(new Map<MeasureKey, HTMLInputElement>());

  const setMeasure = (key: MeasureKey, value: Mm | undefined) =>
    setWin((w) => {
      const measures = { ...w.measures };
      if (value === undefined) delete measures[key];
      else measures[key] = value;
      return { ...w, measures };
    });

  const visibleDefs = MEASURE_DEFS.filter((d) => isFieldVisible(d, win));
  const order_ = GROUPS.flatMap((g) => visibleDefs.filter((d) => d.group === g).map((d) => d.key));
  const errorKeys = new Set(resolved.issues.filter((i) => i.level === 'error').flatMap((i) => i.keys));

  const pick = (key: MeasureKey) => {
    const el = inputs.current.get(key);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.focus({ preventScroll: true });
    }
    setFocus(key);
  };

  const next = (key: MeasureKey) => {
    const i = order_.indexOf(key);
    const k = order_[i + 1];
    if (k) pick(k);
    else inputs.current.get(key)?.blur();
  };

  const removeWindow = () => {
    if (!confirm(`Удалить «${win.name}» со всеми замерами?`)) return;
    update((o) => ({ ...o, rooms: o.rooms.map((r) => ({ ...r, windows: r.windows.filter((w) => w.id !== win.id) })) }));
    if (win.photoId) void db.photos.delete(win.photoId);
    go(`/order/${order.id}`);
  };

  const measuredCount = Object.keys(win.measures).length;
  const focusDef = focus ? DEF_BY_KEY[focus] : undefined;

  return (
          <div className="measure-layout">
            <div className="schematic-wrap">
              <FacadeSchematic win={win} resolved={resolved} focus={focus} errorKeys={errorKeys} onPick={pick} />
              <div className="schematic-caption">
                {focusDef ? (
                  <span>
                    <b>{focusDef.label}</b>
                    {focusDef.hint ? ` — ${focusDef.hint.toLowerCase()}` : ''}
                  </span>
                ) : (
                  <span>Нажмите на размер на схеме, чтобы ввести его. «?» — размер ещё не известен, курсив — вычислен.</span>
                )}
              </div>
            </div>

            <div>
              <div className="card">
                <div className="grid2">
                  <TextField label="Название окна" value={win.name} onChange={(name) => setWin((w) => ({ ...w, name }))} />
                  <label className="field">
                    <span>Крепление карниза</span>
                    <Seg
                      value={win.corniceMount}
                      options={[
                        { value: 'wall', label: 'Настенный' },
                        { value: 'ceiling', label: 'Потолочный' },
                      ]}
                      onChange={(corniceMount) => setWin((w) => ({ ...w, corniceMount }))}
                    />
                  </label>
                </div>
                <label className="switch" style={{ marginTop: 8 }}>
                  <input type="checkbox" checked={win.hasRadiator} onChange={(e) => setWin((w) => ({ ...w, hasRadiator: e.target.checked }))} />
                  Под окном есть батарея
                </label>
              </div>

              <div className="issues" style={{ marginTop: 12 }}>
                {resolved.issues.map((iss, i) => (
                  <div key={i} className={'issue ' + iss.level} role={iss.level === 'error' ? 'alert' : undefined}>
                    <span>{iss.level === 'error' ? '⛔' : '⚠️'}</span>
                    <span>{iss.message}</span>
                  </div>
                ))}
                {resolved.issues.length === 0 && measuredCount >= 4 && (
                  <div className="issue okay">
                    <span>✓</span>
                    <span>Цепочки размеров сходятся.</span>
                  </div>
                )}
              </div>

              {GROUPS.map((g) => {
                const defs = visibleDefs.filter((d) => d.group === g);
                if (defs.length === 0) return null;
                return (
                  <div className="card mgroup" key={g} style={{ marginTop: 12 }}>
                    <h2>{GROUP_LABEL[g]}</h2>
                    {defs.map((d) => {
                      const rv = resolved.values[d.key];
                      const derived = rv && rv.source !== 'measured';
                      return (
                        <div key={d.key} className={'mrow' + (focus === d.key ? ' focus' : '') + (errorKeys.has(d.key) ? ' err' : '')}>
                          <label htmlFor={'m-' + d.key}>
                            <div className="lbl">{d.label}</div>
                            {derived ? (
                              <div className="derived">
                                {rv.source === 'default' ? 'По умолчанию' : 'Вычислено'}: {formatMm(rv.value)} мм{rv.formula ? ` (${rv.formula})` : ''}
                              </div>
                            ) : (
                              d.hint && <div className="hint">{d.hint}</div>
                            )}
                          </label>
                          <MmInput
                            id={'m-' + d.key}
                            value={win.measures[d.key]}
                            resolved={rv}
                            allowNegative={d.key === 'radiatorOffset'}
                            onCommit={(v) => setMeasure(d.key, v)}
                            onFocus={() => setFocus(d.key)}
                            onEnter={() => next(d.key)}
                            inputRef={(el) => {
                              if (el) inputs.current.set(d.key, el);
                              else inputs.current.delete(d.key);
                            }}
                          />
                        </div>
                      );
                    })}
                    {g === 'cornice' && (
                      <div className="mrow">
                        <span className="hint">Вынос карниза и выступ подоконника видны на виде сбоку — он появится в разделе «Чертёж».</span>
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="card mgroup" style={{ marginTop: 12 }}>
                <h2>Дополнительные размеры</h2>
                {win.extras.map((x) => (
                  <div className="mrow" key={x.id} style={{ gridTemplateColumns: 'minmax(0, 1fr) 180px' }}>
                    <input
                      aria-label="Что измерено"
                      placeholder="Что измерено"
                      value={x.label}
                      onChange={(e) => setWin((w) => ({ ...w, extras: w.extras.map((y) => (y.id === x.id ? { ...y, label: e.target.value } : y)) }))}
                      style={{ border: 0, background: 'transparent', outline: 'none', fontWeight: 550, minHeight: 40 }}
                    />
                    <div className="row" style={{ flexWrap: 'nowrap' }}>
                      <MmInput
                        id={'x-' + x.id}
                        value={x.value}
                        onCommit={(v) => setWin((w) => ({ ...w, extras: w.extras.map((y) => (y.id === x.id ? { ...y, value: v } : y)) }))}
                        onFocus={() => setFocus(undefined)}
                        onEnter={() => undefined}
                        inputRef={() => undefined}
                      />
                      <button className="icon-btn" aria-label="Удалить размер" style={{ fontSize: 16 }} onClick={() => setWin((w) => ({ ...w, extras: w.extras.filter((y) => y.id !== x.id) }))}>
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
                <div className="mrow" style={{ gridTemplateColumns: '1fr' }}>
                  <button className="btn small" onClick={() => setWin((w) => ({ ...w, extras: [...w.extras, { id: uid(), label: '' }] }))}>
                    + Добавить размер
                  </button>
                </div>
              </div>

              <div className="card" style={{ marginTop: 12 }}>
                <TextField label="Комментарий к окну" multiline placeholder="Особенности помещения, материал стен, пожелания заказчика…" value={win.comment} onChange={(comment) => setWin((w) => ({ ...w, comment }))} />
              </div>

              <div className="row" style={{ marginTop: 12 }}>
                <span className="spacer" />
                <button className="btn danger" onClick={removeWindow}>
                  Удалить окно
                </button>
              </div>
            </div>
          </div>
  );
}

export function WindowPage({ id, windowId, tab: routeTab }: { id: string; windowId: string; tab?: string }) {
  const { order, update } = useOrderDoc(id);
  const tab: Tab = TABS.some((t) => t.id === routeTab) ? (routeTab as Tab) : 'measures';

  const room = order?.rooms.find((r) => r.windows.some((w) => w.id === windowId));
  const win = room?.windows.find((w) => w.id === windowId);
  const resolved = useMemo(() => (win ? resolveMeasures(win) : undefined), [win]);

  if (order === undefined) return <TopBar title="Загрузка…" back="/" />;
  if (!order || !room || !win || !resolved) {
    return (
      <>
        <TopBar title="Окно не найдено" back={order ? `/order/${order.id}` : '/'} />
        <main>
          <p className="muted">Окно удалено.</p>
        </main>
      </>
    );
  }

  const setWin = (fn: (w: WindowItem) => WindowItem) =>
    update((o) => ({
      ...o,
      rooms: o.rooms.map((r) => ({ ...r, windows: r.windows.map((w) => (w.id === windowId ? { ...fn(w), updatedAt: Date.now() } : w)) })),
    }));
  // вкладка хранится в адресе: «Назад» и обновление страницы возвращают на неё же
  const goTab = (t: string) => location.replace(`#/order/${order.id}/window/${windowId}/${t}`);

  const props: TabProps = { order, room, win, resolved, setWin, update, goTab };
  const content: Record<Tab, () => ReactNode> = {
    photo: () => <PhotoTab {...props} />,
    measures: () => <MeasuresTab {...props} />,
    products: () => <ProductsTab {...props} />,
    visual: () => <VisualTab {...props} />,
    drawing: () => <DrawingTab {...props} />,
    cutting: () => <CuttingTab {...props} />,
    estimate: () => <EstimateTab {...props} />,
  };

  return (
    <>
      <TopBar title={`${TABS.find((t) => t.id === tab)!.title} · ${win.name}`} sub={`Заказ № ${order.number} · ${room.name}`} back={`/order/${order.id}`} />
      <main>{content[tab]()}</main>
      {/* разделы окна — всегда внизу экрана, как в обычных приложениях */}
      <nav className="bottomnav tabbar" aria-label="Разделы окна">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => goTab(t.id)}>
            <span className="ico">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </>
  );
}
