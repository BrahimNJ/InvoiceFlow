import { AbstractControl, FormGroup } from '@angular/forms';

import { fieldErrors } from '../../core/http/problem-detail';

/** An error is shown once the user has left the field (or tried to submit), not while typing the first characters. */
export function showError(control: AbstractControl): boolean {
  return control.invalid && control.touched;
}

/**
 * After a rejected submit, moves the keyboard focus to the first field to fix (WCAG 3.3.1).
 * `fallback` is focused when only a group validator failed (e.g. passwords that do not match).
 */
export function focusFirstInvalid(form: FormGroup, host: HTMLElement, fallback?: string): void {
  const name = Object.keys(form.controls).find((key) => form.controls[key].invalid) ?? fallback;
  if (name) {
    // A bound [formControlName] renders no attribute: such inputs are found by their name attribute
    host.querySelector<HTMLElement>(`[formcontrolname="${name}"], [name="${name}"]`)?.focus();
  }
}

/**
 * Shows the backend validation messages (400 ProblemDetail errors) on the matching fields.
 * The `server` error is cleared as soon as the user edits the field (validators run again).
 */
export function applyServerErrors(form: FormGroup, error: unknown): void {
  for (const [name, message] of Object.entries(fieldErrors(error))) {
    const control = form.get(name);
    control?.setErrors({ ...control.errors, server: message });
    control?.markAsTouched();
  }
}
