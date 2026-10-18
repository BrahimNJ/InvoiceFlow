// Test data shared by the specs. Obviously fake values only.
import { AuthResponse, User } from './auth.models';

export const TEST_USER: User = {
  id: 1,
  email: 'jane@acme.fr',
  firstName: 'Jane',
  lastName: 'Doe',
  role: 'USER',
  createdAt: '2026-10-18T10:00:00Z',
};

export function authResponse(accessToken = 'access-1'): AuthResponse {
  return { accessToken, tokenType: 'Bearer', expiresIn: 900, user: TEST_USER };
}
