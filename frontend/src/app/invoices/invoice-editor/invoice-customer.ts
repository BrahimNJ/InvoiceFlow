import { ChangeDetectionStrategy, Component, computed, inject, model, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable, map } from 'rxjs';

import { CustomerDrawer } from '../../customers/customer-drawer/customer-drawer';
import { Customer } from '../../customers/customer.models';
import { CustomerService } from '../../customers/customer.service';
import { Icon } from '../../shared/icon/icon';
import { Autocomplete } from '../../shared/ui/autocomplete';
import { BilledCustomer } from '../invoice.models';

/** The customer billed by the draft: its id and the details printed on the invoice. */
export interface SelectedCustomer {
  id: number | null;
  details: BilledCustomer;
}

export function billedCustomer(customer: Customer): BilledCustomer {
  return {
    name: customer.name,
    email: customer.email,
    street: customer.street,
    postalCode: customer.postalCode,
    city: customer.city,
    country: customer.country,
    siret: customer.siret,
    vatNumber: customer.vatNumber,
  };
}

/**
 * Who is billed: search an existing customer, or create one in a drawer without leaving the invoice. Once chosen,
 * shows the billing card as it will be printed and warns when the address is missing.
 */
@Component({
  selector: 'app-invoice-customer',
  imports: [Autocomplete, CustomerDrawer, Icon, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (customer(); as selected) {
      <div class="card">
        <span class="avatar" aria-hidden="true">{{ (selected.details.name ?? '?').charAt(0) }}</span>
        <div class="text">
          <strong>{{ selected.details.name }}</strong>
          @for (part of address(); track $index) {
            <span>{{ part }}</span>
          } @empty {
            <span class="missing"><app-icon name="alert" [size]="14" />No billing address</span>
          }
          @if (selected.details.siret) {
            <span class="muted">SIRET {{ selected.details.siret }}</span>
          }
          @if (selected.details.email) {
            <span class="muted">{{ selected.details.email }}</span>
          }
        </div>
        <div class="actions">
          @if (selected.id !== null) {
            <a class="btn btn-ghost btn-sm" [routerLink]="['/customers', selected.id, 'edit']" target="_blank">
              <app-icon name="pencil" [size]="14" />Edit details
            </a>
          }
          <button class="btn btn-ghost btn-sm" type="button" (click)="change()">Change</button>
        </div>
      </div>
    } @else {
      <app-autocomplete
        #picker
        label="Customer"
        placeholder="Search a customer by name or email"
        icon="users"
        emptyText="Your customers"
        inputId="customer-picker"
        createLabel="New customer"
        [search]="search"
        (picked)="choose($event)"
        (create)="drawerName.set($event)"
      >
        <ng-template #option let-customer>
          <span class="option">
            <span class="option-name">{{ customer.name }}</span>
            <span class="option-meta">{{ customer.email }}{{ customer.city ? ' · ' + customer.city : '' }}</span>
          </span>
        </ng-template>
      </app-autocomplete>
    }
    @if (drawerName() !== null) {
      <app-customer-drawer [name]="drawerName()!" (created)="choose($event); drawerName.set(null)" (closed)="drawerName.set(null)" />
    }
  `,
  styles: `
    :host { display: block; }
    .card { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 1rem; padding: 1rem; border-radius: 14px;
            background: var(--bg); border: 1px solid var(--line); }
    .avatar { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 12px; font-weight: 750;
              font-size: 1.1rem; text-transform: uppercase; color: #fff;
              background: linear-gradient(135deg, var(--brand), var(--accent)); }
    .text { display: grid; gap: .1rem; flex: 1 1 200px; min-width: 0; font-size: .925rem; }
    .text strong { font-size: 1rem; }
    .muted { color: var(--ink-500); }
    .missing { display: inline-flex; align-items: center; gap: .3rem; color: var(--warning); font-weight: 600; }
    .actions { display: flex; flex-wrap: wrap; gap: .4rem; }
    .option { display: grid; gap: .1rem; }
    .option-name { font-weight: 600; }
    .option-meta { font-size: .8rem; color: var(--ink-500); }
  `,
})
export class InvoiceCustomer {
  private readonly customers = inject(CustomerService);
  private readonly picker = viewChild<Autocomplete<Customer>>('picker');

  readonly customer = model<SelectedCustomer | null>(null);

  /** Name to prefill in the new customer drawer; the drawer is closed when `null`. */
  protected readonly drawerName = signal<string | null>(null);

  protected readonly search = (text: string): Observable<Customer[]> =>
    this.customers.list({ search: text, size: 8 }).pipe(map((page) => page.content));

  protected readonly address = computed(() => {
    const details = this.customer()?.details;
    if (!details) {
      return [];
    }
    return [details.street, [details.postalCode, details.city].filter(Boolean).join(' '), details.country].filter(
      (part): part is string => !!part,
    );
  });

  protected choose(customer: Customer): void {
    this.customer.set({ id: customer.id, details: billedCustomer(customer) });
  }

  protected change(): void {
    this.customer.set(null);
    setTimeout(() => this.picker()?.focus());
  }
}
