import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * A sheet with a folded corner; the text lines are cut out of the sheet (SVG mask), so the mark follows
 * `currentColor` and reads on paper and on ink panels alike.
 */
@Component({
  selector: 'app-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 28 32" width="24" height="28" aria-hidden="true" focusable="false">
      <mask id="logo-lines">
        <rect width="28" height="32" fill="#fff" />
        <path d="M6.5 15h11M6.5 19.5h11M6.5 24h6" stroke="#000" stroke-width="1.8" stroke-linecap="square" />
      </mask>
      <path d="M2 2h16l8 8v20H2z" fill="currentColor" mask="url(#logo-lines)" />
      <path d="M18 2v8h8z" fill="var(--accent)" />
    </svg>
    <span class="word">Invoice<em>Flow</em></span>
  `,
  styles: `
    :host { display: inline-flex; align-items: center; gap: .55rem; color: inherit; }
    .word { font-size: 1.12rem; font-weight: 600; letter-spacing: -.02em; }
    em { font-family: var(--font-serif); font-size: 1.2em; font-weight: 400; letter-spacing: 0; }
  `,
})
export class Logo {}
