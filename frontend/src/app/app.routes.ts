import { Routes } from '@angular/router';

import { authGuard, guestGuard } from './core/auth/auth.guards';

export const routes: Routes = [
  {
    path: '',
    title: 'InvoiceFlow · Invoicing for the French e-invoicing reform',
    loadComponent: () => import('./home/home').then((m) => m.Home),
  },
  {
    path: 'login',
    title: 'Sign in · InvoiceFlow',
    canActivate: [guestGuard],
    loadComponent: () => import('./auth/login/login').then((m) => m.Login),
  },
  {
    path: 'register',
    title: 'Create your account · InvoiceFlow',
    canActivate: [guestGuard],
    loadComponent: () => import('./auth/register/register').then((m) => m.Register),
  },
  {
    path: 'dashboard',
    title: 'Dashboard · InvoiceFlow',
    canActivate: [authGuard],
    loadComponent: () => import('./dashboard/dashboard').then((m) => m.Dashboard),
  },
  {
    path: 'customers',
    title: 'Customers · InvoiceFlow',
    canActivate: [authGuard],
    loadComponent: () => import('./customers/customer-list/customer-list').then((m) => m.CustomerList),
  },
  { path: '**', redirectTo: '' },
];
