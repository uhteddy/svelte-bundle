import { describe, expect, test } from 'bun:test';
import {
  isValidPackageName,
  toValidPackageName,
  validatePackageName,
} from '../src/utils/validate.ts';

// ── isValidPackageName ───────────────────────────────────────────────────────

describe('isValidPackageName', () => {
  test.each([
    ['simple name', 'my-app'],
    ['all lowercase', 'myapp'],
    ['numbers', 'my-app-123'],
    ['tilde', 'my~app'],
    ['scoped package', '@scope/package'],
    ['scoped with hyphens', '@my-org/my-pkg'],
  ])('%s: %s is valid', (_label, name) => {
    expect(isValidPackageName(name)).toBe(true);
  });

  test.each([
    ['uppercase', 'MyApp'],
    ['spaces', 'my app'],
    ['empty string', ''],
    ['starts with dot', '.myapp'],
    ['starts with underscore', '_myapp'],
    ['special chars', 'my@app'],
  ])('%s: %s is invalid', (_label, name) => {
    expect(isValidPackageName(name)).toBe(false);
  });
});

// ── toValidPackageName ───────────────────────────────────────────────────────

describe('toValidPackageName', () => {
  test('lowercases', () => {
    expect(toValidPackageName('MyApp')).toBe('myapp');
  });

  test('replaces spaces with hyphens', () => {
    expect(toValidPackageName('my app')).toBe('my-app');
  });

  test('replaces underscores with hyphens', () => {
    expect(toValidPackageName('my_app')).toBe('my-app');
  });

  test('collapses multiple spaces/underscores into one hyphen', () => {
    expect(toValidPackageName('my  app')).toBe('my-app');
    expect(toValidPackageName('my__app')).toBe('my-app');
  });

  test('strips leading dots', () => {
    expect(toValidPackageName('.myapp')).toBe('myapp');
    expect(toValidPackageName('..myapp')).toBe('myapp');
  });

  test('leading underscore becomes a leading hyphen (underscore→hyphen runs before leading-char strip)', () => {
    // '_' is replaced with '-' before the ^[._]+ strip, so '_myapp' → '-myapp'
    expect(toValidPackageName('_myapp')).toBe('-myapp');
  });

  test('trims surrounding whitespace', () => {
    expect(toValidPackageName('  myapp  ')).toBe('myapp');
  });

  test('handles mixed issues', () => {
    expect(toValidPackageName('  My App_Project  ')).toBe('my-app-project');
  });
});

// ── validatePackageName ──────────────────────────────────────────────────────

describe('validatePackageName', () => {
  test('returns null for a valid name', () => {
    expect(validatePackageName('my-app')).toBeNull();
  });

  test('returns null for a scoped valid name', () => {
    expect(validatePackageName('@scope/my-pkg')).toBeNull();
  });

  test('returns error message for empty string', () => {
    const result = validatePackageName('');
    expect(result).not.toBeNull();
    expect(result).toMatch(/empty/i);
  });

  test('returns error message with suggestion for invalid name', () => {
    const result = validatePackageName('My App');
    expect(result).not.toBeNull();
    expect(result).toContain('my-app');
  });

  test('suggestion in error message is itself valid', () => {
    const invalid = 'My App_Project';
    const result = validatePackageName(invalid);
    expect(result).not.toBeNull();
    const suggestion = toValidPackageName(invalid);
    expect(result).toContain(suggestion);
    expect(isValidPackageName(suggestion)).toBe(true);
  });
});
