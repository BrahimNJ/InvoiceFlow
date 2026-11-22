// Client-side copies of the backend rules (company package), so that mistakes show before the request.
// The backend stays the reference and checks everything again.
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

const compact = (text: string) => text.replace(/\s/g, '');

/** Luhn checksum of a string of digits. */
export function luhnValid(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let digit = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

/** SIREN of La Poste: its establishments do not follow Luhn, the sum of their SIRET digits is a multiple of 5. */
const LA_POSTE_SIREN = '356000000';

/** 14 digits and a valid checksum (Luhn, or the La Poste rule). */
export function siretValid(siret: string): boolean {
  if (!/^\d{14}$/.test(siret)) {
    return false;
  }
  const digitSum = [...siret].reduce((sum, digit) => sum + Number(digit), 0);
  return luhnValid(siret) || (siret.startsWith(LA_POSTE_SIREN) && digitSum % 5 === 0);
}

/** `FR44732829320`: a French number carries the SIREN and a key computed from it; other countries: format only. */
export function vatNumberValid(vat: string, siret: string): boolean {
  // Spaces, dots and dashes are ignored, like the backend does
  const value = vat.replace(/[\s.-]/g, '').toUpperCase();
  if (!/^[A-Z]{2}[A-Z0-9]{2,12}$/.test(value)) {
    return false;
  }
  if (!value.startsWith('FR')) {
    return true;
  }
  const match = /^FR([0-9A-Z]{2})(\d{9})$/.exec(value);
  if (!match) {
    return false;
  }
  const [, key, siren] = match;
  if (/^\d{14}$/.test(siret) && siret.slice(0, 9) !== siren) {
    return false;
  }
  return !/^\d{2}$/.test(key) || Number(key) === (12 + 3 * (Number(siren) % 97)) % 97;
}

/** Mod-97 checksum of an IBAN (spaces allowed). */
export function ibanValid(iban: string): boolean {
  const value = compact(iban).toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(value)) {
    return false;
  }
  const rearranged = value.slice(4) + value.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const digits = String(parseInt(char, 36));
    for (const digit of digits) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }
  return remainder === 1;
}

export const bicValid = (bic: string): boolean => /^[A-Za-z0-9]{8}([A-Za-z0-9]{3})?$/.test(compact(bic));

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const emailValid = (email: string): boolean => EMAIL.test(email);

/** An empty value passes (left to `required` or to the field being optional). */
function check(error: string, isValid: (value: string, control: AbstractControl<string>) => boolean): ValidatorFn {
  return (control): ValidationErrors | null => {
    const value = (control.value as string).trim();
    return value === '' || isValid(value, control as AbstractControl<string>) ? null : { [error]: true };
  };
}

export const siretValidator = check('siret', (value) => siretValid(compact(value)));
export const ibanValidator = check('iban', ibanValid);
export const bicValidator = check('bic', bicValid);
export const emailValidator = check('email', emailValid);
export const vatNumberValidator = check('vat', (value, control) =>
  vatNumberValid(value, compact((control.parent?.get('siret')?.value as string | undefined) ?? '')),
);
