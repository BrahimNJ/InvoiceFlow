import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

/** Same key as the inline script in index.html, which applies the theme before the first paint. */
export const THEME_STORAGE_KEY = 'invoiceflow.theme';

/**
 * Light or dark: the visitor's explicit choice if any, otherwise the operating system's, followed live.
 * The theme is applied as `data-theme` on `<html>`; the CSS only redefines tokens for `[data-theme='dark']`.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly media = this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');

  private readonly choice = signal<Theme | null>(readChoice());
  private readonly systemDark = signal(this.media?.matches ?? false);

  readonly theme = computed<Theme>(() => this.choice() ?? (this.systemDark() ? 'dark' : 'light'));

  constructor() {
    this.media?.addEventListener('change', (event) => this.systemDark.set(event.matches));
    effect(() => {
      const theme = this.theme();
      this.document.documentElement.dataset['theme'] = theme;
      this.document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#141310' : '#f5f1e8');
    });
  }

  toggle(): void {
    const next: Theme = this.theme() === 'dark' ? 'light' : 'dark';
    this.choice.set(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage unavailable (private mode, blocked): the choice lasts for this visit only.
    }
  }
}

function readChoice(): Theme | null {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : null;
  } catch {
    return null;
  }
}
