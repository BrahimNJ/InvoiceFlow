import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';

import { ConfirmService } from '../../shared/ui/confirm.service';

/** A screen that can hold changes not saved yet. */
export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/** Asks before leaving a screen with unsaved changes (closing the tab is handled by the screen itself). */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) =>
  !component.hasUnsavedChanges() ||
  inject(ConfirmService).ask({
    title: 'Leave without saving?',
    message: 'Your changes to this draft will be lost.',
    confirmLabel: 'Leave',
    tone: 'danger',
  });
