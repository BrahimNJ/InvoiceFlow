// Test data shared by the specs. Obviously fake values only.
import { Company, InvoiceSeller } from './company.models';

export function testCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: 1,
    legalName: 'Durand Conseil',
    tradeName: 'Atelier Durand',
    legalForm: 'SAS',
    shareCapital: 10000,
    street: '8 rue des Tilleuls',
    postalCode: '69003',
    city: 'Lyon',
    country: 'France',
    siret: '73282932000074',
    siren: '732829320',
    vatNumber: 'FR44732829320',
    vatRegime: 'STANDARD',
    registration: 'RCS Lyon 732 829 320',
    email: 'contact@durand.test',
    phone: '+33 4 12 34 56 78',
    iban: 'FR7630006000011234567890189',
    bic: 'AGRIFRPP',
    createdAt: '2026-10-19T10:00:00Z',
    updatedAt: '2026-10-19T10:00:00Z',
    ...overrides,
  };
}

export function testSeller(overrides: Partial<InvoiceSeller> = {}): InvoiceSeller {
  const { id: _id, createdAt: _created, updatedAt: _updated, ...seller } = testCompany();
  return { ...seller, ...overrides };
}
