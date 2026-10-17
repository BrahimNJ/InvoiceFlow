import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';

import { Icon } from '../../shared/icon/icon';

@Component({
  selector: 'app-ai-assistant',
  imports: [CurrencyPipe, Icon],
  templateUrl: './ai-assistant.html',
  styleUrl: './ai-assistant.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiAssistant {
  protected readonly prompt =
    'Create an invoice for ACME with 3 days of development at €450 per day and 20% VAT.';

  // Draft extracted from the prompt: 3 × 450 = 1,350 excl. VAT, 270 VAT, 1,620 total
  protected readonly draft = { customer: 'ACME SAS', quantity: 3, unitPrice: 450, vatRate: 0.2 };
  protected readonly subtotal = this.draft.quantity * this.draft.unitPrice;
  protected readonly total = this.subtotal * (1 + this.draft.vatRate);

  protected readonly points = [
    'Natural language turned into a structured invoice draft',
    'Every amount and rule checked by the backend before saving',
    'Ask questions such as “Which invoices are overdue?”',
  ];
}
