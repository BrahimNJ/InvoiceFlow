import { FormControl, FormGroup } from '@angular/forms';

import {
  checkPassword,
  matchingPasswordsValidator,
  passwordPolicyValidator,
  passwordStrength,
} from './password.validators';

describe('password validators', () => {
  describe('passwordPolicyValidator (same rules as the backend)', () => {
    it.each(['Correct-horse-42', 'Abcdefghijk1', 'Pässwörd-Çafé-2026'])('accepts %s', (password) => {
      expect(passwordPolicyValidator(new FormControl(password))).toBeNull();
    });

    it.each([
      ['Short-1A', 'length'],
      ['alllowercase-123', 'uppercase'],
      ['ALLUPPERCASE-123', 'lowercase'],
      ['No-digits-at-all', 'digit'],
    ])('rejects %s (missing %s)', (password, failed) => {
      const errors = passwordPolicyValidator(new FormControl(password));

      expect(errors?.['passwordPolicy'][failed]).toBe(false);
    });

    it('rejects passwords longer than 72 bytes in UTF-8', () => {
      // 25 x "é" = 50 bytes, plus 24 ASCII characters = 74 bytes, but only 49 characters
      const errors = passwordPolicyValidator(new FormControl('é'.repeat(25) + 'Abc1'.repeat(6)));

      expect(errors?.['passwordPolicy'].maxBytes).toBe(false);
    });

    it('leaves empty values to Validators.required', () => {
      expect(passwordPolicyValidator(new FormControl(''))).toBeNull();
    });
  });

  describe('matchingPasswordsValidator', () => {
    const group = (password: string, confirm: string) =>
      new FormGroup(
        { password: new FormControl(password), confirm: new FormControl(confirm) },
        { validators: matchingPasswordsValidator('password', 'confirm') },
      );

    it('flags different passwords', () => {
      expect(group('Correct-horse-42', 'Correct-horse-43').errors).toEqual({ passwordMismatch: true });
    });

    it('accepts identical passwords and waits for the confirmation', () => {
      expect(group('Correct-horse-42', 'Correct-horse-42').errors).toBeNull();
      expect(group('Correct-horse-42', '').errors).toBeNull();
    });
  });

  describe('passwordStrength', () => {
    it.each([
      ['', 'empty'],
      ['abc', 'weak'],
      ['abcdefghijkl1', 'fair'],
      ['Correcthorse42', 'good'],
      ['Correct-horse-battery-42', 'strong'],
    ] as const)('rates "%s" as %s', (password, expected) => {
      expect(passwordStrength(password)).toBe(expected);
    });
  });

  it('checkPassword reports each rule', () => {
    expect(checkPassword('abc')).toEqual({
      length: false,
      lowercase: true,
      uppercase: false,
      digit: false,
      maxBytes: true,
    });
  });
});
