import { HttpErrorResponse } from '@angular/common/http';

import { testProduct } from '../../products/product.fixtures';
import { testInvoice, testLine } from '../invoice.fixtures';
import {
  applyInvoiceServerErrors,
  invoiceForm,
  lineForm,
  lineFromProduct,
  loadInvoice,
  pricedLine,
  toPayload,
} from './invoice-form';

describe('invoice form', () => {
  it('prefills a line from a catalogue product', () => {
    const line = lineFromProduct(testProduct({ id: 7, unitPrice: 49.9, description: null }));

    expect(line.getRawValue()).toEqual({
      productId: 7,
      type: 'SERVICE',
      label: 'Web development',
      details: '',
      quantity: '1',
      unit: 'DAY',
      unitPrice: '49,90',
      vatRate: 20,
    });
    expect(line.valid).toBe(true);
  });

  it('validates the label, quantity and price of a line', () => {
    const line = lineForm({ label: ' ', quantity: '1,2345', unitPrice: '12,345' });
    line.controls.label.setValue('');

    expect(line.controls.label.hasError('required')).toBe(true);
    expect(line.controls.quantity.hasError('quantity')).toBe(true);
    expect(line.controls.unitPrice.hasError('amount')).toBe(true);
    line.controls.quantity.setValue('0');
    expect(line.controls.quantity.hasError('quantity')).toBe(true);
  });

  it('loads a draft and writes it back as the API body', () => {
    const form = invoiceForm();
    loadInvoice(
      form,
      testInvoice({
        paymentTerms: 'NET_15',
        notes: 'Thanks',
        lines: [testLine({ quantity: 1.5, unitPrice: 650, details: null }), testLine({ productId: null, quantity: 2 })],
      }),
    );

    expect(form.controls.lines.length).toBe(2);
    expect(form.controls.lines.at(0).controls.quantity.value).toBe('1,5');
    expect(form.controls.lines.at(0).controls.unitPrice.value).toBe('650,00');
    expect(toPayload(form, 3)).toEqual({
      customerId: 3,
      paymentTerms: 'NET_15',
      notes: 'Thanks',
      lines: [
        { productId: 1, type: 'SERVICE', label: 'Web development', details: null, quantity: 1.5, unit: 'DAY', unitPrice: 650, vatRate: 20 },
        {
          productId: null,
          type: 'SERVICE',
          label: 'Web development',
          details: 'Senior developer, day rate',
          quantity: 2,
          unit: 'DAY',
          unitPrice: 650,
          vatRate: 20,
        },
      ],
    });
  });

  it('counts what is not a valid number yet as zero for the live totals', () => {
    expect(pricedLine({ quantity: '2,5', unitPrice: '10', vatRate: 10 })).toEqual({ quantity: 2.5, unitPrice: 10, vatRate: 10 });
    expect(pricedLine({ quantity: 'abc', unitPrice: '', vatRate: 20 })).toEqual({ quantity: 0, unitPrice: 0, vatRate: 20 });
  });

  it('puts the server messages on the right line', () => {
    const form = invoiceForm();
    form.controls.lines.push(lineForm({ label: 'A', unitPrice: '1' }));
    form.controls.lines.push(lineForm({ label: 'B', unitPrice: '1' }));

    applyInvoiceServerErrors(
      form,
      new HttpErrorResponse({
        status: 400,
        error: { errors: { 'lines[1].quantity': 'must be greater than 0', notes: 'size must be at most 2000' } },
      }),
    );

    expect(form.controls.lines.at(1).controls.quantity.getError('server')).toBe('must be greater than 0');
    expect(form.controls.lines.at(0).controls.quantity.errors).toBeNull();
    expect(form.controls.notes.getError('server')).toBe('size must be at most 2000');
  });
});
