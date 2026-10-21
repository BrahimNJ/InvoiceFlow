import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HELP_STORAGE_PREFIX, HelpTip } from './help-tip';

describe('HelpTip', () => {
  let fixture: ComponentFixture<HelpTip>;

  beforeEach(() => {
    localStorage.clear();
    fixture = TestBed.createComponent(HelpTip);
    fixture.componentRef.setInput('storageKey', 'products');
    fixture.componentRef.setInput('heading', 'How it works');
    fixture.componentRef.setInput('tips', ['Prices exclude VAT.', 'Pick goods or service.']);
  });

  const toggle = () => (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.toggle')!;
  const body = () => (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.body')!;

  it('starts open and lists the tips', async () => {
    await fixture.whenStable();

    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(toggle().getAttribute('aria-controls')).toBe(body().id);
    expect(body().hidden).toBe(false);
    expect([...body().querySelectorAll('li')].map((li) => li.textContent?.trim())).toEqual([
      'Prices exclude VAT.',
      'Pick goods or service.',
    ]);
  });

  it('collapses and remembers it for this screen', async () => {
    await fixture.whenStable();

    toggle().click();
    await fixture.whenStable();

    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(body().hidden).toBe(true);
    expect(localStorage.getItem(`${HELP_STORAGE_PREFIX}products`)).toBe('collapsed');

    toggle().click();
    await fixture.whenStable();
    expect(localStorage.getItem(`${HELP_STORAGE_PREFIX}products`)).toBeNull();
  });

  it('starts collapsed when the user hid it before', async () => {
    localStorage.setItem(`${HELP_STORAGE_PREFIX}products`, 'collapsed');

    await fixture.whenStable();

    expect(body().hidden).toBe(true);
    expect(toggle().textContent).toContain('Show');
  });
});
