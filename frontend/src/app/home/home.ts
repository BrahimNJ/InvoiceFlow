import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';

import { ApiStatusService } from '../core/api-status.service';
import { AiAssistant } from './ai-assistant/ai-assistant';
import { Engineering } from './engineering/engineering';
import { Features } from './features/features';
import { Hero } from './hero/hero';
import { Reform } from './reform/reform';
import { SiteFooter } from './site-footer/site-footer';
import { SiteHeader } from './site-header/site-header';

@Component({
  selector: 'app-home',
  imports: [SiteHeader, Hero, Features, Reform, Engineering, AiAssistant, SiteFooter],
  template: `
    <a class="skip-link" href="#main">Skip to content</a>
    <app-site-header />
    <main id="main">
      <app-hero />
      <app-features />
      <app-reform />
      <app-engineering />
      <app-ai-assistant />
    </main>
    <app-site-footer />
  `,
  styles: `
    .skip-link { position: absolute; left: 1rem; top: -4rem; z-index: 20; padding: .6rem 1rem;
                 border-radius: var(--radius); background: var(--brand); color: var(--on-brand); font-weight: 600; }
    .skip-link:focus { top: 1rem; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home implements OnInit {
  private readonly apiStatus = inject(ApiStatusService);

  ngOnInit(): void {
    this.apiStatus.check();
  }
}
