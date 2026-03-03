import { describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { copyDir, ensureDir, pathExists, resolveDestFilename } from '../src/utils/fs.ts';

// ── resolveDestFilename ──────────────────────────────────────────────────────

describe('resolveDestFilename', () => {
  test('_gitignore → .gitignore', () => {
    expect(resolveDestFilename('_gitignore')).toBe('.gitignore');
  });

  test('_package.json → package.json', () => {
    expect(resolveDestFilename('_package.json')).toBe('package.json');
  });

  test('_vite.config.ts → vite.config.ts', () => {
    expect(resolveDestFilename('_vite.config.ts')).toBe('vite.config.ts');
  });

  test('_tsconfig.json → tsconfig.json', () => {
    expect(resolveDestFilename('_tsconfig.json')).toBe('tsconfig.json');
  });

  test('regular file is unchanged', () => {
    expect(resolveDestFilename('index.html')).toBe('index.html');
  });

  test('dotfile without leading underscore is unchanged', () => {
    expect(resolveDestFilename('.prettierrc')).toBe('.prettierrc');
  });

  test('source file is unchanged', () => {
    expect(resolveDestFilename('App.svelte')).toBe('App.svelte');
  });
});

// ── pathExists ───────────────────────────────────────────────────────────────

describe('pathExists', () => {
  test('returns true for existing path', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sb-test-'));
    try {
      expect(await pathExists(dir)).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test('returns false for non-existent path', async () => {
    expect(await pathExists('/tmp/__svelte_bundle_nonexistent_12345__')).toBe(false);
  });
});

// ── ensureDir ────────────────────────────────────────────────────────────────

describe('ensureDir', () => {
  test('creates nested directories', async () => {
    const base = await mkdtemp(join(tmpdir(), 'sb-test-'));
    const nested = join(base, 'a', 'b', 'c');
    try {
      await ensureDir(nested);
      expect(await pathExists(nested)).toBe(true);
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  test('does not throw if directory already exists', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sb-test-'));
    try {
      await expect(ensureDir(dir)).resolves.toBeUndefined();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

// ── copyDir ──────────────────────────────────────────────────────────────────

describe('copyDir', () => {
  test('copies files from src to dest', async () => {
    const src = await mkdtemp(join(tmpdir(), 'sb-src-'));
    const dest = await mkdtemp(join(tmpdir(), 'sb-dest-'));
    try {
      await writeFile(join(src, 'hello.txt'), 'hello world', 'utf-8');

      await copyDir(src, dest);

      const content = await readFile(join(dest, 'hello.txt'), 'utf-8');
      expect(content).toBe('hello world');
    } finally {
      await rm(src, { recursive: true, force: true });
      await rm(dest, { recursive: true, force: true });
    }
  });

  test('applies transform to text files', async () => {
    const src = await mkdtemp(join(tmpdir(), 'sb-src-'));
    const dest = await mkdtemp(join(tmpdir(), 'sb-dest-'));
    try {
      await writeFile(join(src, 'hello.txt'), '{{NAME}}', 'utf-8');

      await copyDir(src, dest, (content) => content.replace('{{NAME}}', 'svelte-bundle'));

      const content = await readFile(join(dest, 'hello.txt'), 'utf-8');
      expect(content).toBe('svelte-bundle');
    } finally {
      await rm(src, { recursive: true, force: true });
      await rm(dest, { recursive: true, force: true });
    }
  });

  test('renames _gitignore → .gitignore', async () => {
    const src = await mkdtemp(join(tmpdir(), 'sb-src-'));
    const dest = await mkdtemp(join(tmpdir(), 'sb-dest-'));
    try {
      await writeFile(join(src, '_gitignore'), 'node_modules/', 'utf-8');

      await copyDir(src, dest);

      expect(await pathExists(join(dest, '.gitignore'))).toBe(true);
      expect(await pathExists(join(dest, '_gitignore'))).toBe(false);
    } finally {
      await rm(src, { recursive: true, force: true });
      await rm(dest, { recursive: true, force: true });
    }
  });

  test('copies nested directories recursively', async () => {
    const src = await mkdtemp(join(tmpdir(), 'sb-src-'));
    const dest = await mkdtemp(join(tmpdir(), 'sb-dest-'));
    try {
      await ensureDir(join(src, 'src', 'lib'));
      await writeFile(join(src, 'src', 'lib', 'index.ts'), 'export {};', 'utf-8');

      await copyDir(src, dest);

      const content = await readFile(join(dest, 'src', 'lib', 'index.ts'), 'utf-8');
      expect(content).toBe('export {};');
    } finally {
      await rm(src, { recursive: true, force: true });
      await rm(dest, { recursive: true, force: true });
    }
  });
});
