import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SLOW_REQUEST_MS, SubmitButton } from './submit-button';

describe('SubmitButton', () => {
  let fixture: ComponentFixture<SubmitButton>;

  beforeEach(() => {
    vi.useFakeTimers();
    fixture = TestBed.createComponent(SubmitButton);
    fixture.componentRef.setInput('label', 'Sign in');
    fixture.componentRef.setInput('busyLabel', 'Signing in…');
  });

  afterEach(() => vi.useRealTimers());

  const button = () => (fixture.nativeElement as HTMLElement).querySelector('button')!;
  const slowMessage = () => (fixture.nativeElement as HTMLElement).querySelector('.slow');

  it('is an enabled submit button when idle', () => {
    fixture.detectChanges();

    expect(button().type).toBe('submit');
    expect(button().disabled).toBe(false);
    expect(button().textContent).toContain('Sign in');
  });

  it('is disabled with a busy label while the request runs', () => {
    fixture.componentRef.setInput('busy', true);
    fixture.detectChanges();

    expect(button().disabled).toBe(true);
    expect(button().getAttribute('aria-busy')).toBe('true');
    expect(button().textContent).toContain('Signing in…');
  });

  it('explains a slow request (server waking up) and hides it when done', () => {
    fixture.componentRef.setInput('busy', true);
    fixture.detectChanges();
    expect(slowMessage()).toBeNull();

    vi.advanceTimersByTime(SLOW_REQUEST_MS);
    fixture.detectChanges();
    expect(slowMessage()?.textContent).toContain('waking up');

    fixture.componentRef.setInput('busy', false);
    fixture.detectChanges();
    expect(slowMessage()).toBeNull();
  });
});
