import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewEncapsulation,
  afterRenderEffect,
  computed,
  inject,
  input,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { DomSanitizer, Meta, SafeHtml, Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { catchError, map, of, startWith, switchMap } from 'rxjs';

import { ThemeService } from '../../core/theme/theme.service';
import { Icon } from '../../shared/icon/icon';
import { DocsPage } from '../docs.models';
import { DocsService } from '../docs.service';
import { renderDiagrams } from './mermaid';

type PageState = { status: 'loading' } | { status: 'ready'; page: DocsPage; html: SafeHtml } | { status: 'missing' };

/** One documentation page: content, table of contents, previous / next, source link. */
@Component({
  selector: 'app-doc-page',
  imports: [Icon, RouterLink],
  templateUrl: './doc-page.html',
  styleUrl: './doc-page.css',
  // The page body is injected HTML: its typography is styled globally under `app-doc-page .prose`.
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(click)': 'followLink($event)' },
})
export class DocPage {
  /** From the route (`/docs/:slug`). */
  readonly slug = input.required<string>();

  private readonly docs = inject(DocsService);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly theme = inject(ThemeService).theme;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly state = toSignal(
    toObservable(this.slug).pipe(
      switchMap((slug) =>
        this.docs.page(slug).pipe(
          // Build-time HTML from the repository's Markdown (see docs/adr/0007): trusted so that the inline colour
          // variables of highlighted code survive. User input never reaches this path.
          map((page): PageState => ({ status: 'ready', page, html: this.sanitizer.bypassSecurityTrustHtml(page.html) })),
          catchError(() => of<PageState>({ status: 'missing' })),
          startWith<PageState>({ status: 'loading' }),
        ),
      ),
    ),
    { initialValue: { status: 'loading' } as PageState },
  );

  protected readonly ready = computed(() => {
    const state = this.state();
    return state.status === 'ready' ? state : null;
  });

  private readonly sections = toSignal(this.docs.sections$.pipe(catchError(() => of([]))), { initialValue: [] });
  private readonly order = computed(() => this.sections().flatMap((s) => s.pages.map((p) => ({ ...p, section: s.title }))));
  private readonly position = computed(() => this.order().findIndex((p) => p.slug === this.slug()));

  protected readonly section = computed(() => this.order()[this.position()]?.section ?? 'Documentation');
  protected readonly previous = computed(() => (this.position() > 0 ? this.order()[this.position() - 1] : null));
  protected readonly next = computed(() => this.order()[this.position() + 1] ?? null);

  constructor() {
    afterRenderEffect(() => {
      const state = this.state();
      if (state.status !== 'ready') return;
      this.title.setTitle(`${state.page.title} · Docs · InvoiceFlow`);
      this.meta.updateTag({ name: 'description', content: state.page.description });
      if (state.page.hasDiagram) {
        void renderDiagrams(this.host.nativeElement, this.theme());
      }
    });
  }

  /**
   * Links inside the injected HTML are plain anchors: keep in-app pages in the router (no reload) and scroll to
   * same-page anchors, which would otherwise resolve against <base href="/"> and leave the page.
   */
  protected followLink(event: MouseEvent): void {
    const anchor = (event.target as Element | null)?.closest?.('.prose a, .toc a');
    if (!(anchor instanceof HTMLAnchorElement) || anchor.target === '_blank') return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const href = anchor.getAttribute('href') ?? '';
    if (href.startsWith('#')) {
      event.preventDefault();
      void this.router.navigate([], { fragment: href.slice(1), replaceUrl: true });
      this.host.nativeElement.ownerDocument.getElementById(href.slice(1))?.scrollIntoView({ behavior: 'smooth' });
    } else if (href.startsWith('/docs/')) {
      event.preventDefault();
      void this.router.navigateByUrl(href);
    }
  }
}
