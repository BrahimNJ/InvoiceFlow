import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-workflow',
  templateUrl: './workflow.html',
  styleUrl: './workflow.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Workflow {
  protected readonly steps = [
    { title: 'Set up your catalogue', text: 'Add your customers, products and services with their VAT rates.' },
    { title: 'Create the invoice', text: 'Pick a customer, add lines, and let InvoiceFlow number it and compute the totals.' },
    { title: 'Send and get paid', text: 'Issue a PDF or Factur-X invoice, then follow its status until it is paid.' },
  ];
}
