import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { catchError, of } from 'rxjs';

import { SiteHeader } from '../../home/site-header/site-header';
import { DocsService } from '../docs.service';

/** Public documentation: the site header, a section navigation and the current page. */
@Component({
  selector: 'app-docs-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, SiteHeader],
  templateUrl: './docs-layout.html',
  styleUrl: './docs-layout.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocsLayout {
  /** Wide screens keep the navigation open beside the page; phones open it on demand and close it after a choice. */
  protected readonly wide = globalThis.matchMedia?.('(min-width: 960px)').matches ?? true;

  protected readonly sections = toSignal(inject(DocsService).sections$.pipe(catchError(() => of(null))), {
    initialValue: undefined,
  });
}
