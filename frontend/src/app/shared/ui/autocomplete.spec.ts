import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AUTOCOMPLETE_DEBOUNCE_MS, Autocomplete } from './autocomplete';

const FRUITS = ['Apple', 'Apricot', 'Banana'];

@Component({
  imports: [Autocomplete],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-autocomplete
      label="Fruit"
      [search]="search"
      [createLabel]="createLabel()"
      (picked)="picked.set($event)"
      (create)="created.set($event)"
    >
      <ng-template #option let-item><span class="fruit">{{ item }}</span></ng-template>
    </app-autocomplete>
  `,
})
class Host {
  readonly searches: string[] = [];
  readonly search = (text: string) => {
    this.searches.push(text);
    return of(FRUITS.filter((fruit) => fruit.toLowerCase().includes(text.toLowerCase())));
  };
  readonly createLabel = signal<string | undefined>(undefined);
  readonly picked = signal<string | null>(null);
  readonly created = signal<string | null>(null);
}

describe('Autocomplete', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  let page: HTMLElement;

  // Fake timers drive the debounce; whenStable() would wait for them, so changes are detected by hand
  beforeEach(() => {
    vi.useFakeTimers();
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    page = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => vi.useRealTimers());

  const input = () => page.querySelector<HTMLInputElement>('input[role="combobox"]')!;
  const options = () => [...page.querySelectorAll<HTMLElement>('li[role="option"]')];

  function settle(): void {
    vi.advanceTimersByTime(AUTOCOMPLETE_DEBOUNCE_MS);
    fixture.detectChanges();
  }

  function type(text: string): void {
    input().value = text;
    input().dispatchEvent(new Event('input'));
    settle();
  }

  const key = (name: string) => input().dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));

  it('is an accessible combobox that suggests matches once the user stops typing', () => {
    expect(input().getAttribute('aria-expanded')).toBe('false');

    type('ap');

    expect(host.searches).toEqual(['ap']);
    expect(input().getAttribute('aria-expanded')).toBe('true');
    expect(options().map((option) => option.textContent?.trim())).toEqual(['Apple', 'Apricot']);
    expect(input().getAttribute('aria-activedescendant')).toBe(options()[0].id);
  });

  it('moves with the arrow keys and picks with Enter, then empties the field', () => {
    type('ap');

    key('ArrowDown');
    fixture.detectChanges();
    expect(options()[1].getAttribute('aria-selected')).toBe('true');
    key('Enter');
    fixture.detectChanges();

    expect(host.picked()).toBe('Apricot');
    expect(input().value).toBe('');
    expect(input().getAttribute('aria-expanded')).toBe('false');
  });

  it('says when nothing matches and closes with Escape', () => {
    type('kiwi');

    expect(page.querySelector('.none')?.textContent).toContain('No match');
    key('Escape');
    fixture.detectChanges();
    expect(input().getAttribute('aria-expanded')).toBe('false');
  });

  it('offers to create an item from the typed text', () => {
    host.createLabel.set('New fruit');
    fixture.detectChanges();
    type(' Kiwi ');

    const create = options().at(-1)!;
    expect(create.textContent).toContain('New fruit “Kiwi”');
    create.click();

    expect(host.created()).toBe('Kiwi');
    expect(host.picked()).toBeNull();
  });

  it('suggests the first options as soon as it gets the focus', () => {
    input().dispatchEvent(new Event('focus'));
    settle();

    expect(host.searches).toEqual(['']);
    expect(options().length).toBe(3);
  });
});
