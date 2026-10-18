import { AbstractControl, FormGroup } from '@angular/forms';

/** An error is shown once the user has left the field (or tried to submit), not while typing the first characters. */
export function showError(control: AbstractControl): boolean {
  return control.invalid && control.touched;
}

/** After a rejected submit, moves the keyboard focus to the first field to fix (WCAG 3.3.1). */
export function focusFirstInvalid(form: FormGroup, host: HTMLElement): void {
  const name = Object.keys(form.controls).find((key) => form.controls[key].invalid);
  if (name) {
    host.querySelector<HTMLElement>(`[formcontrolname="${name}"]`)?.focus();
  }
}
