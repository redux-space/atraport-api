import { Injectable } from '@nestjs/common';
import { ZodError, ZodIssue } from 'zod';
import { FormattedValidationError } from '../interfaces/validation.interfaces';

@Injectable()
export class ValidationErrorFormatter {
  /**
   * Formats a ZodError into an array of clean, standardized FormattedValidationError objects.
   */
  static formatZodError(error: ZodError): FormattedValidationError[] {
    return error.issues.map((issue) => this.formatZodIssue(issue));
  }

  /**
   * Formats a single Zod issue.
   */
  static formatZodIssue(issue: ZodIssue): FormattedValidationError {
    const fieldPath = this.buildFieldPath(issue.path);
    const code = issue.code;
    let message = issue.message;

    // Enhance common generic Zod messages if needed
    if (code === 'invalid_type' && (issue as any).received === 'undefined') {
      message = issue.message === 'Required' ? 'This field is required' : issue.message;
    }

    const formatted: FormattedValidationError = {
      field: fieldPath || 'root',
      message,
      code,
      path: issue.path,
    };

    if ('received' in issue) {
      formatted.received = (issue as any).received;
    }
    if ('expected' in issue) {
      formatted.expected = String((issue as any).expected);
    }

    return formatted;
  }

  /**
   * Constructs a human-readable property path with dot and array index notation.
   * e.g. ['users', 0, 'addresses', 1, 'street'] -> 'users[0].addresses[1].street'
   */
  static buildFieldPath(path: (string | number)[]): string {
    if (!path || path.length === 0) {
      return '';
    }

    return path.reduce<string>((acc, segment, index) => {
      if (typeof segment === 'number') {
        return `${acc}[${segment}]`;
      }
      return index === 0 ? String(segment) : `${acc}.${segment}`;
    }, '');
  }

  /**
   * Instance method wrapper for DI usage.
   */
  formatZodError(error: ZodError): FormattedValidationError[] {
    return ValidationErrorFormatter.formatZodError(error);
  }

  /**
   * Instance method wrapper for single issue formatting.
   */
  formatZodIssue(issue: ZodIssue): FormattedValidationError {
    return ValidationErrorFormatter.formatZodIssue(issue);
  }
}
