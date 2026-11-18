// Mirrors the backend DTOs of com.naji.backend.admin (ADR 0010): accounts and counts, never business data.
import { Role } from '../core/auth/auth.models';

export interface AdminUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  /** ISO instant; null while the account is active. */
  suspendedAt: string | null;
  createdAt: string;
}

export interface AdminUserQuery {
  search?: string;
  page?: number;
  size?: number;
}

export interface PlatformStats {
  users: number;
  admins: number;
  suspendedUsers: number;
  newUsersLast30Days: number;
  customers: number;
  invoicesIssued: number;
}

export type AdminActionType =
  | 'ROLE_CHANGED'
  | 'ACCOUNT_SUSPENDED'
  | 'ACCOUNT_REACTIVATED'
  | 'PROMOTED_AT_STARTUP';

export interface AdminAction {
  id: number;
  action: AdminActionType;
  /** Null for the promotion from ADMIN_EMAILS at startup. */
  adminId: number | null;
  adminEmail: string | null;
  targetUserId: number;
  targetEmail: string;
  details: string | null;
  createdAt: string;
}
