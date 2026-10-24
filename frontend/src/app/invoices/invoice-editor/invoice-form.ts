// Form model of the invoice editor and its conversion to and from the API.
import { AbstractControl, FormArray, FormControl, FormGroup, ValidationErrors, Validators } from '@angular/forms';

import { fieldErrors } from '../../core/http/problem-detail';
import { Product, ProductType, ProductUnit } from '../../products/product.models';
import { amountInputValue, parseAmount } from '../../shared/format/money';
import { PricedLine, parseQuantity, quantityInputValue } from '../invoice-calc';
import { Invoice, InvoiceLinePayload, InvoicePayload, PaymentTerms } from '../invoice.models';

export const LABEL_MAX_LENGTH = 255;
export const DETAILS_MAX_LENGTH = 1000;
export const NOTES_MAX_LENGTH = 2000;
export const MAX_LINES = 200;

export type LineForm = FormGroup<{
  productId: FormControl<number | null>;
  type: FormControl<ProductType>;
  label: FormControl<string>;
  details: FormControl<string>;
  quantity: FormControl<string>;
  unit: FormControl<ProductUnit>;
  unitPrice: FormControl<string>;
  vatRate: FormControl<number>;
}>;

export type InvoiceForm = FormGroup<{
  paymentTerms: FormControl<PaymentTerms>;
  notes: FormControl<string>;
  lines: FormArray<LineForm>;
}>;

export type LineValue = LineForm['value'];

/** A positive quantity with at most 3 decimals (empty values are left to `required`). */
function quantity(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim() === '' || parseQuantity(control.value) !== null ? null : { quantity: true };
}

/** An amount in euros with at most 2 decimals (empty values are left to `required`). */
function amount(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim() === '' || parseAmount(control.value) !== null ? null : { amount: true };
}

/** Rules match the backend InvoiceLineRequest. */
export function lineForm(value: Partial<NonNullable<LineValue>> = {}): LineForm {
  return new FormGroup({
    productId: new FormControl<number | null>(value.productId ?? null),
    type: new FormControl<ProductType>(value.type ?? 'SERVICE', { nonNullable: true }),
    label: new FormControl(value.label ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(LABEL_MAX_LENGTH)],
    }),
    details: new FormControl(value.details ?? '', {
      nonNullable: true,
      validators: [Validators.maxLength(DETAILS_MAX_LENGTH)],
    }),
    quantity: new FormControl(value.quantity ?? '1', { nonNullable: true, validators: [Validators.required, quantity] }),
    unit: new FormControl<ProductUnit>(value.unit ?? 'UNIT', { nonNullable: true }),
    unitPrice: new FormControl(value.unitPrice ?? '', { nonNullable: true, validators: [Validators.required, amount] }),
    vatRate: new FormControl(value.vatRate ?? 20, { nonNullable: true }),
  });
}

/** A line prefilled from the catalogue: the user can still adjust it for this invoice. */
export function lineFromProduct(product: Product): LineForm {
  return lineForm({
    productId: product.id,
    type: product.type,
    label: product.name,
    details: product.description ?? '',
    quantity: '1',
    unit: product.unit,
    unitPrice: amountInputValue(product.unitPrice),
    vatRate: product.vatRate,
  });
}

export function invoiceForm(): InvoiceForm {
  return new FormGroup({
    paymentTerms: new FormControl<PaymentTerms>('NET_30', { nonNullable: true }),
    notes: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(NOTES_MAX_LENGTH)] }),
    lines: new FormArray<LineForm>([], { validators: [Validators.maxLength(MAX_LINES)] }),
  });
}

/** Fills the form with a saved draft. */
export function loadInvoice(form: InvoiceForm, invoice: Invoice): void {
  form.controls.lines.clear({ emitEvent: false });
  for (const line of invoice.lines) {
    form.controls.lines.push(
      lineForm({
        productId: line.productId,
        type: line.type,
        label: line.label,
        details: line.details ?? '',
        quantity: quantityInputValue(line.quantity),
        unit: line.unit,
        unitPrice: amountInputValue(line.unitPrice),
        vatRate: line.vatRate,
      }),
      { emitEvent: false },
    );
  }
  form.patchValue({ paymentTerms: invoice.paymentTerms, notes: invoice.notes ?? '' });
}

/** The numbers of a line as typed so far; anything not valid yet counts as 0. */
export function pricedLine(line: LineValue): PricedLine {
  return {
    quantity: parseQuantity(line.quantity ?? '') ?? 0,
    unitPrice: parseAmount(line.unitPrice ?? '') ?? 0,
    vatRate: line.vatRate ?? 0,
  };
}

/** Body of create and update; the form is valid at this point. */
export function toPayload(form: InvoiceForm, customerId: number | null): InvoicePayload {
  const value = form.getRawValue();
  return {
    customerId,
    paymentTerms: value.paymentTerms,
    notes: value.notes.trim() || null,
    lines: value.lines.map(
      (line): InvoiceLinePayload => ({
        productId: line.productId,
        type: line.type,
        label: line.label.trim(),
        details: line.details.trim() || null,
        quantity: parseQuantity(line.quantity)!,
        unit: line.unit,
        unitPrice: parseAmount(line.unitPrice)!,
        vatRate: line.vatRate,
      }),
    ),
  };
}

/**
 * Shows the backend validation messages on the matching fields: `lines[1].quantity` is the `quantity` field of the
 * second line. The `server` error is cleared as soon as the user edits the field.
 */
export function applyInvoiceServerErrors(form: InvoiceForm, error: unknown): void {
  for (const [name, message] of Object.entries(fieldErrors(error))) {
    const control = form.get(name.replace(/\[(\d+)]/g, '.$1'));
    control?.setErrors({ ...control.errors, server: message });
    control?.markAsTouched();
  }
}
