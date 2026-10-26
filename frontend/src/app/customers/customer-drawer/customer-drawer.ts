import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

import { errorMessage } from '../../core/http/problem-detail';
import { applyServerErrors, focusFirstInvalid, showError } from '../../shared/forms/forms';
import { SubmitButton } from '../../shared/forms/submit-button';
import { Icon } from '../../shared/icon/icon';
import { Customer, CustomerPayload } from '../customer.models';
import { CustomerService } from '../customer.service';

type Field = 'name' | 'email' | 'street' | 'postalCode' | 'city' | 'siret';

const MESSAGES: Record<string, string> = {
  required: 'Required.',
  email: 'Enter an email like billing@company.fr.',
  pattern: 'A SIRET is made of exactly 14 digits.',
};

/**
 * Creates a customer from a side drawer, without leaving the current screen (e.g. the invoice being written).
 * Only what an invoice needs; the full form stays on the customers page. Escape or the backdrop closes it.
 */
@Component({
  selector: 'app-customer-drawer',
  imports: [Icon, ReactiveFormsModule, SubmitButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(keydown.escape)': 'closed.emit()' },
  template: `
    <div class="backdrop" (click)="closed.emit()"></div>
    <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <header>
        <h2 id="drawer-title">New customer</h2>
        <button class="icon-btn" type="button" aria-label="Close" (click)="closed.emit()"><app-icon name="x" [size]="18" /></button>
      </header>
      <p class="intro">The details printed on the invoice. You can complete the rest later on the customers page.</p>
      <form class="form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        @if (error(); as message) {
          <div class="alert" role="alert"><app-icon name="alert" [size]="18" /><span>{{ message }}</span></div>
        }
        @for (field of fields; track field.name) {
          <div class="field">
            <label [for]="'drawer-' + field.name">{{ field.label }}</label>
            <input
              class="input"
              [id]="'drawer-' + field.name"
              [formControlName]="field.name"
              [type]="field.type ?? 'text'"
              [attr.autocomplete]="field.autocomplete ?? 'off'"
              [attr.inputmode]="field.name === 'siret' ? 'numeric' : null"
              [attr.aria-invalid]="showError(form.controls[field.name])"
              [attr.aria-describedby]="message(field.name) ? 'drawer-' + field.name + '-error' : null"
            />
            @if (message(field.name); as text) {
              <span class="field-error" [id]="'drawer-' + field.name + '-error'">{{ text }}</span>
            }
          </div>
        }
        <app-submit-button label="Add customer" busyLabel="Adding…" [busy]="saving()" />
      </form>
    </aside>
  `,
  styles: `
    .backdrop { position: fixed; inset: 0; z-index: 90; background: var(--overlay); animation: fade-in .2s ease both; }
    .drawer { position: fixed; z-index: 91; top: 0; right: 0; bottom: 0; width: min(440px, 100%); overflow-y: auto;
              padding: 1.5rem; background: var(--surface); box-shadow: var(--shadow-lg); animation: slide .3s var(--ease-out) both; }
    @keyframes slide { from { transform: translateX(40px); opacity: 0; } }
    header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
    h2 { font-size: 1.25rem; font-weight: 750; }
    .intro { margin: .4rem 0 1.25rem; color: var(--ink-500); font-size: .9rem; }
  `,
})
export class CustomerDrawer implements OnInit {
  private readonly customers = inject(CustomerService);
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  private readonly destroyRef = inject(DestroyRef);

  /** Prefills the name, e.g. with what the user typed in a search. */
  readonly name = input('');

  readonly created = output<Customer>();
  readonly closed = output<void>();

  protected readonly fields: { name: Field; label: string; type?: string; autocomplete?: string }[] = [
    { name: 'name', label: 'Name', autocomplete: 'organization' },
    { name: 'email', label: 'Billing email', type: 'email', autocomplete: 'email' },
    { name: 'street', label: 'Street', autocomplete: 'street-address' },
    { name: 'postalCode', label: 'Postal code', autocomplete: 'postal-code' },
    { name: 'city', label: 'City', autocomplete: 'address-level2' },
    { name: 'siret', label: 'SIRET (business customers)' },
  ];

  // Same rules as the customers form (backend CustomerRequest)
  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
    street: ['', [Validators.maxLength(255)]],
    postalCode: ['', [Validators.maxLength(10)]],
    city: ['', [Validators.maxLength(255)]],
    siret: ['', [Validators.pattern(/^\d{14}$/)]],
  });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly showError = showError;

  ngOnInit(): void {
    this.form.controls.name.setValue(this.name());
    setTimeout(() => this.host.querySelector<HTMLInputElement>(this.name() ? '#drawer-email' : '#drawer-name')?.focus());
  }

  protected message(field: Field): string | null {
    const control = this.form.controls[field];
    if (!showError(control)) {
      return null;
    }
    if (control.hasError('server')) {
      return control.getError('server') as string;
    }
    const key = Object.keys(control.errors ?? {}).find((error) => error in MESSAGES);
    return key ? MESSAGES[key] : 'Too long.';
  }

  protected submit(): void {
    if (this.saving()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      focusFirstInvalid(this.form, this.host);
      return;
    }
    const value = this.form.getRawValue();
    const blank = (text: string) => text.trim() || null;
    const payload: CustomerPayload = {
      name: value.name.trim(),
      email: value.email.trim(),
      phone: null,
      street: blank(value.street),
      postalCode: blank(value.postalCode),
      city: blank(value.city),
      country: 'France',
      siret: blank(value.siret),
      vatNumber: null,
    };
    this.saving.set(true);
    this.error.set(null);
    this.customers
      .create(payload)
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (customer) => this.created.emit(customer),
        error: (error: unknown) => {
          this.error.set(errorMessage(error));
          applyServerErrors(this.form, error);
        },
      });
  }
}
