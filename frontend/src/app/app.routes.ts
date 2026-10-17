import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'InvoiceFlow · Invoicing for the French e-invoicing reform',
    loadComponent: () => import('./home/home').then((m) => m.Home),
  },
  { path: '**', redirectTo: '' },
];
