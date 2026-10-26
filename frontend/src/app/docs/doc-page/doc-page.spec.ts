import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';

import { SECTIONS, docsPage } from '../docs.fixtures';
import { DocPage } from './doc-page';

describe('DocPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [DocPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function render(slug = 'security') {
    const fixture = TestBed.createComponent(DocPage);
    fixture.componentRef.setInput('slug', slug);
    await fixture.whenStable();
    http.expectOne('/docs/index.json').flush(SECTIONS);
    return { fixture, page: fixture.nativeElement as HTMLElement };
  }

  it('renders the page body, its section, the table of contents and the source link', async () => {
    const { fixture, page } = await render();
    http.expectOne('/docs/security.json').flush(docsPage());
    await fixture.whenStable();

    expect(page.querySelector('.prose h1')?.textContent).toBe('Security');
    expect(page.querySelector('.eyebrow')?.textContent).toBe('Security');
    expect([...page.querySelectorAll('.toc a')].map((a) => a.getAttribute('href'))).toEqual(['#threat-model', '#known-limits']);
    expect(page.querySelector('.source')?.getAttribute('href')).toContain('docs/security.md');
    expect(TestBed.inject(Title).getTitle()).toBe('Security · Docs · InvoiceFlow');
  });

  it('links the previous and next pages in navigation order', async () => {
    const { fixture, page } = await render();
    http.expectOne('/docs/security.json').flush(docsPage());
    await fixture.whenStable();

    expect(page.querySelector('.pager .prev')?.getAttribute('href')).toBe('/docs/overview');
    expect(page.querySelector('.pager .next')?.getAttribute('href')).toBe('/docs/authentication');
  });

  it('keeps in-app links in the router instead of reloading the page', async () => {
    const navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const { fixture, page } = await render();
    http.expectOne('/docs/security.json').flush(docsPage());
    await fixture.whenStable();

    const link = page.querySelector<HTMLAnchorElement>('.prose a[href="/docs/authentication"]')!;
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    link.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(navigateByUrl).toHaveBeenCalledWith('/docs/authentication');
  });

  it('scrolls to same-page anchors instead of resolving them against the base href', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const { fixture, page } = await render();
    http.expectOne('/docs/security.json').flush(docsPage());
    await fixture.whenStable();
    const target = page.querySelector<HTMLElement>('#known-limits')!;
    target.scrollIntoView = vi.fn();

    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    page.querySelector('.prose a[href="#known-limits"]')!.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(target.scrollIntoView).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith([], { fragment: 'known-limits', replaceUrl: true });
  });

  it('says so when the page does not exist', async () => {
    const { fixture, page } = await render('nope');
    http.expectOne('/docs/nope.json').flush(null, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();

    expect(page.querySelector('[role="alert"] h1')?.textContent).toBe('Page not found');
  });
});
