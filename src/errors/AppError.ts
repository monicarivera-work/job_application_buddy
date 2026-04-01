/**
 * Custom exception handling schema for Job Application Buddy.
 *
 * Defines a structured error hierarchy used throughout the application.
 * Every AppError carries:
 *  - `code`       – machine-readable error identifier (e.g. "RESUME_PARSE_FAILED")
 *  - `statusCode` – HTTP status code to return to the client
 *  - `severity`   – maps to Application Insights SeverityLevel for telemetry
 *  - `details`    – optional non-PII context bag for diagnostics
 */

/** Application Insights severity levels (mirrors the SDK enum). */
export enum ErrorSeverity {
  Verbose = 0,
  Information = 1,
  Warning = 2,
  Error = 3,
  Critical = 4,
}

/** Machine-readable error codes used across the application. */
export type AppErrorCode =
  // Resume
  | 'RESUME_PARSE_FAILED'
  | 'RESUME_EXTRACTION_FAILED'
  | 'RESUME_NOT_FOUND'
  | 'RESUME_UPLOAD_FAILED'
  | 'RESUME_GENERATION_FAILED'
  | 'RESUME_INVALID_FORMAT'
  // Auth
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_USER_NOT_FOUND'
  | 'AUTH_USER_EXISTS'
  | 'AUTH_TOKEN_INVALID'
  | 'AUTH_TOKEN_MISSING'
  | 'AUTH_FORBIDDEN'
  // Profile
  | 'PROFILE_NOT_FOUND'
  | 'PROFILE_UPDATE_FAILED'
  // Application
  | 'APPLICATION_NOT_FOUND'
  | 'APPLICATION_SUBMISSION_FAILED'
  // Storage
  | 'STORAGE_UPLOAD_FAILED'
  | 'STORAGE_UNAVAILABLE'
  // AI / External services
  | 'AI_SERVICE_UNAVAILABLE'
  | 'AI_RESPONSE_INVALID'
  // Generic
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR'
  | 'NOT_FOUND';

/**
 * Base application error class.
 * All custom errors in this project extend AppError.
 */
export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly statusCode: number;
  readonly severity: ErrorSeverity;
  readonly details?: Record<string, unknown>;
  readonly isOperational: boolean;

  constructor(
    message: string,
    code: AppErrorCode,
    statusCode = 500,
    severity = ErrorSeverity.Error,
    details?: Record<string, unknown>,
    isOperational = true,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.severity = severity;
    this.details = details;
    this.isOperational = isOperational;
    // Preserve proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// ─── Resume Errors ───────────────────────────────────────────────────────────

export class ResumeParseError extends AppError {
  constructor(message = 'Failed to parse resume content', details?: Record<string, unknown>) {
    super(message, 'RESUME_PARSE_FAILED', 422, ErrorSeverity.Warning, details);
  }
}

export class ResumeExtractionError extends AppError {
  constructor(message = 'Failed to extract text from resume file', details?: Record<string, unknown>) {
    super(message, 'RESUME_EXTRACTION_FAILED', 422, ErrorSeverity.Warning, details);
  }
}

export class ResumeNotFoundError extends AppError {
  constructor(message = 'No resume found. Please upload a resume first.') {
    super(message, 'RESUME_NOT_FOUND', 404, ErrorSeverity.Information);
  }
}

export class ResumeUploadError extends AppError {
  constructor(message = 'Failed to upload resume file to storage', details?: Record<string, unknown>) {
    super(message, 'RESUME_UPLOAD_FAILED', 500, ErrorSeverity.Error, details);
  }
}

export class ResumeGenerationError extends AppError {
  constructor(message = 'Failed to generate resume file', details?: Record<string, unknown>) {
    super(message, 'RESUME_GENERATION_FAILED', 500, ErrorSeverity.Error, details);
  }
}

export class ResumeInvalidFormatError extends AppError {
  constructor(message = 'Invalid resume file format', details?: Record<string, unknown>) {
    super(message, 'RESUME_INVALID_FORMAT', 400, ErrorSeverity.Warning, details);
  }
}

// ─── Auth Errors ─────────────────────────────────────────────────────────────

export class AuthInvalidCredentialsError extends AppError {
  constructor(message = 'Invalid credentials') {
    super(message, 'AUTH_INVALID_CREDENTIALS', 401, ErrorSeverity.Warning);
  }
}

export class AuthUserNotFoundError extends AppError {
  constructor(message = 'User not found') {
    super(message, 'AUTH_USER_NOT_FOUND', 401, ErrorSeverity.Warning);
  }
}

export class AuthUserExistsError extends AppError {
  constructor(message = 'User already exists') {
    super(message, 'AUTH_USER_EXISTS', 409, ErrorSeverity.Information);
  }
}

export class AuthTokenInvalidError extends AppError {
  constructor(message = 'Invalid or expired token') {
    super(message, 'AUTH_TOKEN_INVALID', 401, ErrorSeverity.Warning);
  }
}

export class AuthTokenMissingError extends AppError {
  constructor(message = 'Authentication token is required') {
    super(message, 'AUTH_TOKEN_MISSING', 401, ErrorSeverity.Information);
  }
}

export class AuthForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 'AUTH_FORBIDDEN', 403, ErrorSeverity.Warning);
  }
}

// ─── Storage Errors ──────────────────────────────────────────────────────────

export class StorageUploadError extends AppError {
  constructor(message = 'Failed to upload file to storage', details?: Record<string, unknown>) {
    super(message, 'STORAGE_UPLOAD_FAILED', 500, ErrorSeverity.Error, details);
  }
}

// ─── AI / External Service Errors ────────────────────────────────────────────

export class AiServiceUnavailableError extends AppError {
  constructor(message = 'AI service is not available', details?: Record<string, unknown>) {
    super(message, 'AI_SERVICE_UNAVAILABLE', 503, ErrorSeverity.Error, details);
  }
}

export class AiResponseInvalidError extends AppError {
  constructor(message = 'Received an unexpected response from AI service') {
    super(message, 'AI_RESPONSE_INVALID', 502, ErrorSeverity.Warning);
  }
}

// ─── Generic Errors ──────────────────────────────────────────────────────────

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, ErrorSeverity.Information, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 'NOT_FOUND', 404, ErrorSeverity.Information);
  }
}

export class InternalError extends AppError {
  constructor(message = 'An internal error occurred', details?: Record<string, unknown>) {
    super(message, 'INTERNAL_ERROR', 500, ErrorSeverity.Critical, details, false);
  }
}

/**
 * Converts an unknown caught value into an AppError.
 * If it is already an AppError, returns it as-is.
 */
export function toAppError(err: unknown, fallbackCode: AppErrorCode = 'INTERNAL_ERROR'): AppError {
  if (err instanceof AppError) return err;
  const message = err instanceof Error ? err.message : String(err);
  return new AppError(message, fallbackCode, 500, ErrorSeverity.Error, undefined, false);
}
