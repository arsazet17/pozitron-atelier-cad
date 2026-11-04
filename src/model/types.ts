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

/** Точка на фото в долях ширины и высоты снимка (0…1) */
export interface Pt {
  x: number;
  y: number;
}

export type ProductType = 'classic' | 'tulle' | 'roman' | 'roller';

/** Технологические припуски, мм. Значения ателье по умолчанию — в настройках. */
export interface TechSettings {
  /** Припуск на обработку верха (под тесьму) */
  topAllowance: Mm;
  /** Подгиб низа (полный расход) */
  bottomHem: Mm;
  /** Боковой подгиб на одну сторону (полный расход) */
  sideHem: Mm;
  /** Припуск на шов стачивания полос, на одну сторону шва */
  seamAllowance: Mm;
  /** Шаг округления метража */
  roundStep: Mm;
  /** Запас, % */
  reservePercent: number;
  /** Римская штора: шаг между рейками */
  romanRodStep: Mm;
  /** Римская штора: припуск на одну кулису */
  romanPocket: Mm;
}

export interface Product {
  id: string;
  type: ProductType;
  name: string;
  /** Количество полотен */
  panels: number;
  /** Коэффициент сборки */
  fullness: number;
  /** Ширина готового изделия; пусто — из замеров */
  width?: Mm;
  /** Высота готового изделия; пусто — из замеров */
  height?: Mm;
  fabricId?: string;
  liningId?: string;
  tapeId?: string;
  sewingId?: string;
  /** Цвет для визуализации, если у ткани цвет не задан */
  color: string;
  /** Непрозрачность на визуализации, 0…1 */
  opacity: number;
  /** Отличия от припусков ателье для этого изделия */
  tech: Partial<TechSettings>;
  note: string;
}

export interface CorniceSpec {
  materialId?: string;
  installId?: string;
  /** Количество кронштейнов вручную; пусто — по длине */
  brackets?: number;
  rows: number;
}

export interface VisualSettings {
  /** 0 — шторы задёрнуты, 1 — полностью раздвинуты */
  open: number;
  showDims: boolean;
}

export interface WindowItem {
  id: string;
  name: string;
  measures: Measures;
  hasRadiator: boolean;
  corniceMount: CorniceMount;
  extras: ExtraDimension[];
  comment: string;
  /** Фото окна (хранится отдельно, в таблице photos) */
  photoId?: string;
  /** Углы проёма на фото: левый верхний, правый верхний, правый нижний, левый нижний */
  photoCorners?: Pt[];
  products: Product[];
  cornice: CorniceSpec;
  visual: VisualSettings;
  updatedAt: number;
}

export interface ManualLine {
  id: string;
  name: string;
  unit: string;
  qty: number;
  price: number;
}

export interface Photo {
  id: string;
  blob: Blob;
  width: number;
  height: number;
  createdAt: number;
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
  /** Позиции сметы, добавленные вручную (доставка, доп. работы) */
  extraLines: ManualLine[];
  /** Скидка (+) или наценка (−) на весь заказ, % */
  discountPercent: number;
  /** Цены, исправленные вручную в смете: ключ строки → цена */
  priceOverrides: Record<string, number>;
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
  /** Цвет ткани для визуализации */
  color?: string;
  note: string;
}

export const PRODUCT_TYPE_LABEL: Record<ProductType, string> = {
  classic: 'Портьеры (классические шторы)',
  tulle: 'Тюль',
  roman: 'Римская штора',
  roller: 'Рулонная штора',
};

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
