// Mirrors the backend DTOs of com.naji.backend.auth and com.naji.backend.user.

export type Role = 'USER' | 'ADMIN';

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  createdAt: string;
}

/** The refresh token is not here: it travels in an HttpOnly cookie that JavaScript cannot read. */
export interface AuthResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: User;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload extends LoginPayload {
  firstName: string;
  lastName: string;
}
