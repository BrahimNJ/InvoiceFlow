import { TestBed } from '@angular/core/testing';

import { ThemeToggle } from './theme-toggle';

describe('ThemeToggle', () => {
  beforeEach(() => localStorage.clear());

  it('names the theme it switches to and toggles it', async () => {
    const fixture = TestBed.createComponent(ThemeToggle);
    await fixture.whenStable();
    const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;

    expect(button.getAttribute('aria-label')).toBe('Switch to dark theme');

    button.click();
    await fixture.whenStable();

    expect(button.getAttribute('aria-label')).toBe('Switch to light theme');
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });
});
