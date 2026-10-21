// Mirrors the backend DTOs of com.naji.backend.product.
import { IconName } from '../shared/icon/icon';

export type ProductType = 'GOODS' | 'SERVICE';
export type ProductUnit = 'UNIT' | 'HOUR' | 'DAY' | 'MONTH' | 'KILOGRAM' | 'METER';

export interface Product {
  id: number;
  type: ProductType;
  name: string;
  description: string | null;
  /** Euros, excluding VAT. */
  unitPrice: number;
  /** Percent, one of `VAT_RATES`. */
  vatRate: number;
  unit: ProductUnit;
  createdAt: string;
  updatedAt: string;
}

/** Body of create and update. */
export type ProductPayload = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>;

export interface ProductQuery {
  search?: string;
  /** Absent: every type. */
  type?: ProductType;
  /** Zero-based. */
  page?: number;
  size?: number;
}

export const PRODUCT_TYPES: Record<ProductType, { label: string; plural: string; icon: IconName; help: string }> = {
  SERVICE: {
    label: 'Service',
    plural: 'Services',
    icon: 'briefcase',
    help: 'Work you perform: consulting, development, training, maintenance…',
  },
  GOODS: {
    label: 'Goods',
    plural: 'Goods',
    icon: 'package',
    help: 'Physical items you sell and deliver: equipment, supplies, merchandise…',
  },
};

/** The French VAT rates accepted by the backend (`@FrenchVatRate`), most common first. */
export const VAT_RATES: { value: number; label: string; help: string }[] = [
  { value: 20, label: 'Standard rate', help: 'Applies to most goods and services.' },
  { value: 10, label: 'Intermediate rate', help: 'Restaurants, passenger transport, renovation work, hotels.' },
  { value: 5.5, label: 'Reduced rate', help: 'Food, books, energy, energy-saving renovation.' },
  { value: 2.1, label: 'Super-reduced rate', help: 'Reimbursed medicines, press publications.' },
  {
    value: 0,
    label: 'No VAT',
    help: 'Exempt operations, e.g. small businesses under the VAT franchise (franchise en base).',
  },
];

export const PRODUCT_UNITS: Record<ProductUnit, { label: string; per: string }> = {
  UNIT: { label: 'Unit', per: 'unit' },
  HOUR: { label: 'Hour', per: 'hour' },
  DAY: { label: 'Day', per: 'day' },
  MONTH: { label: 'Month', per: 'month' },
  KILOGRAM: { label: 'Kilogram', per: 'kg' },
  METER: { label: 'Meter', per: 'm' },
};
