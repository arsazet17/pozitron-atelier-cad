/**
 * Модель данных ПОЗИТРОН АТЕЛЬЕ CAD.
 * Все линейные размеры — целые миллиметры. Система координат стены:
 * X — вправо от левого угла стены, Y — вверх от уровня чистового пола.
 */

export type Mm = number;

export type CustomerKind = 'person' | 'company';

export interface Customer {
  kind: CustomerKind;
  /** ФИО (физлицо) или наименование организации */
  name: string;
  phone: string;
  email: string;
  /** Адрес объекта, где выполняются замеры и монтаж */
  objectAddress: string;
  // Реквизиты юрлица / ИП (нужны для договора, этап 2)
  inn: string;
  kpp: string;
  legalAddress: string;
  representative: string;
  note: string;
}

/** Ключи всех измеряемых размеров окна (см. measurements.ts) */
export type MeasureKey =
  | 'wallWidth'
  | 'leftPier'
  | 'openingWidth'
  | 'rightPier'
  | 'ceilingHeight'
  | 'sillHeight'
  | 'openingHeight'
  | 'topToCeiling'
  | 'sillDepth'
  | 'sillLength'
  | 'radiatorWidth'
  | 'radiatorHeight'
  | 'radiatorFromFloor'
  | 'radiatorOffset'
  | 'radiatorDepth'
  | 'corniceOverhangLeft'
  | 'corniceOverhangRight'
  | 'corniceLength'
  | 'corniceHeight'
  | 'corniceToCeiling'
  | 'corniceProjection'
  | 'floorClearance'
  | 'productWidth'
  | 'productHeight';

/** Значения, введённые замерщиком. Пустое поле — undefined. */
export type Measures = Partial<Record<MeasureKey, Mm>>;

export type CorniceMount = 'wall' | 'ceiling';

export interface ExtraDimension {
  id: string;
  label: string;
  value?: Mm;
}

export interface WindowItem {
  id: string;
  name: string;
  measures: Measures;
  hasRadiator: boolean;
  corniceMount: CorniceMount;
  extras: ExtraDimension[];
  comment: string;
  updatedAt: number;
}

export interface Room {
  id: string;
  name: string;
  windows: WindowItem[];
}

export type OrderStatus = 'draft' | 'sent' | 'approved' | 'production' | 'done';

export interface Order {
  id: string;
  /** Номер заказа, например «000125» */
  number: string;
  title: string;
  status: OrderStatus;
  customer: Customer;
  rooms: Room[];
  createdAt: number;
  updatedAt: number;
}

export type LegalForm = 'ООО' | 'ИП' | 'Самозанятый' | 'Другое';

export interface AtelierProfile {
  name: string;
  legalForm: LegalForm;
  inn: string;
  kpp: string;
  ogrn: string;
  legalAddress: string;
  bankName: string;
  bik: string;
  account: string;
  corrAccount: string;
  director: string;
  authority: string;
  phone: string;
  email: string;
  site: string;
}

export interface NumberingSettings {
  nextNumber: number;
  digits: number;
}

export type MaterialKind = 'fabric' | 'lining' | 'tape' | 'cornice' | 'fitting' | 'work';

export type Unit = 'м' | 'шт' | 'компл' | 'м²' | 'усл';

export interface Material {
  id: string;
  kind: MaterialKind;
  name: string;
  article: string;
  unit: Unit;
  price: number;
  /** Ширина рулона, мм — только для тканей */
  rollWidth?: Mm;
  /** Раппорт по вертикали, мм (0 — без раппорта) */
  rapport?: Mm;
  /** Ткань «в высоту»: высота изделия берётся по ширине рулона */
  railroaded?: boolean;
  note: string;
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  draft: 'Черновик',
  sent: 'Отправлен клиенту',
  approved: 'Согласован',
  production: 'В производстве',
  done: 'Выполнен',
};

export const MATERIAL_KIND_LABEL: Record<MaterialKind, string> = {
  fabric: 'Ткань',
  lining: 'Подкладка',
  tape: 'Тесьма',
  cornice: 'Карниз',
  fitting: 'Фурнитура',
  work: 'Работа',
};
