import { FormControl, FormGroup } from '@angular/forms';

import {
  bicValid,
  emailValid,
  ibanValid,
  luhnValid,
  siretValid,
  siretValidator,
  vatNumberValid,
  vatNumberValidator,
} from './company-validation';

describe('company validation', () => {
  it('checks the Luhn checksum', () => {
    expect(luhnValid('79927398713')).toBe(true);
    expect(luhnValid('79927398710')).toBe(false);
  });

  it('accepts a SIRET of 14 digits with a valid checksum only', () => {
    expect(siretValid('73282932000074')).toBe(true);
    expect(siretValid('73282932000075')).toBe(false);
    expect(siretValid('7328293200007')).toBe(false);
    expect(siretValid('7328293200007a')).toBe(false);
  });

  it('checks a French VAT number against the SIREN and its key', () => {
    expect(vatNumberValid('FR44732829320', '73282932000074')).toBe(true);
    expect(vatNumberValid('fr 44 732 829 320', '73282932000074')).toBe(true);
    expect(vatNumberValid('FR45732829320', '73282932000074')).toBe(false);
    expect(vatNumberValid('FR44732829320', '12345678900010')).toBe(false);
    expect(vatNumberValid('FR44732829320', '')).toBe(true);
    expect(vatNumberValid('FR4473282932', '')).toBe(false);
    expect(vatNumberValid('FRAB732829320', '')).toBe(true);
  });

  it('only checks the format of a foreign VAT number', () => {
    expect(vatNumberValid('DE123456789', '73282932000074')).toBe(true);
    expect(vatNumberValid('1234', '')).toBe(false);
  });

  it('checks an IBAN with spaces allowed', () => {
    expect(ibanValid('FR7630006000011234567890189')).toBe(true);
    expect(ibanValid('FR76 3000 6000 0112 3456 7890 189')).toBe(true);
    expect(ibanValid('FR7630006000011234567890188')).toBe(false);
    expect(ibanValid('nope')).toBe(false);
  });

  it('checks a BIC of 8 or 11 characters', () => {
    expect(bicValid('AGRIFRPP')).toBe(true);
    expect(bicValid('AGRIFRPP123')).toBe(true);
    expect(bicValid('AGRIFRP')).toBe(false);
  });

  it('checks the shape of an email', () => {
    expect(emailValid('a@b.fr')).toBe(true);
    expect(emailValid('a@b')).toBe(false);
  });

  it('validators let an empty value through', () => {
    expect(siretValidator(new FormControl(''))).toBeNull();
    expect(siretValidator(new FormControl('123'))).toEqual({ siret: true });
  });

  it('the VAT validator reads the SIRET of the same form', () => {
    const form = new FormGroup({ siret: new FormControl('12345678900010'), vat: new FormControl('FR44732829320') });
    expect(vatNumberValidator(form.controls.vat)).toEqual({ vat: true });
    form.controls.siret.setValue('73282932000074');
    expect(vatNumberValidator(form.controls.vat)).toBeNull();
    expect(vatNumberValidator(new FormControl('FR44732829320'))).toBeNull();
  });
});
