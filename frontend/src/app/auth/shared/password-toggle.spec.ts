import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { PasswordToggle } from './password-toggle';

@Component({
  imports: [PasswordToggle],
  template: `<input #pwd id="pwd" type="password" /><app-password-toggle [input]="pwd" />`,
})
class Host {}

describe('PasswordToggle', () => {
  it('shows and hides the password with an accessible label', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector('input')!;
    const button = element.querySelector('button')!;

    expect(button.getAttribute('aria-label')).toBe('Show password');
    expect(button.getAttribute('aria-controls')).toBe('pwd');

    button.click();
    await fixture.whenStable();
    expect(input.type).toBe('text');
    expect(button.getAttribute('aria-label')).toBe('Hide password');
    expect(button.getAttribute('aria-pressed')).toBe('true');

    button.click();
    await fixture.whenStable();
    expect(input.type).toBe('password');
  });
});
