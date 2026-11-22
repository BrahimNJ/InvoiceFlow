import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { finalize, map, startWith } from 'rxjs';

import { errorMessage } from '../../core/http/problem-detail';
import { AppHeader } from '../../shared/app-header';
import { amountInputValue, parseAmount } from '../../shared/format/money';
import { applyServerErrors, focusFirstInvalid, showError } from '../../shared/forms/forms';
import { SubmitButton } from '../../shared/forms/submit-button';
import { Icon } from '../../shared/icon/icon';
import { HelpTip } from '../../shared/ui/help-tip';
import { PageHeader } from '../../shared/ui/page-header';
import { ToastService } from '../../shared/ui/toast.service';
import {
  bicValidator,
  emailValidator,
  ibanValidator,
  siretValidator,
  vatNumberValidator,
} from '../company-validation';
import {
  Company,
  CompanyPayload,
  LegalForm,
  VatRegime,
  allowsShareCapital,
  hasShareCapital,
} from '../company.models';
import { CompanyService } from '../company.service';
import { Field, REQUIRED_MESSAGES, SECTIONS } from './company-fields';

const FIELD_ERRORS: Record<string, string> = {
  siret: 'A SIRET is 14 digits with a valid checksum: check it against your Kbis.',
  vat: 'Not a valid VAT number. A French one looks like FR44732829320 and ends with your SIREN.',
  iban: 'Not a valid IBAN: check the digits.',
  bic: 'A BIC is 8 or 11 characters.',
  email: 'Enter a valid email address.',
  amount: 'An amount like 10000 or 1 500,50.',
  positive: 'The share capital of a company is at least 1 €.',
};

const TIPS = [
  'SIRET: 14 digits that identify your establishment. The first 9 are your SIREN, which identifies your company and is printed on the invoice.',
  'VAT number: starts with FR for a French company and ends with your SIREN. Leave it empty only if you are under the VAT franchise.',
  'RCS or RM: the register of your company (trade and companies, or trades), printed on your Kbis or INPI extract.',
  'Franchise en base (art. 293 B du CGI): you charge no VAT. Your invoices then state “TVA non applicable, art. 293 B du CGI” and every line must be at 0 %.',
  'These details are copied onto an invoice when you issue it. Changing them later never alters an issued invoice.',
];

/** Required when the legal form has a share capital; ignored (and hidden) otherwise. */
const capitalValidator: ValidatorFn = (control: AbstractControl) => {
  const form = control.parent?.get('legalForm')?.value as LegalForm | '' | undefined;
  if (!allowsShareCapital(form ?? '')) {
    return null;
  }
  const required = hasShareCapital(form ?? '');
  const text = (control.value as string).trim();
  if (text === '') {
    return required ? { required: true } : null;
  }
  const amount = parseAmount(text);
  if (amount === null || amount < 0) {
    return { amount: true };
  }
  return required && amount === 0 ? { positive: true } : null;
};

/** Required when subject to VAT. */
const vatRequiredValidator: ValidatorFn = (control: AbstractControl) =>
  control.parent?.get('vatRegime')?.value === 'STANDARD' && (control.value as string).trim() === ''
    ? { required: true }
    : null;

