// Test data shared by the specs. Obviously fake values only.
import { Page } from '../core/http/page';
import { AdminAction, AdminUser, PlatformStats } from './admin.models';

export function testAdminUser(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id: 2,
    email: 'jane@acme.fr',
    firstName: 'Jane',
    lastName: 'Doe',
    role: 'USER',
    suspendedAt: null,
    createdAt: '2026-11-01T09:00:00Z',
    ...overrides,
  };
}

export function testStats(overrides: Partial<PlatformStats> = {}): PlatformStats {
  return {
    users: 12,
    admins: 2,
    suspendedUsers: 1,
    newUsersLast30Days: 4,
    customers: 30,
    invoicesIssued: 57,
    ...overrides,
  };
}

export function testAdminAction(overrides: Partial<AdminAction> = {}): AdminAction {
  return {
    id: 5,
    action: 'ACCOUNT_SUSPENDED',
    adminId: 1,
    adminEmail: 'admin@acme.fr',
    targetUserId: 2,
    targetEmail: 'jane@acme.fr',
    details: null,
    createdAt: '2026-11-18T10:00:00Z',
    ...overrides,
  };
}

export function pageOf<T>(content: T[], page = 0, totalElements = content.length, size = 20): Page<T> {
  return { content, page, size, totalElements, totalPages: Math.ceil(totalElements / size) };
}
