import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="logo-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#4f6bff" />
          <stop offset="1" stop-color="#14b88a" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#logo-gradient)" />
      <path d="M10 9h9l3 3v11H10z" fill="#fff" fill-opacity=".95" />
      <path d="M13 15h6M13 18.5h4" stroke="#4f6bff" stroke-width="1.8" stroke-linecap="round" />
    </svg>
    <span>Invoice<strong>Flow</strong></span>
  `,
  styles: `
    :host { display: inline-flex; align-items: center; gap: .6rem; font-size: 1.15rem;
            font-weight: 600; letter-spacing: -.02em; color: inherit; }
    strong { font-weight: 800; }
  `,
})
export class Logo {}
