import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

import { ConfirmService } from '../../shared/ui/confirm.service';
import { HasUnsavedChanges, unsavedChangesGuard } from './unsaved-changes.guard';

describe('unsavedChangesGuard', () => {
  const run = (component: HasUnsavedChanges) =>
    TestBed.runInInjectionContext(() =>
      unsavedChangesGuard(component, {} as ActivatedRouteSnapshot, {} as RouterStateSnapshot, {} as RouterStateSnapshot),
    );

  it('lets the user leave when everything is saved', () => {
    const ask = vi.spyOn(TestBed.inject(ConfirmService), 'ask');

    expect(run({ hasUnsavedChanges: () => false })).toBe(true);
    expect(ask).not.toHaveBeenCalled();
  });

  it('asks before losing changes', async () => {
    const ask = vi.spyOn(TestBed.inject(ConfirmService), 'ask').mockResolvedValue(false);

    await expect(run({ hasUnsavedChanges: () => true })).resolves.toBe(false);
    expect(ask).toHaveBeenCalledWith(expect.objectContaining({ title: 'Leave without saving?', confirmLabel: 'Leave' }));
  });
});
