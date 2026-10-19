// Test data shared by the specs. Obviously fake values only.
import { Page } from '../core/http/page';
import { Customer } from './customer.models';

export function testCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 1,
    name: 'ACME',
    email: 'contact@acme.fr',
    phone: '+33 1 23 45 67 89',
    street: '1 rue de la Paix',
    postalCode: '75002',
    city: 'Paris',
    country: 'France',
    siret: '12345678901234',
    vatNumber: 'FR12345678901',
    createdAt: '2026-10-19T10:00:00Z',
    updatedAt: '2026-10-19T10:00:00Z',
    ...overrides,
  };
}

export function pageOf(content: Customer[], page = 0, totalElements = content.length, size = 20): Page<Customer> {
  return { content, page, size, totalElements, totalPages: Math.ceil(totalElements / size) };
}
