import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { errorMessage } from '../../core/http/problem-detail';
import { formatDate } from '../../invoices/invoice-calc';
import { Invoice } from '../../invoices/invoice.models';
import { formatEuros } from '../../shared/format/money';
import { Icon } from '../../shared/icon/icon';
import { ToastService } from '../../shared/ui/toast.service';
import { PaymentForm } from '../payment-form/payment-form';
import { PAYMENT_METHODS, Payment } from '../payment.models';
import { PaymentService } from '../payment.service';

/**
 * The payments panel of an issued invoice: what was received, when and how, and a form to record the next payment
 * while something is still due. `changed` tells the page to reload the invoice (amount paid, balance, status).
 */
@Component({
  selector: 'app-invoice-payments',
  imports: [Icon, PaymentForm],
  templateUrl: './invoice-payments.html',
  styleUrl: './invoice-payments.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoicePayments implements OnInit {
  private readonly payments = inject(PaymentService);
  private readonly toasts = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly invoice = input.required<Invoice>();
  readonly changed = output<void>();

  protected readonly formatEuros = formatEuros;
  protected readonly formatDate = formatDate;
  protected readonly methods = PAYMENT_METHODS;

  protected readonly list = signal<Payment[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly recording = signal(false);
  /** Only an issued invoice waits for payment; a paid one is settled. */
  protected readonly canRecord = computed(() => this.invoice().status === 'ISSUED');

  ngOnInit(): void {
    this.load();
  }

  protected recorded(payment: Payment): void {
    this.recording.set(false);
    this.toasts.success(`Payment of ${formatEuros(payment.amount)} recorded.`);
    this.load();
    this.changed.emit();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.payments
      .list(this.invoice().id)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (payments) => this.list.set(payments),
        error: (error: unknown) => this.loadError.set(errorMessage(error)),
      });
  }
}
