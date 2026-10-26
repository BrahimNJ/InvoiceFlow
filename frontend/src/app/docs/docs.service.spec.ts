import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { SECTIONS, docsPage } from './docs.fixtures';
import { DocsService } from './docs.service';

describe('DocsService', () => {
  let service: DocsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(DocsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the navigation once and shares it', () => {
    const received: unknown[] = [];
    service.sections$.subscribe((s) => received.push(s));
    http.expectOne('/docs/index.json').flush(SECTIONS);

    service.sections$.subscribe((s) => received.push(s));
    http.expectNone('/docs/index.json');

    expect(received).toEqual([SECTIONS, SECTIONS]);
  });

  it('loads a page by slug from the generated files', () => {
    let title = '';
    service.page('security').subscribe((page) => (title = page.title));
    http.expectOne('/docs/security.json').flush(docsPage());

    expect(title).toBe('Security');
  });

  it('encodes the slug so a crafted route cannot leave the docs folder', () => {
    service.page('../index').subscribe({ error: () => undefined });

    http.expectOne('/docs/..%2Findex.json').flush(null, { status: 404, statusText: 'Not Found' });
  });
});
