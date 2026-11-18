import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';

import { AuthService } from './auth.service';

export const HOME_AFTER_SIGN_IN = '/dashboard';

/** Signed-in users only; others go to /login and come back afterwards. Waits for the session restore. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth
    .restoreSession()
    .pipe(
      map(() => auth.isAuthenticated() || router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } })),
    );
};

/**
 * Admin area: an admin goes through, a signed-in user goes to the dashboard, a visitor signs in first.
 * Hides screens only; the API refuses every admin call to a non-admin anyway.
 */
export const adminGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.restoreSession().pipe(
    map(() => {
      if (!auth.isAuthenticated()) {
        return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
      }
      return auth.isAdmin() || router.createUrlTree([HOME_AFTER_SIGN_IN]);
    }),
  );
};

/** Sign-in and sign-up pages: a signed-in user goes straight to the app. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth
    .restoreSession()
    .pipe(map(() => (auth.isAuthenticated() ? router.createUrlTree([HOME_AFTER_SIGN_IN]) : true)));
};

/**
 * Only same-site paths are accepted after sign-in: "/invoices" yes, "https://evil.example" or
 * "//evil.example" (protocol-relative) no. Prevents an open redirect through ?returnUrl=.
 */
export function safeReturnUrl(url: string | null | undefined): string {
  if (!url || !url.startsWith('/') || url.startsWith('//') || url.startsWith('/\\')) {
    return HOME_AFTER_SIGN_IN;
  }
  return url;
}
