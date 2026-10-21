// Test data shared by the specs. Obviously fake values only.
import { Page } from '../core/http/page';
import { Product } from './product.models';

export function testProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 1,
    type: 'SERVICE',
    name: 'Web development',
    description: 'Senior developer, day rate',
    unitPrice: 650,
    vatRate: 20,
    unit: 'DAY',
    createdAt: '2026-10-21T10:00:00Z',
    updatedAt: '2026-10-21T10:00:00Z',
    ...overrides,
  };
}

export function pageOf(content: Product[], page = 0, totalElements = content.length, size = 20): Page<Product> {
  return { content, page, size, totalElements, totalPages: Math.ceil(totalElements / size) };
}
