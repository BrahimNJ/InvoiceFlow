import { ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender, inject, input, signal } from '@angular/core';
import { FormArray, ReactiveFormsModule } from '@angular/forms';
import { map } from 'rxjs';

import {
  PRODUCT_TYPES,
  PRODUCT_UNITS,
  Product,
  ProductType,
  ProductUnit,
  VAT_RATES,
} from '../../products/product.models';
import { ProductService } from '../../products/product.service';
import { formatEuros, formatPercent } from '../../shared/format/money';
import { showError } from '../../shared/forms/forms';
import { Icon } from '../../shared/icon/icon';
import { Autocomplete } from '../../shared/ui/autocomplete';
import { lineTotal } from '../invoice-calc';
import { LineForm, MAX_LINES, lineForm, lineFromProduct, pricedLine } from './invoice-form';

let nextKey = 0;

/**
 * The lines of the invoice, edited in place like a spreadsheet: add from the catalogue or a free line, Enter moves to
 * the next line (or adds one after the last), duplicate, reorder and remove. Totals update at each keystroke.
 */
@Component({
  selector: 'app-invoice-lines',
  imports: [Autocomplete, Icon, ReactiveFormsModule],
  templateUrl: './invoice-lines.html',
  styleUrl: './invoice-lines.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceLines {
  private readonly products = inject(ProductService);
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  private readonly injector = inject(Injector);

  readonly lines = input.required<FormArray<LineForm>>();

  protected readonly types = PRODUCT_TYPES;
  protected readonly typeOptions = Object.keys(PRODUCT_TYPES) as ProductType[];
  protected readonly units = PRODUCT_UNITS;
  protected readonly unitOptions = Object.keys(PRODUCT_UNITS) as ProductUnit[];
  protected readonly vatRates = VAT_RATES;
  protected readonly formatEuros = formatEuros;
  protected readonly formatPercent = formatPercent;
  protected readonly maxLines = MAX_LINES;
  protected readonly showError = showError;

  /** Lines whose details field is open. */
  protected readonly expanded = signal(new Set<LineForm>());
  /** Stable ids for the fields of each line, whatever its position. */
  private readonly keys = new WeakMap<LineForm, number>();

  protected readonly searchProducts = (text: string) =>
    this.products.list({ search: text, size: 8 }).pipe(map((page) => page.content));

  protected key(line: LineForm): number {
    let key = this.keys.get(line);
    if (key === undefined) {
      key = nextKey++;
      this.keys.set(line, key);
    }
    return key;
  }

  protected total(line: LineForm): string {
    const { quantity, unitPrice } = pricedLine(line.getRawValue());
    return formatEuros(lineTotal(quantity, unitPrice));
  }

  /** `Service · 650,00 € / day · VAT 20 %` */
  protected productMeta(product: Product): string {
    return `${PRODUCT_TYPES[product.type].label} · ${formatEuros(product.unitPrice)} / ${PRODUCT_UNITS[product.unit].per}` +
      ` · VAT ${formatPercent(product.vatRate)}`;
  }

  protected addProduct(product: Product): void {
    this.add(lineFromProduct(product), 'quantity');
  }

  protected addFreeLine(): void {
    this.add(lineForm(), 'label');
  }

  protected duplicate(index: number): void {
    const copy = lineForm(this.lines().at(index).getRawValue());
    this.lines().insert(index + 1, copy);
    this.lines().markAsDirty();
    this.focus(copy, 'label');
  }

  protected move(index: number, offset: -1 | 1): void {
    const lines = this.lines();
    const line = lines.at(index);
    lines.removeAt(index, { emitEvent: false });
    lines.insert(index + offset, line);
    lines.markAsDirty();
    this.focus(line, offset < 0 ? 'up' : 'down');
  }

  protected remove(index: number): void {
    const lines = this.lines();
    lines.removeAt(index);
    lines.markAsDirty();
    const next = lines.at(Math.min(index, lines.length - 1));
    if (next) {
      this.focus(next, 'label');
    }
  }

  protected toggleDetails(line: LineForm): void {
    const open = !this.expanded().has(line);
    this.expanded.update((set) => {
      const copy = new Set(set);
      if (open) {
        copy.add(line);
      } else {
        copy.delete(line);
      }
      return copy;
    });
    if (open) {
      this.focus(line, 'details');
    }
  }

  protected detailsOpen(line: LineForm): boolean {
    return this.expanded().has(line) || line.controls.details.value !== '';
  }

  /** Enter goes to the next line; on the last line it adds a new one. */
  protected onEnter(event: Event, index: number): void {
    event.preventDefault();
    const next = this.lines().at(index + 1);
    if (next) {
      this.focus(next, 'label');
    } else if (this.lines().at(index).valid) {
      this.addFreeLine();
    }
  }

  protected message(line: LineForm, field: 'label' | 'quantity' | 'unitPrice' | 'details'): string | null {
    const control = line.controls[field];
    if (!showError(control)) {
      return null;
    }
    if (control.hasError('server')) {
      return control.getError('server') as string;
    }
    if (control.hasError('required')) {
      return field === 'label' ? 'Describe what you bill.' : 'Required.';
    }
    if (control.hasError('quantity')) {
      return 'A positive number, at most 3 decimals.';
    }
    if (control.hasError('amount')) {
      return 'An amount like 650 or 49,90.';
    }
    if (control.hasError('maxlength')) {
      return `At most ${control.getError('maxlength').requiredLength} characters.`;
    }
    return null;
  }

  private add(line: LineForm, field: 'label' | 'quantity'): void {
    if (this.lines().length >= MAX_LINES) {
      return;
    }
    this.lines().push(line);
    this.lines().markAsDirty();
    this.focus(line, field);
  }

  /** Moves the focus once the line is rendered; `up` and `down` are its move buttons. */
  private focus(line: LineForm, field: 'label' | 'quantity' | 'details' | 'up' | 'down'): void {
    const id = `line-${this.key(line)}-${field}`;
    afterNextRender(
      () => {
        const target = this.host.querySelector<HTMLElement>(`#${id}`);
        // A move button is disabled at the top or bottom: the label takes the focus instead
        (target && !(target as HTMLButtonElement).disabled
          ? target
          : this.host.querySelector<HTMLElement>(`#line-${this.key(line)}-label`)
        )?.focus();
      },
      { injector: this.injector },
    );
  }
}
