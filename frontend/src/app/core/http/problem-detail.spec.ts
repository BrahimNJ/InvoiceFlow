import { HttpErrorResponse } from '@angular/common/http';

import { errorMessage, fieldErrors } from './problem-detail';

describe('problem-detail', () => {
  it('uses the detail sent by the backend', () => {
    const error = new HttpErrorResponse({ status: 401, error: { status: 401, detail: 'Invalid email or password' } });

    expect(errorMessage(error)).toBe('Invalid email or password');
  });

  it('points to the fields on validation errors', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: { status: 400, detail: 'Validation failed', errors: { email: 'must be a well-formed email address' } },
    });

    expect(errorMessage(error)).toBe('Please check the highlighted fields.');
    expect(fieldErrors(error)).toEqual({ email: 'must be a well-formed email address' });
  });

  it('explains when the server cannot be reached', () => {
    expect(errorMessage(new HttpErrorResponse({ status: 0 }))).toContain('Cannot reach the server');
  });

  it('falls back to a generic message', () => {
    expect(errorMessage(new HttpErrorResponse({ status: 500, error: 'Internal Server Error' }))).toBe(
      'Something went wrong. Please try again.',
    );
    expect(errorMessage(new Error('boom'))).toBe('Something went wrong. Please try again.');
    expect(fieldErrors(new Error('boom'))).toEqual({});
  });
});
