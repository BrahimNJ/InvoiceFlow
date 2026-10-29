export const API_URL = 'http://localhost:8080';

/** Fails fast with a clear message when the API the build talks to is not running. */
export default async function globalSetup(): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/actuator/health`);
    if (response.ok) {
      return;
    }
  } catch {
    // Not listening: reported below
  }
  throw new Error(
    `The API is not up on ${API_URL}. Start PostgreSQL and the backend first (see docs/testing.md).`,
  );
}
