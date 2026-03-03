import {
  mkdir,
  copyFile,
  readdir,
  readFile,
  writeFile,
  stat,
} from 'node:fs/promises';
import { join, dirname } from 'node:path';

/** Creates a directory and all intermediate parent directories. */
export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

/**
 * Maps a template filename to its output filename.
 * Rules:
 *   - `_gitignore`  → `.gitignore`  (npm strips dotfiles from published packages)
 *   - `_<name>`     → `<name>`      (prevents conflicts with root config files)
 *   - everything else is kept as-is
 */
export function resolveDestFilename(filename: string): string {
  if (filename === '_gitignore') return '.gitignore';
  if (filename.startsWith('_')) return filename.slice(1);
  return filename;
}

/** Returns true if the given Buffer looks like a binary file. */
function isBinary(buf: Buffer): boolean {
  // Check the first 8000 bytes for null bytes — a reliable binary heuristic.
  const slice = buf.subarray(0, 8000);
  for (let i = 0; i < slice.length; i++) {
    if (slice[i] === 0) return true;
  }
  return false;
}

/**
 * Recursively copies `src` directory into `dest`.
 * An optional `transform` function is called on text file contents,
 * receiving the raw content and the *source* filename.
 */
export async function copyDir(
  src: string,
  dest: string,
  transform?: (content: string, filename: string) => string,
): Promise<void> {
  await ensureDir(dest);

  const entries = await readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destFilename = resolveDestFilename(entry.name);
    const destPath = join(dest, destFilename);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath, transform);
    } else if (entry.isFile()) {
      if (transform !== undefined) {
        const raw = await readFile(srcPath);
        if (isBinary(raw)) {
          await ensureDir(dirname(destPath));
          await copyFile(srcPath, destPath);
        } else {
          const text = raw.toString('utf-8');
          const transformed = transform(text, entry.name);
          await ensureDir(dirname(destPath));
          await writeFile(destPath, transformed, 'utf-8');
        }
      } else {
        await ensureDir(dirname(destPath));
        await copyFile(srcPath, destPath);
      }
    }
  }
}

/** Returns true if the given path exists on disk. */
export async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}
