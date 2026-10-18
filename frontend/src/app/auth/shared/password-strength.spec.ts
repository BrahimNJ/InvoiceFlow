import { TestBed } from '@angular/core/testing';

import { PasswordStrength } from './password-strength';

describe('PasswordStrength', () => {
  async function render(password: string): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(PasswordStrength);
    fixture.componentRef.setInput('password', password);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('lists every rule as missing for an empty password', async () => {
    const element = await render('');

    expect(element.querySelectorAll('li').length).toBe(4);
    expect(element.querySelectorAll('li.met').length).toBe(0);
    expect(element.querySelector('.label')).toBeNull();
  });

  it('marks the rules already met and rates the password', async () => {
    const element = await render('abcdefghijkl');

    const met = Array.from(element.querySelectorAll('li.met')).map((li) => li.textContent);
    expect(met.join()).toContain('12+ characters');
    expect(met.join()).toContain('One lowercase letter');
    expect(element.querySelector('.label')?.textContent).toContain('Weak');
  });

  it('shows a full meter for a strong password', async () => {
    const element = await render('Correct-horse-battery-42');

    expect(element.querySelectorAll('.meter .on').length).toBe(4);
    expect(element.querySelector('.label')?.textContent).toContain('Strong');
  });

  it('mentions the byte limit only when it is exceeded', async () => {
    const element = await render('é'.repeat(25) + 'Abc1'.repeat(6));

    expect(element.textContent).toContain('At most 72 bytes');
  });
});
