import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ConfirmDialog } from './shared/ui/confirm-dialog';
import { Toasts } from './shared/ui/toasts';

@Component({
  selector: 'app-root',
  imports: [ConfirmDialog, RouterOutlet, Toasts],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {}
