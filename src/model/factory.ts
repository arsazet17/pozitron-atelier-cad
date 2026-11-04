import type { AtelierProfile, Customer, Material, NumberingSettings, Order, Room, WindowItem } from './types';

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
    createdAt: now,
    updatedAt: now,
  };
}

export function emptyProfile(): AtelierProfile {
  return {
    name: '',
    legalForm: 'ИП',
    inn: '',
    kpp: '',
    ogrn: '',
    legalAddress: '',
    bankName: '',
    bik: '',
    account: '',
    corrAccount: '',
    director: '',
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
