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
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { finalize } from 'rxjs';

import { errorMessage } from '../../core/http/problem-detail';
import { formatDate, todayIso } from '../../invoices/invoice-calc';
import { amountInputValue, formatEuros, parseAmount } from '../../shared/format/money';
import { applyServerErrors, focusFirstInvalid, showError } from '../../shared/forms/forms';
import { SubmitButton } from '../../shared/forms/submit-button';
import { Icon } from '../../shared/icon/icon';
import { PAYMENT_METHODS, Payment, PaymentMethod } from '../payment.models';
import { PaymentService } from '../payment.service';

type Field = 'amount' | 'date' | 'method' | 'reference';

export const REFERENCE_MAX_LENGTH = 100;

/**
 * Records a payment on an issued invoice. The amount starts at the balance due, the most common case, and the date
 * at today. The same rules as the backend are checked first (at most the balance, between the issue date and today),
 * so the 422 answers only show up in a race with another tab.
 */
@Component({
  selector: 'app-payment-form',
  imports: [Icon, ReactiveFormsModule, SubmitButton],
  templateUrl: './payment-form.html',
  styleUrl: './payment-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentForm implements OnInit {
  private readonly payments = inject(PaymentService);
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  private readonly destroyRef = inject(DestroyRef);

  readonly invoiceId = input.required<number>();
  /** What the customer still owes: the largest payment allowed, and the amount proposed. */
  readonly balance = input.required<number>();
  /** ISO date: no payment before it. */
  readonly issueDate = input.required<string>();

  readonly recorded = output<Payment>();
  readonly cancelled = output<void>();

  protected readonly today = todayIso();
  protected readonly referenceMax = REFERENCE_MAX_LENGTH;
  protected readonly methods = (Object.keys(PAYMENT_METHODS) as PaymentMethod[]).map((method) => ({
    method,
    label: PAYMENT_METHODS[method],
  }));
  protected readonly formatEuros = formatEuros;
  protected readonly showError = showError;

  protected readonly form = inject(NonNullableFormBuilder).group({
    amount: ['', Validators.required],
    date: [this.today, Validators.required],
    method: ['BANK_TRANSFER' as PaymentMethod, Validators.required],
    reference: ['', Validators.maxLength(REFERENCE_MAX_LENGTH)],
  });

  protected readonly saving = signal(false);
  /** A refusal of the API that is not about one field (409, 422). */
  protected readonly error = signal<string | null>(null);

  /** The rules that read the inputs are added once the inputs are set. */
  ngOnInit(): void {
    const { amount, date } = this.form.controls;
    amount.addValidators((control: AbstractControl<string>) => this.checkAmount(control));
    date.addValidators((control: AbstractControl<string>) => this.checkDate(control));
    amount.setValue(amountInputValue(this.balance()));
    date.updateValueAndValidity();
  }

  /** The message to show under a field, or null. */
  protected message(field: Field): string | null {
    const control = this.form.controls[field];
    if (!showError(control)) {
      return null;
    }
    if (control.hasError('required')) {
      return field === 'amount' ? 'Enter the amount received.' : 'Enter the day the money was received.';
    }
    if (control.hasError('amount')) {
      return 'Enter an amount like 650 or 49,90 (at most 2 decimals).';
    }
    if (control.hasError('zero')) {
      return 'A payment must be more than 0 €.';
    }
    if (control.hasError('aboveBalance')) {
      return `At most the balance due, ${formatEuros(this.balance())}.`;
    }
    if (control.hasError('beforeIssue')) {
      return `The invoice was issued on ${formatDate(this.issueDate())}: a payment cannot be earlier.`;
    }
    if (control.hasError('future')) {
      return 'A payment cannot be dated in the future.';
    }
    if (control.hasError('maxlength')) {
      return `At most ${REFERENCE_MAX_LENGTH} characters.`;
    }
    return control.getError('server') ?? null;
  }

  protected describedBy(field: Field): string | null {
    return this.message(field) ? `payment-${field}-error` : null;
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
    this.error.set(null);
    this.saving.set(true);
    this.payments
      .record(this.invoiceId(), {
        amount: parseAmount(value.amount)!,
        date: value.date,
        method: value.method,
        reference: value.reference.trim() || null,
        note: null,
      })
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (payment) => this.recorded.emit(payment),
        error: (error: unknown) => {
          applyServerErrors(this.form, error);
          this.error.set(errorMessage(error));
        },
      });
  }

  private checkAmount(control: AbstractControl<string>): ValidationErrors | null {
    if (control.value.trim() === '') {
      return null;
    }
    const amount = parseAmount(control.value);
    if (amount === null) {
      return { amount: true };
    }
    if (amount === 0) {
      return { zero: true };
    }
    return amount > this.balance() ? { aboveBalance: true } : null;
  }

  /** ISO dates compare as strings. */
  private checkDate(control: AbstractControl<string>): ValidationErrors | null {
    if (control.value === '') {
      return null;
    }
    if (control.value < this.issueDate()) {
      return { beforeIssue: true };
    }
    return control.value > this.today ? { future: true } : null;
  }
}
