import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { Observable, firstValueFrom, of } from 'rxjs';

import { authGuard, guestGuard, safeReturnUrl } from './auth.guards';
import { AuthService } from './auth.service';

describe('auth guards', () => {
  const signedIn = signal(false);

  beforeEach(() => {
    signedIn.set(false);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { restoreSession: () => of(signedIn()), isAuthenticated: signedIn.asReadonly() },
        },
      ],
    });
  });

  function run(guard: typeof authGuard, url = '/dashboard'): Promise<boolean | UrlTree> {
    const result = TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    );
    return firstValueFrom(result as Observable<boolean | UrlTree>);
  }

  function serialize(tree: boolean | UrlTree): string {
    return TestBed.inject(Router).serializeUrl(tree as UrlTree);
  }

  describe('authGuard', () => {
    it('lets a signed-in user through', async () => {
      signedIn.set(true);

      expect(await run(authGuard)).toBe(true);
    });

    it('sends a visitor to the sign-in page with the requested URL', async () => {
      expect(serialize(await run(authGuard, '/dashboard?tab=2'))).toBe(
        '/login?returnUrl=%2Fdashboard%3Ftab%3D2',
      );
    });
  });

  describe('guestGuard', () => {
    it('lets a visitor see the sign-in page', async () => {
      expect(await run(guestGuard)).toBe(true);
    });

    it('sends a signed-in user to the dashboard', async () => {
      signedIn.set(true);

      expect(serialize(await run(guestGuard))).toBe('/dashboard');
    });
  });

  describe('safeReturnUrl', () => {
    it('keeps same-site paths', () => {
      expect(safeReturnUrl('/invoices?status=paid')).toBe('/invoices?status=paid');
    });

    it.each([null, undefined, '', 'https://evil.example.com', '//evil.example.com', '/\\evil.example.com', 'javascript:alert(1)'])(
      'falls back to the dashboard for %s',
      (url) => {
        expect(safeReturnUrl(url)).toBe('/dashboard');
      },
    );
  });
});
