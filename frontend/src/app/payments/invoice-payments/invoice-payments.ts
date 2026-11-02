import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { errorMessage } from '../../core/http/problem-detail';
import { formatDate } from '../../invoices/invoice-calc';
import { Invoice } from '../../invoices/invoice.models';
import { formatEuros } from '../../shared/format/money';
import { Icon } from '../../shared/icon/icon';
import { PAYMENT_METHODS, Payment } from '../payment.models';
import { PaymentService } from '../payment.service';

/** The payments panel of an issued invoice: what was received, when and how. */
@Component({
  selector: 'app-invoice-payments',
  imports: [Icon],
  templateUrl: './invoice-payments.html',
  styleUrl: './invoice-payments.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoicePayments implements OnInit {
  private readonly payments = inject(PaymentService);
  private readonly destroyRef = inject(DestroyRef);

  readonly invoice = input.required<Invoice>();

  protected readonly formatEuros = formatEuros;
  protected readonly formatDate = formatDate;
  protected readonly methods = PAYMENT_METHODS;

  protected readonly list = signal<Payment[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
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
