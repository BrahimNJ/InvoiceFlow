import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// Mirrors the backend @StrongPassword constraint (StrongPasswordValidator.java). Keep both in sync.
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_BYTES = 72;

export interface PasswordChecks {
  length: boolean;
  lowercase: boolean;
  uppercase: boolean;
  digit: boolean;
  /** BCrypt only reads 72 bytes; multi-byte characters count more than one. */
  maxBytes: boolean;
}

export function checkPassword(password: string): PasswordChecks {
  return {
    length: password.length >= PASSWORD_MIN_LENGTH,
    lowercase: /\p{Ll}/u.test(password),
    uppercase: /\p{Lu}/u.test(password),
    digit: /\p{Nd}/u.test(password),
    maxBytes: new TextEncoder().encode(password).length <= PASSWORD_MAX_BYTES,
  };
}

/** Error key {@code passwordPolicy}, with the failed checks, so the template can say what is missing. */
export const passwordPolicyValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value: unknown = control.value;
  if (typeof value !== 'string' || value === '') {
    return null; // Validators.required reports empty values
  }
  const checks = checkPassword(value);
  return Object.values(checks).every(Boolean) ? null : { passwordPolicy: checks };
};

/** Group validator: error {@code passwordMismatch} on the group when the two fields differ. */
export function matchingPasswordsValidator(passwordKey: string, confirmKey: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const confirm: unknown = group.get(confirmKey)?.value;
    if (!confirm) {
      return null;
    }
    return group.get(passwordKey)?.value === confirm ? null : { passwordMismatch: true };
  };
}

export type PasswordStrength = 'empty' | 'weak' | 'fair' | 'good' | 'strong';

/** Indicative only: the policy above decides what is accepted. Length and variety raise the score. */
export function passwordStrength(password: string): PasswordStrength {
  if (!password) {
    return 'empty';
  }
  const checks = checkPassword(password);
  const policyMet = checks.length && checks.lowercase && checks.uppercase && checks.digit && checks.maxBytes;
  if (!policyMet) {
    const met = [checks.length, checks.lowercase, checks.uppercase, checks.digit].filter(Boolean).length;
    return met <= 2 ? 'weak' : 'fair';
  }
  const hasSymbol = /[^\p{L}\p{Nd}]/u.test(password);
  return password.length >= 16 && hasSymbol ? 'strong' : 'good';
}
