import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfirmDialog } from './confirm-dialog';
import { ConfirmService } from './confirm.service';

describe('ConfirmDialog', () => {
  let fixture: ComponentFixture<ConfirmDialog>;
  let service: ConfirmService;
  let opener: HTMLButtonElement;

  beforeEach(async () => {
    fixture = TestBed.createComponent(ConfirmDialog);
    service = TestBed.inject(ConfirmService);
    opener = document.body.appendChild(document.createElement('button'));
    opener.focus();
    await fixture.whenStable();
  });

  afterEach(() => opener.remove());

  const dialog = () => (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('[role="alertdialog"]');
  const button = (label: string) =>
    [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find((b) => b.textContent?.trim() === label)!;

  /** Opens the dialog; the answer is wrapped, as an async function would otherwise wait for it. */
  async function ask(): Promise<{ answer: Promise<boolean> }> {
    const answer = service.ask({
      title: 'Delete ACME?',
      message: 'This cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    await fixture.whenStable();
    return { answer };
  }

  it('renders nothing without a question', () => {
    expect(dialog()).toBeNull();
  });

  it('shows an accessible dialog with the focus on Cancel', async () => {
    await ask();

    expect(dialog()?.getAttribute('aria-modal')).toBe('true');
    expect(dialog()?.querySelector('#confirm-title')?.textContent).toBe('Delete ACME?');
    expect(dialog()?.querySelector('#confirm-message')?.textContent).toBe('This cannot be undone.');
    expect(button('Delete').classList).toContain('btn-danger');
    expect(document.activeElement).toBe(button('Cancel'));
  });

  it('resolves true on confirm, closes and gives the focus back', async () => {
    const { answer } = await ask();

    button('Delete').click();
    await fixture.whenStable();

    await expect(answer).resolves.toBe(true);
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('resolves false on Cancel and on Escape', async () => {
    const { answer: cancelled } = await ask();
    button('Cancel').click();
    await expect(cancelled).resolves.toBe(false);

    const { answer: escaped } = await ask();
    dialog()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();
    await expect(escaped).resolves.toBe(false);
    expect(dialog()).toBeNull();
  });

  it('keeps the focus inside the dialog', async () => {
    await ask();

    button('Delete').focus();
    dialog()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    expect(document.activeElement).toBe(button('Cancel'));

    dialog()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }));
    expect(document.activeElement).toBe(button('Delete'));
  });
});
