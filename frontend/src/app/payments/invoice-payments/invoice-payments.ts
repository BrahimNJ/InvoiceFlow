import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
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
import { ConfirmService } from '../../shared/ui/confirm.service';
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
  private readonly confirm = inject(ConfirmService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  private readonly injector = inject(Injector);

  readonly invoice = input.required<Invoice>();
  readonly changed = output<void>();

  protected readonly formatEuros = formatEuros;
  protected readonly formatDate = formatDate;
  protected readonly methods = PAYMENT_METHODS;

  protected readonly list = signal<Payment[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly recording = signal(false);
  /** Id of the payment being deleted; one at a time. */
  protected readonly deleting = signal<number | null>(null);
  /** Only an issued invoice waits for payment; a paid one is settled. */
  protected readonly canRecord = computed(() => this.invoice().status === 'ISSUED');

  ngOnInit(): void {
    this.load();
  }

  /** Closes the form and gives the focus back to the button that opened it. */
  protected closeForm(): void {
    this.recording.set(false);
    this.restoreFocus();
  }

  protected recorded(payment: Payment): void {
    this.closeForm();
    this.toasts.success(`Payment of ${formatEuros(payment.amount)} recorded.`);
    this.load();
    this.changed.emit();
  }

  /** Deletes a payment recorded by mistake; its amount is due again and a paid invoice is reopened. */
  protected async delete(payment: Payment): Promise<void> {
    if (this.deleting() !== null) {
      return;
    }
    const ok = await this.confirm.ask({
      title: `Delete the payment of ${formatEuros(payment.amount)}?`,
      message:
        `Received on ${formatDate(payment.date)}. Its amount will be due again on this invoice. ` +
        'Record it again if it was only wrong.',
      confirmLabel: 'Delete payment',
      tone: 'danger',
    });
    if (!ok) {
      return;
    }
    this.deleting.set(payment.id);
    this.payments
      .delete(this.invoice().id, payment.id)
      .pipe(
        finalize(() => this.deleting.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.toasts.success('Payment deleted.');
          this.load();
          this.changed.emit();
        },
        error: (error: unknown) => this.toasts.error(errorMessage(error)),
      });
  }

  /**
   * After the form closes, the focus goes back to "Record a payment", or to the panel heading when the invoice is
   * now paid and the button is gone (the page reloads the invoice in the meantime).
   */
  private restoreFocus(): void {
    afterNextRender(
      () =>
        (
          this.host.querySelector<HTMLElement>('button.record') ??
          this.host.querySelector<HTMLElement>('#payments-title')
        )?.focus(),
      { injector: this.injector },
    );
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
