import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SECTIONS } from '../docs.fixtures';
import { DocsLayout } from './docs-layout';

describe('DocsLayout', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [DocsLayout],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists every section and page of the documentation', async () => {
    const fixture = TestBed.createComponent(DocsLayout);
    await fixture.whenStable();
    http.expectOne('/docs/index.json').flush(SECTIONS);
    await fixture.whenStable();
    const nav = (fixture.nativeElement as HTMLElement).querySelector('nav[aria-label="Documentation"]')!;

    expect([...nav.querySelectorAll('.nav-section')].map((s) => s.textContent)).toEqual(['Start here', 'Security']);
    expect([...nav.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual([
      '/docs/overview',
      '/docs/security',
      '/docs/authentication',
    ]);
  });

  it('reports an index that cannot be loaded', async () => {
    const fixture = TestBed.createComponent(DocsLayout);
    await fixture.whenStable();
    http.expectOne('/docs/index.json').flush(null, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')?.textContent).toContain('could not be loaded');
  });
});
