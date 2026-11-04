import type { AtelierProfile, Customer, Material, NumberingSettings, Order, Product, ProductType, Room, TechSettings, WindowItem } from './types';
import { PRODUCT_TYPE_LABEL } from './types';

/** Припуски по умолчанию. Ателье меняет их в настройках под свою технологию. */
export const DEFAULT_TECH: TechSettings = {
  topAllowance: 50,
  bottomHem: 100,
  sideHem: 50,
  seamAllowance: 15,
  roundStep: 100,
  reservePercent: 0,
  romanRodStep: 300,
  romanPocket: 40,
};

const PRODUCT_DEFAULTS: Record<ProductType, Pick<Product, 'panels' | 'fullness' | 'color' | 'opacity'>> = {
  classic: { panels: 2, fullness: 2, color: '#7d5f45', opacity: 1 },
  tulle: { panels: 1, fullness: 2.5, color: '#f3f0e8', opacity: 0.55 },
  roman: { panels: 1, fullness: 1, color: '#c8b69a', opacity: 1 },
  roller: { panels: 1, fullness: 1, color: '#d9d3c5', opacity: 0.95 },
};

export function newProduct(type: ProductType): Product {
  return {
    id: uid(),
    type,
    name: PRODUCT_TYPE_LABEL[type].replace(/ \(.*\)/, ''),
    ...PRODUCT_DEFAULTS[type],
    tech: {},
    note: '',
  };
}

/** Дополняет окна, сохранённые старыми версиями, новыми полями */
export function normalizeWindow(w: WindowItem): WindowItem {
  return {
    ...w,
    extras: w.extras ?? [],
    products: w.products ?? [],
    cornice: w.cornice ?? { rows: 1 },
    visual: w.visual ?? { open: 0.35, showDims: true },
  };
}

export function normalizeOrder(o: Order): Order {
  return {
    ...o,
    extraLines: o.extraLines ?? [],
    discountPercent: o.discountPercent ?? 0,
    priceOverrides: o.priceOverrides ?? {},
    rooms: o.rooms.map((r) => ({ ...r, windows: r.windows.map(normalizeWindow) })),
  };
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

export function emptyCustomer(): Customer {
  return {
    kind: 'person',
    name: '',
    phone: '',
    email: '',
    objectAddress: '',
    inn: '',
    kpp: '',
    legalAddress: '',
    representative: '',
    note: '',
  };
}

export function newWindow(index: number): WindowItem {
  return {
    id: uid(),
    name: `Окно ${index}`,
    measures: {},
    hasRadiator: false,
    corniceMount: 'wall',
    extras: [],
    comment: '',
    products: [],
    cornice: { rows: 1 },
    visual: { open: 0.35, showDims: true },
    updatedAt: Date.now(),
  };
}

export function newRoom(name: string): Room {
  return { id: uid(), name, windows: [newWindow(1)] };
}

export function newOrder(number: string): Order {
  const now = Date.now();
  return {
    id: uid(),
    number,
    title: '',
    status: 'draft',
    customer: emptyCustomer(),
    rooms: [newRoom('Гостиная')],
    extraLines: [],
    discountPercent: 0,
    priceOverrides: {},
    createdAt: now,
    updatedAt: now,
  };
}

/** Исполнитель по умолчанию — пока реквизиты не введены в настройках */
export const DEFAULT_EXECUTOR = 'ИП Пашкова Наталья Евгеньевна';
export const DEFAULT_SIGNER = 'Пашкова Н. Е.';

export function executorName(p: Pick<AtelierProfile, 'name'>): string {
  return p.name.trim() || DEFAULT_EXECUTOR;
}

/** «Пашкова Наталья Евгеньевна» → «Пашкова Н. Е.» для подписи */
export function signerShort(p: Pick<AtelierProfile, 'director'>): string {
  const parts = p.director.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return DEFAULT_SIGNER;
  return [parts[0], ...parts.slice(1, 3).map((x) => x[0].toUpperCase() + '.')].join(' ');
}

export function emptyProfile(): AtelierProfile {
  return {
    name: DEFAULT_EXECUTOR,
    legalForm: 'ИП',
    inn: '',
    kpp: '',
    ogrn: '',
    legalAddress: '',
    bankName: '',
    bik: '',
    account: '',
    corrAccount: '',
    director: 'Пашкова Наталья Евгеньевна',
    authority: '',
    phone: '',
    email: '',
    site: '',
  };
}

export const DEFAULT_NUMBERING: NumberingSettings = { nextNumber: 1, digits: 6 };

export function formatOrderNumber(n: number, digits: number): string {
  return String(n).padStart(digits, '0');
}

export function newMaterial(): Material {
  return { id: uid(), kind: 'fabric', name: '', article: '', unit: 'м', price: 0, rollWidth: undefined, rapport: 0, railroaded: false, note: '' };
}
