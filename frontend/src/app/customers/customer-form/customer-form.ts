import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { errorMessage } from '../../core/http/problem-detail';
import { AppHeader } from '../../shared/app-header';
import { applyServerErrors, focusFirstInvalid, showError } from '../../shared/forms/forms';
import { SubmitButton } from '../../shared/forms/submit-button';
import { Icon, IconName } from '../../shared/icon/icon';
import { PageHeader } from '../../shared/ui/page-header';
import { ToastService } from '../../shared/ui/toast.service';
import { Customer, CustomerPayload } from '../customer.models';
import { CustomerService } from '../customer.service';

type Field = keyof CustomerPayload;

interface FieldDefinition {
  name: Field;
  label: string;
  type?: 'email' | 'tel';
  autocomplete: string;
  inputmode?: 'numeric' | 'email' | 'tel';
  placeholder?: string;
  /** Takes the full width of the form. */
  wide?: boolean;
  hint: string;
}

/** Form layout, in display order. `autocomplete` lets browsers fill in an organization's details. */
export const SECTIONS: { title: string; icon: IconName; help: string; fields: FieldDefinition[] }[] = [
  {
    title: 'Contact',
    icon: 'users',
    help: 'Who you invoice, and where invoices are sent.',
    fields: [
      {
        name: 'name',
        label: 'Company or full name',
        autocomplete: 'organization',
        placeholder: 'e.g. ACME SAS',
        wide: true,
        hint: 'As it should appear on your invoices.',
      },
      {
        name: 'email',
        label: 'Billing email',
        type: 'email',
        autocomplete: 'email',
        inputmode: 'email',
        placeholder: 'e.g. accounting@acme.fr',
        hint: 'Invoices and payment reminders are sent to this address.',
      },
      {
        name: 'phone',
        label: 'Phone (optional)',
        type: 'tel',
        autocomplete: 'tel',
        inputmode: 'tel',
        placeholder: 'e.g. +33 1 23 45 67 89',
        hint: 'To reach your contact about a payment.',
      },
    ],
  },
  {
    title: 'Address',
    icon: 'map-pin',
    help: 'Printed on the invoice. Required by law for business customers.',
    fields: [
      {
        name: 'street',
        label: 'Street (optional)',
        autocomplete: 'street-address',
        placeholder: 'e.g. 1 rue de la Paix',
        wide: true,
        hint: 'Number, street, and building or floor if needed.',
      },
      { name: 'postalCode', label: 'Postal code (optional)', autocomplete: 'postal-code', hint: 'e.g. 75002' },
      { name: 'city', label: 'City (optional)', autocomplete: 'address-level2', hint: 'e.g. Paris' },
      { name: 'country', label: 'Country (optional)', autocomplete: 'country-name', hint: 'e.g. France' },
    ],
  },
  {
    title: 'Legal identifiers',
    icon: 'shield',
    help: 'Business customers only: leave empty for an individual.',
    fields: [
      {
        name: 'siret',
        label: 'SIRET (optional)',
        autocomplete: 'off',
        inputmode: 'numeric',
        placeholder: '14 digits',
        hint: 'On the customer’s invoices or Kbis, or at annuaire-entreprises.data.gouv.fr.',
      },
      {
        name: 'vatNumber',
        label: 'VAT number (optional)',
        autocomplete: 'off',
        placeholder: 'e.g. FR12345678901',
        hint: 'Intra-EU VAT number, required for business customers in the EU.',
      },
    ],
  },
];

const REQUIRED_MESSAGES: Partial<Record<Field, string>> = {
  name: 'Enter the customer name.',
  email: 'Enter the billing email.',
};

/** Creates a customer (`/customers/new`) or edits one (`/customers/:id/edit`). */
@Component({
  selector: 'app-customer-form',
  imports: [AppHeader, Icon, PageHeader, ReactiveFormsModule, RouterLink, SubmitButton],
  templateUrl: './customer-form.html',
  styleUrl: './customer-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerForm implements OnInit {
  private readonly customers = inject(CustomerService);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  private readonly destroyRef = inject(DestroyRef);

  /** From the `:id` route parameter (router input binding); absent when creating. */
  readonly id = input<string>();

  protected readonly sections = SECTIONS;
  protected readonly editing = computed(() => this.id() !== undefined);

  // Limits match the backend CustomerRequest
  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
    phone: ['', [Validators.maxLength(30)]],
    street: ['', [Validators.maxLength(255)]],
    postalCode: ['', [Validators.maxLength(10)]],
    city: ['', [Validators.maxLength(255)]],
    country: ['', [Validators.maxLength(255)]],
    siret: ['', [Validators.pattern(/^\d{14}$/)]],
    vatNumber: ['', [Validators.maxLength(20)]],
  });
  protected readonly loading = signal(false);
  /** The customer to edit could not be loaded: the form is not shown. */
  protected readonly loadError = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly showError = showError;

  ngOnInit(): void {
    const id = this.id();
    if (id !== undefined) {
      this.load(Number(id));
    }
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
    if (control.hasError('email')) {
      return 'Enter a valid email address.';
    }
    if (control.hasError('pattern')) {
      return 'A SIRET is made of exactly 14 digits.';
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

    const payload = toPayload(this.form.getRawValue());
    const id = this.id();
    this.submitting.set(true);
    this.error.set(null);
    (id === undefined ? this.customers.create(payload) : this.customers.update(Number(id), payload))
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (customer) => {
          this.toasts.success(
            id === undefined ? `${customer.name} was added to your customers.` : `${customer.name} was saved.`,
          );
          void this.router.navigateByUrl('/customers');
        },
        error: (error: unknown) => {
          this.error.set(errorMessage(error));
          applyServerErrors(this.form, error);
          focusFirstInvalid(this.form, this.host);
        },
      });
  }

  private load(id: number): void {
    this.loading.set(true);
    this.customers
      .get(id)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (customer) => this.form.setValue(toFormValue(customer)),
        error: (error: unknown) =>
          this.loadError.set(
            error instanceof HttpErrorResponse && error.status === 404
              ? 'This customer does not exist or has been deleted.'
              : errorMessage(error),
          ),
      });
  }
}

/** Trims every value; empty optional fields are sent as null (the backend validates "" as a value). */
function toPayload(value: Record<Field, string>): CustomerPayload {
  const entries = Object.entries(value).map(([key, text]) => [key, text.trim() || null]);
  return Object.fromEntries(entries) as CustomerPayload;
}

function toFormValue(customer: Customer): Record<Field, string> {
  return {
    name: customer.name,
    email: customer.email,
    phone: customer.phone ?? '',
    street: customer.street ?? '',
    postalCode: customer.postalCode ?? '',
    city: customer.city ?? '',
    country: customer.country ?? '',
    siret: customer.siret ?? '',
    vatNumber: customer.vatNumber ?? '',
  };
}
