// Mirrors the backend DTOs of com.naji.backend.customer.

export interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  siret: string | null;
  vatNumber: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Body of create and update. Optional fields are sent as `null` when empty (the backend validates `""`). */
export type CustomerPayload = Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>;

export interface CustomerQuery {
  search?: string;
  /** Zero-based. */
  page?: number;
  size?: number;
}
