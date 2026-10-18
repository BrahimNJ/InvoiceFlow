import { HttpErrorResponse } from '@angular/common/http';

/** RFC 9457 error body returned by the backend (GlobalExceptionHandler). */
export interface ProblemDetail {
  status?: number;
  title?: string;
  detail?: string;
  /** Field name to message, for 400 validation errors. */
  errors?: Record<string, string>;
}

const GENERIC_MESSAGE = 'Something went wrong. Please try again.';
const OFFLINE_MESSAGE = 'Cannot reach the server. Check your connection and try again.';

function problemOf(error: unknown): ProblemDetail | null {
  if (!(error instanceof HttpErrorResponse) || typeof error.error !== 'object' || error.error === null) {
    return null;
  }
  return error.error as ProblemDetail;
}

/** A message that can be shown to the user, whatever the error. */
export function errorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse && error.status === 0) {
    return OFFLINE_MESSAGE;
  }
  const problem = problemOf(error);
  if (problem?.errors) {
    return 'Please check the highlighted fields.';
  }
  return problem?.detail ?? GENERIC_MESSAGE;
}

/** Field errors of a 400 validation response, empty otherwise. */
export function fieldErrors(error: unknown): Record<string, string> {
  return problemOf(error)?.errors ?? {};
}
