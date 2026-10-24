import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  TemplateRef,
  contentChild,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, catchError, debounceTime, of, switchMap, tap } from 'rxjs';

import { Icon, IconName } from '../icon/icon';

/** Searching starts once the user stops typing for this long. */
export const AUTOCOMPLETE_DEBOUNCE_MS = 200;

let nextId = 0;

/**
 * Text field that suggests matches as the user types (WAI-ARIA combobox with a list box). Arrow keys move through
 * the options, Enter picks one, Escape closes the list. An optional last option creates a new item from the text.
 * Options are rendered with the projected `<ng-template #option let-item>`.
 */
@Component({
  selector: 'app-autocomplete',
  imports: [Icon, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(focusout)': 'onFocusOut($event)' },
  template: `
    <div class="field-wrap">
      <app-icon [name]="icon()" [size]="18" />
      <input
        #input
        class="input"
        type="text"
        role="combobox"
        autocomplete="off"
        aria-autocomplete="list"
        [id]="inputId()"
        [attr.aria-label]="label()"
        [attr.aria-expanded]="open()"
        [attr.aria-controls]="listId"
        [attr.aria-activedescendant]="open() && active() >= 0 ? optionId(active()) : null"
        [placeholder]="placeholder()"
        [value]="text()"
        (input)="onInput($any($event.target).value)"
        (focus)="onFocus()"
        (keydown)="onKeydown($event)"
      />
      @if (loading()) {
        <span class="spinner dark" aria-hidden="true"></span>
      }
    </div>
    <ul class="list" role="listbox" [id]="listId" [attr.aria-label]="label()" [hidden]="!open()">
      @for (item of results(); track $index) {
        <li
          role="option"
          [id]="optionId($index)"
          [attr.aria-selected]="active() === $index"
          (mousedown)="$event.preventDefault()"
          (click)="pick($index)"
          (mouseenter)="active.set($index)"
        >
          <ng-container [ngTemplateOutlet]="optionTemplate() ?? null" [ngTemplateOutletContext]="{ $implicit: item }" />
        </li>
      }
      @if (results().length === 0 && !loading()) {
        <li class="none" role="presentation">{{ text().trim() ? 'No match' : emptyText() }}</li>
      }
      @if (createLabel(); as create) {
        <li
          class="create"
          role="option"
          [id]="optionId(results().length)"
          [attr.aria-selected]="active() === results().length"
          (mousedown)="$event.preventDefault()"
          (click)="pick(results().length)"
          (mouseenter)="active.set(results().length)"
        >
          <app-icon name="plus" [size]="16" />{{ create }}{{ text().trim() ? ' “' + text().trim() + '”' : '' }}
        </li>
      }
    </ul>
  `,
  styles: `
    :host { position: relative; display: block; }
    .field-wrap { position: relative; }
    .field-wrap > app-icon { position: absolute; top: 50%; left: .9rem; transform: translateY(-50%);
                             color: var(--ink-500); pointer-events: none; }
    .input { padding-left: 2.6rem; padding-right: 2.5rem; }
    .spinner { position: absolute; top: 50%; right: .9rem; margin-top: -.5rem; }
    .list { position: absolute; z-index: 30; left: 0; right: 0; top: calc(100% + 6px); max-height: 320px; overflow-y: auto;
            padding: .35rem; border: 1px solid var(--line); border-radius: 14px; background: var(--surface);
            box-shadow: var(--shadow-md); animation: fade-in .15s ease both; }
    li[role='option'] { display: flex; align-items: center; gap: .6rem; padding: .55rem .7rem; border-radius: 10px;
                        cursor: pointer; }
    li[aria-selected='true'] { background: var(--brand-50); }
    .none { padding: .7rem; color: var(--ink-500); font-size: .9rem; }
    .create { margin-top: .25rem; border-top: 1px solid var(--line); font-weight: 600; color: var(--brand); }
  `,
})
export class Autocomplete<T> {
  /** Accessible name of the field and of its list. */
  readonly label = input.required<string>();
  readonly placeholder = input('');
  readonly icon = input<IconName>('search');
  readonly inputId = input(`autocomplete-${nextId}`);
  /** Shown in the list before the user types. */
  readonly emptyText = input('Type to search');
  /** Fetches the options for a text (blank: the first ones). */
  readonly search = input.required<(text: string) => Observable<T[]>>();
  /** Label of the last option, e.g. "New customer"; no such option when absent. */
  readonly createLabel = input<string>();
  /** Empties the field after a pick, to pick again (adding lines); keeps the text otherwise. */
  readonly clearOnPick = input(true);

  readonly picked = output<T>();
  /** The user chose the create option; carries the typed text. */
  readonly create = output<string>();

  protected readonly optionTemplate = contentChild<TemplateRef<{ $implicit: T }>>('option');
  private readonly inputRef = viewChild.required<ElementRef<HTMLInputElement>>('input');
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;

  protected readonly listId = `autocomplete-list-${nextId++}`;
  protected readonly text = signal('');
  protected readonly results = signal<T[]>([]);
  protected readonly open = signal(false);
  protected readonly loading = signal(false);
  /** Index of the highlighted option; the create option comes after the results. */
  protected readonly active = signal(-1);

  private readonly queries = new Subject<string>();

  constructor() {
    this.queries
      .pipe(
        debounceTime(AUTOCOMPLETE_DEBOUNCE_MS),
        tap(() => this.loading.set(true)),
        switchMap((text) => this.search()(text.trim()).pipe(catchError(() => of<T[]>([])))),
        takeUntilDestroyed(),
      )
      .subscribe((results) => {
        this.loading.set(false);
        this.results.set(results);
        this.active.set(results.length > 0 ? 0 : this.createLabel() ? 0 : -1);
      });
  }

  /** Moves the keyboard focus to the field. */
  focus(): void {
    this.inputRef().nativeElement.focus();
  }

  protected optionId(index: number): string {
    return `${this.listId}-option-${index}`;
  }

  protected onFocus(): void {
    this.open.set(true);
    this.queries.next(this.text());
  }

  protected onInput(value: string): void {
    this.text.set(value);
    this.open.set(true);
    this.queries.next(value);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.results().length + (this.createLabel() ? 1 : 0);
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!this.open()) {
          this.onFocus();
        } else if (count > 0) {
          this.active.update((index) => (index + 1) % count);
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (count > 0) {
          this.active.update((index) => (index <= 0 ? count - 1 : index - 1));
        }
        break;
      case 'Enter':
        if (this.open() && this.active() >= 0 && this.active() < count) {
          event.preventDefault();
          this.pick(this.active());
        }
        break;
      case 'Escape':
        if (this.open()) {
          event.preventDefault();
          event.stopPropagation();
          this.open.set(false);
        }
        break;
    }
  }

  /** Closes the list when the focus leaves the component (not when it moves inside). */
  protected onFocusOut(event: FocusEvent): void {
    if (!this.host.contains(event.relatedTarget as Node | null)) {
      this.open.set(false);
    }
  }

  protected pick(index: number): void {
    const item = this.results()[index];
    this.open.set(false);
    if (item === undefined) {
      this.create.emit(this.text().trim());
    } else {
      this.picked.emit(item);
    }
    if (this.clearOnPick()) {
      this.text.set('');
    }
  }
}