/** The company of the user (`/company`): the seller block printed on every invoice. */
@Component({
  selector: 'app-company-settings',
  imports: [AppHeader, HelpTip, Icon, PageHeader, ReactiveFormsModule, SubmitButton],
  templateUrl: './company-settings.html',
  styleUrl: './company-settings.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompanySettings implements OnInit {
  private readonly companies = inject(CompanyService);
  private readonly toasts = inject(ToastService);
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  private readonly destroyRef = inject(DestroyRef);

  protected readonly sections = SECTIONS;
  protected readonly tips = TIPS;

  // Limits match the backend CompanyRequest
  protected readonly form = inject(NonNullableFormBuilder).group({
    legalName: ['', [Validators.required, Validators.maxLength(255)]],
    tradeName: ['', [Validators.maxLength(255)]],
    legalForm: ['' as LegalForm | '', [Validators.required]],
    shareCapital: ['', [capitalValidator]],
    street: ['', [Validators.required, Validators.maxLength(255)]],
    postalCode: ['', [Validators.required, Validators.maxLength(10)]],
    city: ['', [Validators.required, Validators.maxLength(255)]],
    country: ['France', [Validators.required, Validators.maxLength(255)]],
    siret: ['', [Validators.required, siretValidator]],
    vatRegime: ['' as VatRegime | '', [Validators.required]],
    vatNumber: ['', [vatRequiredValidator, vatNumberValidator, Validators.maxLength(30)]],
    registration: ['', [Validators.maxLength(120)]],
    email: ['', [emailValidator, Validators.maxLength(255)]],
    phone: ['', [Validators.maxLength(30)]],
    iban: ['', [ibanValidator, Validators.maxLength(42)]],
    bic: ['', [bicValidator, Validators.maxLength(11)]],
  });
  private readonly value = toSignal(this.form.valueChanges.pipe(startWith(null), map(() => this.form.getRawValue())), {
    requireSync: true,
  });

  protected readonly capitalVisible = computed(() => allowsShareCapital(this.value().legalForm));
  protected readonly franchise = computed(() => this.value().vatRegime === 'FRANCHISE');

  /** The saved company; `null` until the first save. */
  protected readonly company = signal<Company | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly showError = showError;

  constructor() {
    const { controls } = this.form;
    // Rules that depend on another field are checked again when that field changes
    controls.legalForm.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => controls.shareCapital.updateValueAndValidity({ emitEvent: false }));
    controls.vatRegime.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => controls.vatNumber.updateValueAndValidity({ emitEvent: false }));
    controls.siret.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => controls.vatNumber.updateValueAndValidity({ emitEvent: false }));
  }

  ngOnInit(): void {
    this.companies
      .get()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (company) => {
          this.company.set(company);
          if (company) {
            this.form.setValue(toFormValue(company));
          }
        },
        error: (error: unknown) => this.loadError.set(errorMessage(error)),
      });
  }

  protected visible(field: Field): boolean {
    return field !== 'shareCapital' || this.capitalVisible();
  }

  /** The message to show under a field, or null. */
  protected message(field: Field): string | null {
    const control = this.form.controls[field];
    if (!showError(control)) {
      return null;
    }
    if (control.hasError('server')) {
      return control.getError('server') as string;
    }
    if (control.hasError('required')) {
      return REQUIRED_MESSAGES[field] ?? 'This field is required.';
    }
    const code = Object.keys(FIELD_ERRORS).find((key) => control.hasError(key));
    if (code) {
      return FIELD_ERRORS[code];
    }
    if (control.hasError('maxlength')) {
      return `Use at most ${control.getError('maxlength').requiredLength} characters.`;
    }
    return null;
  }

  protected submit(): void {
    if (this.submitting()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      focusFirstInvalid(this.form, this.host);
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    this.companies
      .save(toPayload(this.form.getRawValue()))
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (company) => {
          this.company.set(company);
          this.form.setValue(toFormValue(company));
          this.form.markAsPristine();
          this.toasts.success('Company details saved.');
        },
        error: (error: unknown) => {
          this.error.set(errorMessage(error));
          applyServerErrors(this.form, error);
          focusFirstInvalid(this.form, this.host);
        },
      });
  }
}

interface FormValue {
  legalName: string;
  tradeName: string;
  legalForm: LegalForm | '';
  shareCapital: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  siret: string;
  vatRegime: VatRegime | '';
  vatNumber: string;
  registration: string;
  email: string;
  phone: string;
  iban: string;
  bic: string;
}

/** Trims every value; empty optional fields are sent as null; no share capital unless the form has one. */
export function toPayload(value: FormValue): CompanyPayload {
  const optional = (input: string) => input.trim() || null;
  return {
    legalName: value.legalName.trim(),
    tradeName: optional(value.tradeName),
    legalForm: value.legalForm as LegalForm,
    shareCapital: allowsShareCapital(value.legalForm) ? parseAmount(value.shareCapital) : null,
    street: value.street.trim(),
    postalCode: value.postalCode.trim(),
    city: value.city.trim(),
    country: value.country.trim(),
    siret: value.siret.replace(/\s/g, ''),
    vatNumber: optional(value.vatNumber),
    vatRegime: value.vatRegime as VatRegime,
    registration: optional(value.registration),
    email: optional(value.email),
    phone: optional(value.phone),
    iban: optional(value.iban),
    bic: optional(value.bic),
  };
}

export function toFormValue(company: Company): FormValue {
  return {
    legalName: company.legalName,
    tradeName: company.tradeName ?? '',
    legalForm: company.legalForm,
    shareCapital: company.shareCapital === null ? '' : amountInputValue(company.shareCapital),
    street: company.street,
    postalCode: company.postalCode,
    city: company.city,
    country: company.country,
    siret: company.siret,
    vatRegime: company.vatRegime,
    vatNumber: company.vatNumber ?? '',
    registration: company.registration ?? '',
    email: company.email ?? '',
    phone: company.phone ?? '',
    iban: company.iban ?? '',
    bic: company.bic ?? '',
  };
}
