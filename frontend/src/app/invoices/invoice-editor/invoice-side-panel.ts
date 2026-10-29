import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

import { formatEuros, formatPercent } from '../../shared/format/money';
import { Icon } from '../../shared/icon/icon';
import { Totals } from '../invoice-calc';
import { InvoiceDocument, InvoiceDocumentView } from '../invoice-document/invoice-document';
import { OPERATION_NATURES, READINESS, ReadinessCheck } from '../invoice.models';

/**
 * Side of the editor: the totals with the VAT breakdown and what the invoice still needs before it can be issued
 * (Summary tab), or the invoice exactly as it will be printed (Preview tab).
 */
@Component({
  selector: 'app-invoice-side-panel',
  imports: [Icon, InvoiceDocumentView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tabs" role="tablist" aria-label="Side panel">
      @for (tab of tabs; track tab.id) {
        <button
          type="button"
          role="tab"
          [id]="'side-tab-' + tab.id"
          [attr.aria-selected]="active() === tab.id"
          [attr.aria-controls]="'side-panel-' + tab.id"
          (click)="active.set(tab.id)"
        >
          <app-icon [name]="tab.icon" [size]="15" />{{ tab.label }}
        </button>
      }
    </div>

    @if (active() === 'summary') {
      <div class="panel body" role="tabpanel" id="side-panel-summary" aria-labelledby="side-tab-summary">
        <dl class="totals">
          <div><dt>Total excl. VAT</dt><dd>{{ formatEuros(totals().subtotal) }}</dd></div>
          @for (vat of totals().vatBreakdown; track vat.rate) {
            <div class="vat">
              <dt>VAT {{ formatPercent(vat.rate) }} <span>on {{ formatEuros(vat.base) }}</span></dt>
              <dd>{{ formatEuros(vat.amount) }}</dd>
            </div>
          }
          <div class="grand"><dt>Total incl. VAT</dt><dd>{{ formatEuros(totals().total) }}</dd></div>
        </dl>
        @if (natureText(); as nature) {
          <p class="nature"><app-icon name="info" [size]="14" />{{ nature }}</p>
        }

        <section class="readiness" aria-labelledby="readiness-title">
          <h3 id="readiness-title">
            Ready to issue
            <span class="score" [class.done]="blocking() === 0">{{ passed() }}/{{ checks().length }}</span>
          </h3>
          <div class="meter" aria-hidden="true"><span [style.width.%]="(passed() / checks().length) * 100"></span></div>
          <ul>
            @for (check of checks(); track check.code) {
              <li [class]="check.passed ? 'ok' : check.required ? 'missing' : 'warn'">
                <app-icon [name]="check.passed ? 'check-circle' : 'alert'" [size]="16" />
                <span>
                  <strong>{{ readiness[check.code].label }}</strong>
                  @if (!check.passed) {
                    <small>{{ check.required ? '' : 'Recommended. ' }}{{ readiness[check.code].fix }}</small>
                  }
                </span>
              </li>
            }
            <li class="pending">
              <app-icon name="clock" [size]="16" />
              <span>
                <strong>Your company details</strong>
                <small>SIREN, legal form and address of your company: coming with the company settings.</small>
              </span>
            </li>
          </ul>
        </section>
      </div>
    } @else {
      <div class="preview" role="tabpanel" id="side-panel-preview" aria-labelledby="side-tab-preview">
        <app-invoice-document [doc]="doc()" />
      </div>
    }
  `,
  styles: `
    :host { display: grid; gap: .75rem; }
    .tabs { display: flex; gap: .25rem; padding: .25rem; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); }
    .tabs button { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: .4rem; min-height: 36px;
                   border: 0; border-radius: var(--radius); background: transparent; font: inherit; font-size: .875rem; font-weight: 600;
                   color: var(--ink-500); cursor: pointer; }
    .tabs button[aria-selected='true'] { background: var(--brand-50); color: var(--brand); }
    .body { padding: 1.2rem; display: grid; gap: 1rem; }
    .totals { display: grid; gap: .45rem; margin: 0; }
    .totals div { display: flex; justify-content: space-between; gap: 1rem; font-variant-numeric: tabular-nums; }
    .totals dd { margin: 0; font-weight: 600; }
    .vat { color: var(--ink-500); font-size: .9rem; }
    .vat span { font-size: .8rem; }
    .grand { margin-top: .3rem; padding: .75rem .9rem; border-radius: var(--radius); background: var(--night); color: var(--on-night);
             font-size: 1.15rem; font-weight: 750; }
    .nature { display: flex; align-items: center; gap: .4rem; font-size: .85rem; color: var(--ink-500); }
    .readiness { padding-top: 1rem; border-top: 1px solid var(--line); }
    h3 { display: flex; justify-content: space-between; font-size: .95rem; font-weight: 700; }
    .score { color: var(--warning); font-variant-numeric: tabular-nums; }
    .score.done { color: var(--accent-700); }
    .meter { height: 6px; margin: .5rem 0 .9rem; border-radius: 99px; background: var(--line); overflow: hidden; }
    .meter span { display: block; height: 100%; border-radius: inherit; background: var(--brand);
                  transition: width .3s var(--ease-out); }
    ul { display: grid; gap: .6rem; }
    li { display: flex; gap: .55rem; font-size: .875rem; }
    li span { display: grid; gap: .1rem; }
    li small { color: var(--ink-500); font-size: .8rem; }
    li app-icon { margin-top: .1rem; }
    .ok app-icon { color: var(--accent); }
    .missing app-icon { color: var(--danger); }
    .warn app-icon, .pending app-icon { color: var(--warning); }
    .ok strong { font-weight: 500; color: var(--ink-700); }
  `,
})
export class InvoiceSidePanel {
  readonly totals = input.required<Totals>();
  readonly checks = input.required<ReadinessCheck[]>();
  readonly doc = input.required<InvoiceDocument>();

  protected readonly tabs = [
    { id: 'summary', label: 'Summary', icon: 'check-circle' },
    { id: 'preview', label: 'Preview', icon: 'eye' },
  ] as const;
  protected readonly active = signal<'summary' | 'preview'>('summary');
  protected readonly readiness = READINESS;
  protected readonly formatEuros = formatEuros;
  protected readonly formatPercent = formatPercent;

  protected readonly passed = computed(() => this.checks().filter((check) => check.passed).length);
  protected readonly blocking = computed(() => this.checks().filter((check) => check.required && !check.passed).length);
  protected readonly natureText = computed(() => {
    const nature = this.doc().operationNature;
    return nature ? OPERATION_NATURES[nature] : null;
  });
}
