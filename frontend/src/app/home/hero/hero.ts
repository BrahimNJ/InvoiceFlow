import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';

import { Icon } from '../../shared/icon/icon';

interface InvoiceLine {
  label: string;
  quantity: number;
  unitPrice: number;
}

const VAT_RATE = 0.2;

@Component({
  selector: 'app-hero',
  imports: [CurrencyPipe, Icon],
  templateUrl: './hero.html',
  styleUrl: './hero.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Hero {
  // Sample invoice shown in the illustration
  protected readonly lines: InvoiceLine[] = [
    { label: 'Web development (days)', quantity: 3, unitPrice: 450 },
    { label: 'Hosting setup', quantity: 1, unitPrice: 150 },
  ];
  protected readonly subtotal = this.lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  protected readonly vat = this.subtotal * VAT_RATE;
  protected readonly total = this.subtotal + this.vat;

  protected readonly highlights = ['Factur-X ready', 'VAT computed for you', 'PDF in one click'];
}
