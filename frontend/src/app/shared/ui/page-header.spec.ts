import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { EmptyState } from './empty-state';
import { PageHeader } from './page-header';

@Component({
  imports: [EmptyState, PageHeader],
  template: `
    <app-page-header icon="package" heading="Products" subtitle="Your catalogue" backLink="/dashboard" backLabel="Dashboard">
      <a class="btn" href="/products/new">New product</a>
    </app-page-header>
    <app-empty-state icon="package" heading="No products yet" text="Add your first product.">
      <button type="button">Create</button>
    </app-empty-state>
  `,
})
class Host {}

describe('PageHeader and EmptyState', () => {
  it('render the title, explanation, back link and projected actions', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;

    const header = page.querySelector('app-page-header')!;
    expect(header.querySelector('h1')?.textContent).toBe('Products');
    expect(header.querySelector('.subtitle')?.textContent).toBe('Your catalogue');
    expect(header.querySelector('.back')?.getAttribute('href')).toBe('/dashboard');
    expect(header.querySelector('.back')?.textContent).toContain('Dashboard');
    expect(header.querySelector('.actions a')?.textContent).toBe('New product');

    const empty = page.querySelector('app-empty-state')!;
    expect(empty.querySelector('h2')?.textContent).toBe('No products yet');
    expect(empty.querySelector('p')?.textContent).toBe('Add your first product.');
    expect(empty.querySelector('.actions button')).toBeTruthy();
  });
});
