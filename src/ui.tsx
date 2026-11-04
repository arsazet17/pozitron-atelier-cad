import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { db } from './db';
import type { Order } from './model/types';

// ---------- маршруты (по хэшу: работает на GitHub Pages без настроек сервера) ----------

export type Route =
  | { page: 'orders' }
  | { page: 'order'; id: string }
  | { page: 'window'; id: string; windowId: string }
  | { page: 'settings' };

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'order' && parts[1] && parts[2] === 'window' && parts[3]) return { page: 'window', id: parts[1], windowId: parts[3] };
  if (parts[0] === 'order' && parts[1]) return { page: 'order', id: parts[1] };
  if (parts[0] === 'settings') return { page: 'settings' };
  return { page: 'orders' };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  useEffect(() => {
    const on = () => {
      setRoute(parseRoute(location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export const go = (path: string) => {
  location.hash = path;
};

// ---------- заказ как редактируемый документ ----------

/**
 * Загружает заказ в память, правки применяет сразу на экране
 * и записывает в базу с задержкой 400 мс (и немедленно при уходе со страницы).
 */
export function useOrderDoc(id: string) {
  const [order, setOrder] = useState<Order | null | undefined>(undefined);
  const current = useRef<Order | null>(null);
  const pending = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    if (pending.current && current.current) {
      pending.current = false;
      void db.orders.put(current.current);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    db.orders.get(id).then((o) => {
      if (!alive) return;
      current.current = o ?? null;
      setOrder(o ?? null);
    });
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => {
      alive = false;
      flush();
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
    };
  }, [id, flush]);

  const update = useCallback(
    (fn: (o: Order) => Order) => {
      if (!current.current) return;
      const next = { ...fn(current.current), updatedAt: Date.now() };
      current.current = next;
      pending.current = true;
      setOrder(next);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, 400);
    },
    [flush],
  );

  return { order, update, flush };
}

// ---------- поля ----------

export function TextField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  inputMode?: 'text' | 'tel' | 'email' | 'numeric' | 'decimal' | 'url';
  placeholder?: string;
  multiline?: boolean;
  autoComplete?: string;
}) {
  return (
    <label className="field">
      <span>{props.label}</span>
      {props.multiline ? (
        <textarea value={props.value} placeholder={props.placeholder} onChange={(e) => props.onChange(e.target.value)} />
      ) : (
        <input
          type={props.type ?? 'text'}
          inputMode={props.inputMode}
          value={props.value}
          placeholder={props.placeholder}
          autoComplete={props.autoComplete ?? 'off'}
          onChange={(e) => props.onChange(e.target.value)}
        />
      )}
    </label>
  );
}

export function NumberField(props: { label: string; value: number | undefined; onChange: (v: number | undefined) => void; suffix?: string; step?: number }) {
  const [text, setText] = useState(props.value === undefined ? '' : String(props.value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(props.value === undefined ? '' : String(props.value));
  }, [props.value]);
  return (
    <label className="field">
      <span>
        {props.label}
        {props.suffix ? `, ${props.suffix}` : ''}
      </span>
      <input
        inputMode="decimal"
        value={text}
        onFocus={() => (focused.current = true)}
        onBlur={() => (focused.current = false)}
        onChange={(e) => {
          setText(e.target.value);
          const t = e.target.value.replace(/\s/g, '').replace(',', '.');
          if (t === '') props.onChange(undefined);
          else if (!Number.isNaN(Number(t))) props.onChange(Number(t));
        }}
      />
    </label>
  );
}

export function SelectField<T extends string>(props: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <select value={props.value} onChange={(e) => props.onChange(e.target.value as T)}>
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Seg<T extends string>(props: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="radiogroup">
      {props.options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === props.value} className={o.value === props.value ? 'on' : ''} onClick={() => props.onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function TopBar(props: { title: ReactNode; sub?: ReactNode; back?: string; right?: ReactNode }) {
  return (
    <header className="topbar">
      {props.back !== undefined && (
        <button className="icon-btn" aria-label="Назад" onClick={() => go(props.back!)}>
          ‹
        </button>
      )}
      <h1>
        {props.title}
        {props.sub && <span className="sub">{props.sub}</span>}
      </h1>
      {props.right}
    </header>
  );
}

// ---------- всплывающее сообщение ----------

let toastSetter: ((t: string | null) => void) | null = null;

export function toast(text: string) {
  toastSetter?.(text);
}

export function ToastHost() {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    toastSetter = setText;
    return () => {
      toastSetter = null;
    };
  }, []);
  useEffect(() => {
    if (!text) return;
    const t = window.setTimeout(() => setText(null), 2600);
    return () => window.clearTimeout(t);
  }, [text]);
  return text ? (
    <div className="toast" role="status">
      {text}
    </div>
  ) : null;
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
