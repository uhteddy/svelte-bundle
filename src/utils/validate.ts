/** Returns true if the given string is a valid npm package name. */
export function isValidPackageName(name: string): boolean {
  return /^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(name);
}

/**
 * Converts an arbitrary string into a valid npm package name by:
 *  - trimming whitespace
 *  - lowercasing
 *  - replacing spaces/underscores with hyphens
 *  - stripping leading dots or underscores
 *  - replacing remaining invalid characters with hyphens
 */
export function toValidPackageName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/^[._]+/, '')
    .replace(/[^a-z0-9-~]/g, '-');
}

/** Returns a human-readable validation message, or null if the name is valid. */
export function validatePackageName(name: string): string | null {
  if (name.length === 0) {
    return 'Project name cannot be empty.';
  }
  if (!isValidPackageName(name)) {
    const suggestion = toValidPackageName(name);
    return `"${name}" is not a valid npm package name. Try "${suggestion}" instead.`;
  }
  return null;
}
