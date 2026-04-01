import {
  AppError,
  ErrorSeverity,
  ResumeParseError,
  ResumeExtractionError,
  ResumeNotFoundError,
  ResumeUploadError,
  ResumeGenerationError,
  ResumeInvalidFormatError,
  AuthInvalidCredentialsError,
  AuthUserExistsError,
  AuthTokenInvalidError,
  AuthTokenMissingError,
  AuthForbiddenError,
  AiServiceUnavailableError,
  AiResponseInvalidError,
  ValidationError,
  NotFoundError,
  InternalError,
  toAppError,
} from '../errors/AppError';

describe('AppError – base class', () => {
  it('creates an error with all expected fields', () => {
    const err = new AppError('Something went wrong', 'INTERNAL_ERROR', 500, ErrorSeverity.Error, { key: 'value' });
    expect(err.message).toBe('Something went wrong');
    expect(err.code).toBe('INTERNAL_ERROR');
    expect(err.statusCode).toBe(500);
    expect(err.severity).toBe(ErrorSeverity.Error);
    expect(err.details).toEqual({ key: 'value' });
    expect(err.isOperational).toBe(true);
    expect(err instanceof Error).toBe(true);
    expect(err instanceof AppError).toBe(true);
  });

  it('captures a stack trace', () => {
    const err = new AppError('oops', 'INTERNAL_ERROR');
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain('AppError');
  });

  it('sets name to the constructor name', () => {
    const err = new AppError('x', 'INTERNAL_ERROR');
    expect(err.name).toBe('AppError');
  });
});

describe('Resume error classes', () => {
  it('ResumeParseError has correct defaults', () => {
    const err = new ResumeParseError();
    expect(err.code).toBe('RESUME_PARSE_FAILED');
    expect(err.statusCode).toBe(422);
    expect(err.severity).toBe(ErrorSeverity.Warning);
    expect(err.isOperational).toBe(true);
    expect(err.name).toBe('ResumeParseError');
  });

  it('ResumeExtractionError accepts custom message and details', () => {
    const err = new ResumeExtractionError('bad pdf', { mimetype: 'application/pdf' });
    expect(err.message).toBe('bad pdf');
    expect(err.details?.mimetype).toBe('application/pdf');
    expect(err.statusCode).toBe(422);
  });

  it('ResumeNotFoundError returns 404', () => {
    const err = new ResumeNotFoundError();
    expect(err.statusCode).toBe(404);
    expect(err.severity).toBe(ErrorSeverity.Information);
  });

  it('ResumeUploadError returns 500', () => {
    const err = new ResumeUploadError();
    expect(err.statusCode).toBe(500);
    expect(err.severity).toBe(ErrorSeverity.Error);
  });

  it('ResumeGenerationError returns 500', () => {
    const err = new ResumeGenerationError('docx gen failed', { format: 'docx' });
    expect(err.statusCode).toBe(500);
    expect(err.details?.format).toBe('docx');
  });

  it('ResumeInvalidFormatError returns 400', () => {
    const err = new ResumeInvalidFormatError('bad type', { mimetype: 'image/jpeg' });
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('RESUME_INVALID_FORMAT');
  });
});

describe('Auth error classes', () => {
  it('AuthInvalidCredentialsError returns 401', () => {
    const err = new AuthInvalidCredentialsError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('AuthUserExistsError returns 409', () => {
    const err = new AuthUserExistsError();
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('AUTH_USER_EXISTS');
  });

  it('AuthTokenInvalidError returns 401', () => {
    const err = new AuthTokenInvalidError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('AUTH_TOKEN_INVALID');
  });

  it('AuthTokenMissingError returns 401', () => {
    const err = new AuthTokenMissingError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('AUTH_TOKEN_MISSING');
  });

  it('AuthForbiddenError returns 403', () => {
    const err = new AuthForbiddenError();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('AUTH_FORBIDDEN');
  });
});

describe('AI and generic error classes', () => {
  it('AiServiceUnavailableError returns 503', () => {
    const err = new AiServiceUnavailableError();
    expect(err.statusCode).toBe(503);
    expect(err.code).toBe('AI_SERVICE_UNAVAILABLE');
    expect(err.severity).toBe(ErrorSeverity.Error);
  });

  it('AiResponseInvalidError returns 502', () => {
    const err = new AiResponseInvalidError();
    expect(err.statusCode).toBe(502);
    expect(err.code).toBe('AI_RESPONSE_INVALID');
  });

  it('ValidationError returns 400 with Information severity', () => {
    const err = new ValidationError('title is required');
    expect(err.statusCode).toBe(400);
    expect(err.severity).toBe(ErrorSeverity.Information);
    expect(err.code).toBe('VALIDATION_ERROR');
  });

  it('NotFoundError returns 404', () => {
    const err = new NotFoundError();
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
  });

  it('InternalError is not operational', () => {
    const err = new InternalError();
    expect(err.statusCode).toBe(500);
    expect(err.isOperational).toBe(false);
    expect(err.severity).toBe(ErrorSeverity.Critical);
  });
});

describe('toAppError()', () => {
  it('returns an AppError unchanged', () => {
    const original = new ResumeNotFoundError();
    const result = toAppError(original);
    expect(result).toBe(original);
  });

  it('wraps a plain Error into an AppError', () => {
    const plain = new Error('something broke');
    const result = toAppError(plain);
    expect(result).toBeInstanceOf(AppError);
    expect(result.message).toBe('something broke');
    expect(result.code).toBe('INTERNAL_ERROR');
    expect(result.isOperational).toBe(false);
  });

  it('wraps a non-Error value into an AppError', () => {
    const result = toAppError('string error', 'RESUME_PARSE_FAILED');
    expect(result).toBeInstanceOf(AppError);
    expect(result.message).toBe('string error');
    expect(result.code).toBe('RESUME_PARSE_FAILED');
  });

  it('uses custom fallback code', () => {
    const result = toAppError(new Error('fail'), 'STORAGE_UPLOAD_FAILED');
    expect(result.code).toBe('STORAGE_UPLOAD_FAILED');
  });
});
