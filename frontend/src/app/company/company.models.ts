// Mirrors the backend DTOs of com.naji.backend.company.

export type LegalForm = 'EI' | 'EI_MICRO' | 'EURL' | 'SARL' | 'SASU' | 'SAS' | 'SA' | 'SNC' | 'OTHER';
export type VatRegime = 'STANDARD' | 'FRANCHISE';

export interface Company {
  id: number;
  legalName: string;
  tradeName: string | null;
  legalForm: LegalForm;
  /** Euros; only for the forms that have a share capital. */
  shareCapital: number | null;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  /** 14 digits. */
  siret: string;
  /** The first 9 digits of the SIRET. */
  siren: string;
  vatNumber: string | null;
  vatRegime: VatRegime;
  /** RCS or RM registration, as printed on the invoice (e.g. "RCS Paris 732 829 320"). */
  registration: string | null;
  email: string | null;
  phone: string | null;
  iban: string | null;
  bic: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Body of the save: no id, no SIREN (derived from the SIRET), no timestamps. */
export type CompanyPayload = Omit<Company, 'id' | 'siren' | 'createdAt' | 'updatedAt'>;

/** The seller block of an invoice: the company as it was when the invoice was issued. */
export type InvoiceSeller = Omit<Company, 'id' | 'createdAt' | 'updatedAt'>;

export const LEGAL_FORMS: Record<LegalForm, { label: string; short: string | null; hasCapital: boolean }> = {
  EI: { label: 'EI, sole proprietorship', short: 'EI', hasCapital: false },
  EI_MICRO: { label: 'Micro-entrepreneur (EI)', short: 'EI', hasCapital: false },
  EURL: { label: 'EURL', short: 'EURL', hasCapital: true },
  SARL: { label: 'SARL', short: 'SARL', hasCapital: true },
  SASU: { label: 'SASU', short: 'SASU', hasCapital: true },
  SAS: { label: 'SAS', short: 'SAS', hasCapital: true },
  SA: { label: 'SA', short: 'SA', hasCapital: true },
  SNC: { label: 'SNC', short: 'SNC', hasCapital: true },
  OTHER: { label: 'Other', short: null, hasCapital: false },
};

export const VAT_REGIMES: Record<VatRegime, { label: string; help: string }> = {
  STANDARD: { label: 'Subject to VAT', help: 'You charge VAT on your invoices and have a VAT number.' },
  FRANCHISE: {
    label: 'VAT exemption (franchise en base, art. 293 B)',
    help: 'You charge no VAT: every line is at 0 % and the invoice says so.',
  },
};

export const FRANCHISE_MENTION = 'TVA non applicable, art. 293 B du CGI';

export const hasShareCapital = (form: LegalForm | ''): boolean => form !== '' && LEGAL_FORMS[form].hasCapital;

/** A share capital can be recorded: required forms, and Other (SELARL, SCOP, SCI...), where it is optional. */
export const allowsShareCapital = (form: LegalForm | ''): boolean => hasShareCapital(form) || form === 'OTHER';
