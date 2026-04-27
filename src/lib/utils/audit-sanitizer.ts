/**
 * Audit Log Sanitization Utility
 * 
 * SECURITY: Removes sensitive data from audit logs to prevent data exposure
 * 
 * This utility ensures that sensitive information like password hashes, tokens,
 * and other credentials are never stored in audit logs, even in beforeState/afterState.
 */

/**
 * List of sensitive field names that should be removed from audit logs
 */
const SENSITIVE_FIELDS = [
  'passwordHash',
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'apiKey',
  'privateKey',
  'sessionToken',
  'csrfToken',
  'otp',
  'verificationCode',
  'resetToken',
  'authToken',
] as const;

/**
 * Sanitize an object for audit logging by removing sensitive fields
 * 
 * @param obj - The object to sanitize (can be any type)
 * @returns A sanitized copy of the object with sensitive fields removed
 * 
 * @example
 * const user = { id: '123', email: 'user@example.com', passwordHash: 'hash123' };
 * const sanitized = sanitizeForAudit(user);
 * // Result: { id: '123', email: 'user@example.com' }
 */
export function sanitizeForAudit<T>(obj: T): Partial<T> {
  if (obj === null || obj === undefined) {
    return obj as Partial<T>;
  }

  // Handle primitive types
  if (typeof obj !== 'object') {
    return obj as Partial<T>;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForAudit(item)) as unknown as Partial<T>;
  }

  // Handle objects
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    // Skip sensitive fields
    if (SENSITIVE_FIELDS.includes(key as typeof SENSITIVE_FIELDS[number])) {
      continue;
    }

    // Recursively sanitize nested objects
    if (value !== null && typeof value === 'object') {
      sanitized[key] = sanitizeForAudit(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized as Partial<T>;
}

/**
 * Sanitize multiple objects for audit logging
 * 
 * @param objects - Array of objects to sanitize
 * @returns Array of sanitized objects
 * 
 * @example
 * const users = [
 *   { id: '1', email: 'user1@example.com', passwordHash: 'hash1' },
 *   { id: '2', email: 'user2@example.com', passwordHash: 'hash2' }
 * ];
 * const sanitized = sanitizeMultipleForAudit(users);
 */
export function sanitizeMultipleForAudit<T>(objects: T[]): Partial<T>[] {
  return objects.map(obj => sanitizeForAudit(obj));
}

/**
 * Check if a field name is sensitive and should be excluded from audit logs
 * 
 * @param fieldName - The field name to check
 * @returns True if the field is sensitive, false otherwise
 */
export function isSensitiveField(fieldName: string): boolean {
  return SENSITIVE_FIELDS.includes(fieldName as typeof SENSITIVE_FIELDS[number]);
}
