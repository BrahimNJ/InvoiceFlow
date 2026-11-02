import { statusBadge } from './invoice.models';

describe('statusBadge', () => {
  it('labels each status', () => {
    expect(statusBadge('DRAFT', false).label).toBe('Draft');
    expect(statusBadge('ISSUED', false).label).toBe('Issued');
    expect(statusBadge('PAID', false)).toEqual({ label: 'Paid', tone: 'success', icon: 'check-circle' });
    expect(statusBadge('CANCELLED', false).tone).toBe('muted');
  });

  it('shows an issued invoice past due as overdue, never a paid one', () => {
    expect(statusBadge('ISSUED', true)).toEqual({ label: 'Overdue', tone: 'danger', icon: 'alert' });
    expect(statusBadge('PAID', true).label).toBe('Paid');
  });
});
