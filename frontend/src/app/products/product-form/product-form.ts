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
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { errorMessage } from '../../core/http/problem-detail';
import { AppHeader } from '../../shared/app-header';
import { amountInputValue, formatEuros, formatPercent, parseAmount, priceIncludingVat } from '../../shared/format/money';
import { applyServerErrors, focusFirstInvalid, showError } from '../../shared/forms/forms';
import { SubmitButton } from '../../shared/forms/submit-button';
import { Icon } from '../../shared/icon/icon';
import { PageHeader } from '../../shared/ui/page-header';
import { ToastService } from '../../shared/ui/toast.service';
import {
  PRODUCT_TYPES,
  PRODUCT_UNITS,
  Product,
  ProductPayload,
  ProductType,
  ProductUnit,
  VAT_RATES,
} from '../product.models';
import { ProductService } from '../product.service';

type Field = keyof ProductPayload;

export const DESCRIPTION_MAX_LENGTH = 1000;

const REQUIRED_MESSAGES: Partial<Record<Field, string>> = {
  name: 'Enter the name shown on your invoices.',
  unitPrice: 'Enter the price of one unit, excluding VAT.',
};

/** An amount in euros with at most 2 decimals (empty values are left to `required`). */
function amount(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim() === '' || parseAmount(control.value) !== null ? null : { amount: true };
}

/** Creates a product (`/products/new`) or edits one (`/products/:id/edit`). */
@Component({
  selector: 'app-product-form',
  imports: [AppHeader, Icon, PageHeader, ReactiveFormsModule, RouterLink, SubmitButton],
  templateUrl: './product-form.html',
  styleUrl: './product-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductForm implements OnInit {
  private readonly products = inject(ProductService);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  private readonly destroyRef = inject(DestroyRef);

  /** From the `:id` route parameter (router input binding); absent when creating. */
  readonly id = input<string>();

  protected readonly typeOptions = (Object.keys(PRODUCT_TYPES) as ProductType[]).map((type) => ({
    type,
    ...PRODUCT_TYPES[type],
  }));
  protected readonly unitOptions = (Object.keys(PRODUCT_UNITS) as ProductUnit[]).map((unit) => ({
    unit,
    ...PRODUCT_UNITS[unit],
  }));
  protected readonly vatRates = VAT_RATES;
  protected readonly descriptionMax = DESCRIPTION_MAX_LENGTH;
  protected readonly formatPercent = formatPercent;
  protected readonly editing = computed(() => this.id() !== undefined);

  // Rules match the backend ProductRequest
  protected readonly form = inject(NonNullableFormBuilder).group({
    type: ['SERVICE' as ProductType, [Validators.required]],
    name: ['', [Validators.required, Validators.maxLength(255)]],
    description: ['', [Validators.maxLength(DESCRIPTION_MAX_LENGTH)]],
    unitPrice: ['', [Validators.required, amount]],
    unit: ['UNIT' as ProductUnit, [Validators.required]],
    vatRate: [20, [Validators.required]],
  });
  protected readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  protected readonly selectedRate = computed(() => VAT_RATES.find((rate) => rate.value === this.value().vatRate));
  protected readonly descriptionLength = computed(() => this.value().description?.length ?? 0);
  /** Live breakdown of one unit, or null until the price is a valid amount. */
  protected readonly preview = computed(() => {
    const { unitPrice = '', vatRate = 0, unit = 'UNIT' } = this.value();
    const price = parseAmount(unitPrice);
    if (price === null) {
      return null;
    }
    const total = priceIncludingVat(price, vatRate);
    return {
      excludingVat: formatEuros(price),
      vat: formatEuros(Math.round((total - price) * 100) / 100),
      rate: formatPercent(vatRate),
      total: formatEuros(total),
      per: PRODUCT_UNITS[unit].per,
    };
  });

  protected readonly loading = signal(false);
  /** The product to edit could not be loaded: the form is not shown. */
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
    if (control.hasError('amount')) {
      return 'Enter an amount like 650 or 49,90 (at most 2 decimals).';
    }
    if (control.hasError('maxlength')) {
      return `Use at most ${control.getError('maxlength').requiredLength} characters.`;
    }
    return null;
  }

  /** Error id when the field shows an error, otherwise its hint id. */
  protected describedBy(field: Field): string {
    return `product-${field}-${this.message(field) ? 'error' : 'hint'}`;
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

    const payload = this.toPayload();
    const id = this.id();
    this.submitting.set(true);
    this.error.set(null);
    (id === undefined ? this.products.create(payload) : this.products.update(Number(id), payload))
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (product) => {
          this.toasts.success(
            id === undefined ? `“${product.name}” was added to your catalogue.` : `“${product.name}” was saved.`,
          );
          void this.router.navigateByUrl('/products');
        },
        error: (error: unknown) => {
          this.error.set(errorMessage(error));
          applyServerErrors(this.form, error);
          focusFirstInvalid(this.form, this.host);
        },
      });
  }

  private toPayload(): ProductPayload {
    const value = this.form.getRawValue();
    return {
      type: value.type,
      name: value.name.trim(),
      description: value.description.trim() || null,
      // Valid at this point (validator)
      unitPrice: parseAmount(value.unitPrice)!,
      vatRate: value.vatRate,
      unit: value.unit,
    };
  }

  private load(id: number): void {
    this.loading.set(true);
    this.products
      .get(id)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (product) => this.form.setValue(toFormValue(product)),
        error: (error: unknown) =>
          this.loadError.set(
            error instanceof HttpErrorResponse && error.status === 404
              ? 'This product does not exist or has been deleted.'
              : errorMessage(error),
          ),
      });
  }
}

function toFormValue(product: Product) {
  return {
    type: product.type,
    name: product.name,
    description: product.description ?? '',
    unitPrice: amountInputValue(product.unitPrice),
    unit: product.unit,
    vatRate: product.vatRate,
  };
}
