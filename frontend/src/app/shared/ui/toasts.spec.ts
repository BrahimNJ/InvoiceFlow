import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TOAST_DURATION_MS, ToastService } from './toast.service';
import { Toasts } from './toasts';

describe('Toasts', () => {
  let fixture: ComponentFixture<Toasts>;
  let service: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    fixture = TestBed.createComponent(Toasts);
    service = TestBed.inject(ToastService);
  });

  afterEach(() => vi.useRealTimers());

  const messages = () =>
    [...(fixture.nativeElement as HTMLElement).querySelectorAll('.toast p')].map((p) => p.textContent);

  it('announces messages in a live region and hides them after a while', () => {
    service.success('ACME was created.');
    fixture.detectChanges();

    const region = (fixture.nativeElement as HTMLElement).querySelector('[aria-live="polite"]');
    expect(region?.textContent).toContain('ACME was created.');

    vi.advanceTimersByTime(TOAST_DURATION_MS);
    fixture.detectChanges();
    expect(messages()).toEqual([]);
  });

  it('can be dismissed and keeps at most three messages', () => {
    for (const message of ['One', 'Two', 'Three', 'Four']) {
      service.success(message);
    }
    service.error('Five');
    fixture.detectChanges();

    expect(messages()).toEqual(['Three', 'Four', 'Five']);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.toast.error').length).toBe(1);

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.close')!.click();
    fixture.detectChanges();
    expect(messages()).toEqual(['Four', 'Five']);
  });
});
