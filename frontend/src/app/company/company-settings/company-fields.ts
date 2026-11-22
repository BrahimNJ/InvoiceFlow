import { IconName } from '../../shared/icon/icon';
import { CompanyPayload, LEGAL_FORMS, LegalForm, VAT_REGIMES, VatRegime } from '../company.models';

export type Field = keyof CompanyPayload;

export interface FieldDefinition {
  name: Field;
  label: string;
  /** A text input unless it is a list of choices. */
  options?: { value: string; label: string }[];
  type?: 'email' | 'tel';
  autocomplete?: string;
  inputmode?: 'numeric' | 'email' | 'tel' | 'decimal';
  placeholder?: string;
  /** Takes the full width of the form. */
  wide?: boolean;
  hint: string;
}

export interface Section {
  title: string;
  icon: IconName;
  help: string;
  fields: FieldDefinition[];
}

/** Form layout, in display order. */
export const SECTIONS: Section[] = [
  {
    title: 'Identity',
    icon: 'briefcase',
    help: 'Who issues the invoices, as registered.',
    fields: [
      {
        name: 'legalName',
        label: 'Legal name',
        autocomplete: 'organization',
        placeholder: 'e.g. Durand Conseil',
        wide: true,
        hint: 'The registered name of your company (or your own name for a sole proprietorship).',
      },
      {
        name: 'tradeName',
        label: 'Trade name (optional)',
        autocomplete: 'off',
        placeholder: 'e.g. Atelier Durand',
        wide: true,
        hint: 'Printed under the legal name when it differs.',
      },
      {
        name: 'legalForm',
        label: 'Legal form',
        options: (Object.keys(LEGAL_FORMS) as LegalForm[]).map((value) => ({ value, label: LEGAL_FORMS[value].label })),
        hint: 'Printed next to the name on the invoice.',
      },
      {
        name: 'shareCapital',
        label: 'Share capital (€)',
        inputmode: 'decimal',
        placeholder: 'e.g. 10 000',
        hint: 'Mandatory on the invoices of a company with a share capital.',
      },
    ],
  },
  {
    title: 'Address',
    icon: 'map-pin',
    help: 'The registered office printed on the invoice.',
    fields: [
      {
        name: 'street',
        label: 'Street',
        autocomplete: 'street-address',
        placeholder: 'e.g. 8 rue des Tilleuls',
        wide: true,
        hint: 'Number, street, and building or floor if needed.',
      },
      { name: 'postalCode', label: 'Postal code', autocomplete: 'postal-code', hint: 'e.g. 69003' },
      { name: 'city', label: 'City', autocomplete: 'address-level2', hint: 'e.g. Lyon' },
      { name: 'country', label: 'Country', autocomplete: 'country-name', hint: 'e.g. France' },
    ],
  },
  {
    title: 'Tax & registration',
    icon: 'shield',
    help: 'Legal identifiers and VAT status. They are checked as you type.',
    fields: [
      {
        name: 'siret',
        label: 'SIRET',
        autocomplete: 'off',
        inputmode: 'numeric',
        placeholder: '14 digits',
        hint: 'The first 9 digits are your SIREN. Found on your Kbis or at annuaire-entreprises.data.gouv.fr.',
      },
      {
        name: 'vatRegime',
        label: 'VAT regime',
        options: (Object.keys(VAT_REGIMES) as VatRegime[]).map((value) => ({ value, label: VAT_REGIMES[value].label })),
        hint: 'Under the franchise, invoices carry no VAT and say why.',
      },
      {
        name: 'vatNumber',
        label: 'VAT number',
        autocomplete: 'off',
        placeholder: 'e.g. FR44732829320',
        hint: 'Required when subject to VAT. A French number ends with your SIREN.',
      },
      {
        name: 'registration',
        label: 'Registration (optional)',
        autocomplete: 'off',
        placeholder: 'e.g. RCS Lyon 732 829 320',
        hint: 'RCS for a company, RM for a craftsman, as printed on your Kbis.',
      },
    ],
  },
  {
    title: 'Contact',
    icon: 'send',
    help: 'Printed on the invoice so that customers can reach you.',
    fields: [
      {
        name: 'email',
        label: 'Email (optional)',
        type: 'email',
        autocomplete: 'email',
        inputmode: 'email',
        placeholder: 'e.g. contact@durand.fr',
        hint: 'Where customers write about an invoice.',
      },
      {
        name: 'phone',
        label: 'Phone (optional)',
        type: 'tel',
        autocomplete: 'tel',
        inputmode: 'tel',
        placeholder: 'e.g. +33 4 12 34 56 78',
        hint: 'To reach you about a payment.',
      },
    ],
  },
  {
    title: 'Bank details',
    icon: 'euro',
    help: 'Optional: printed so that customers know where to send the transfer.',
    fields: [
      {
        name: 'iban',
        label: 'IBAN (optional)',
        autocomplete: 'off',
        placeholder: 'e.g. FR76 3000 6000 0112 3456 7890 189',
        wide: true,
        hint: 'Spaces are fine.',
      },
      {
        name: 'bic',
        label: 'BIC (optional)',
        autocomplete: 'off',
        placeholder: '8 or 11 characters',
        hint: 'e.g. AGRIFRPP',
      },
    ],
  },
];

export const REQUIRED_MESSAGES: Partial<Record<Field, string>> = {
  legalName: 'Enter the legal name of your company.',
  legalForm: 'Choose the legal form.',
  shareCapital: 'Enter the share capital: mandatory for this legal form.',
  street: 'Enter the street.',
  postalCode: 'Enter the postal code.',
  city: 'Enter the city.',
  country: 'Enter the country.',
  siret: 'Enter your SIRET.',
  vatRegime: 'Choose the VAT regime.',
  vatNumber: 'Enter your VAT number, required when subject to VAT.',
};
