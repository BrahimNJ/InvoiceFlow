import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { safeReturnUrl } from '../../core/auth/auth.guards';
import { AuthService } from '../../core/auth/auth.service';
import { errorMessage } from '../../core/http/problem-detail';
import { applyServerErrors, focusFirstInvalid, showError } from '../../shared/forms/forms';
import { SubmitButton } from '../../shared/forms/submit-button';
import { Icon } from '../../shared/icon/icon';
import { AuthLayout } from '../shared/auth-layout';
import { PasswordStrength } from '../shared/password-strength';
import { PasswordToggle } from '../shared/password-toggle';
import { matchingPasswordsValidator, passwordPolicyValidator } from '../shared/password.validators';

const REQUIRED_MESSAGES = {
  firstName: 'Enter your first name.',
  lastName: 'Enter your last name.',
  email: 'Enter your email.',
  password: 'Choose a password.',
  confirmPassword: 'Confirm your password.',
} as const;

type Field = keyof typeof REQUIRED_MESSAGES;

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, AuthLayout, Icon, PasswordStrength, PasswordToggle, SubmitButton],
  templateUrl: './register.html',
  styleUrl: '../shared/auth-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Register {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  private readonly destroyRef = inject(DestroyRef);

  /** From ?returnUrl= (router input binding); only same-site paths are followed. */
  readonly returnUrl = input<string>();

  // Limits match the backend RegisterRequest
  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      firstName: ['', [Validators.required, Validators.maxLength(100)]],
      lastName: ['', [Validators.required, Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
      password: ['', [Validators.required, passwordPolicyValidator]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: matchingPasswordsValidator('password', 'confirmPassword') },
  );
  protected readonly password = toSignal(this.form.controls.password.valueChanges, { initialValue: '' });
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly showError = showError;

  /** The message to show under a field, or null. */
  protected message(field: Field): string | null {
    const control = this.form.controls[field];
    if (field === 'confirmPassword' && control.valid && control.touched && this.form.hasError('passwordMismatch')) {
      return 'Passwords do not match.';
    }
    if (!showError(control)) {
      return null;
    }
    if (control.hasError('server')) {
      return control.getError('server') as string;
    }
    if (control.hasError('required')) {
      return REQUIRED_MESSAGES[field];
    }
    if (control.hasError('email')) {
      return 'Enter a valid email address.';
    }
    if (control.hasError('maxlength')) {
      return 'This is too long.';
    }
    if (control.hasError('passwordPolicy')) {
      return 'Your password does not meet all the requirements below.';
    }
    return null;
  }

  protected submit(): void {
    if (this.submitting()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      focusFirstInvalid(this.form, this.host, 'confirmPassword');
      return;
    }

    const { firstName, lastName, email, password } = this.form.getRawValue();
    this.submitting.set(true);
    this.error.set(null);
    this.auth
      .register({ firstName, lastName, email, password })
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => void this.router.navigateByUrl(safeReturnUrl(this.returnUrl())),
        error: (error: unknown) => this.handleError(error),
      });
  }

  private handleError(error: unknown): void {
    this.error.set(errorMessage(error));
    if (error instanceof HttpErrorResponse && error.status === 409) {
      // Email already registered: point at the field to change
      this.form.controls.email.setErrors({ server: 'This email is already used by an account.' });
      this.form.controls.email.markAsTouched();
    }
    applyServerErrors(this.form, error);
    focusFirstInvalid(this.form, this.host);
  }
}
