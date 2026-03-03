/**
 * End-to-end scaffold() integration tests.
 * Calls scaffold() directly (bypassing interactive prompts) with a temp output
 * directory and verifies the file tree and generated file contents on disk.
 */
import { describe, expect, test } from 'bun:test';
import { readFile, rm } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { OptionalFeature, ScaffoldContext } from '../src/types.ts';
import { scaffold } from '../src/commands/create/scaffold.ts';
import { pathExists } from '../src/utils/fs.ts';

const TEMPLATES_DIR = join(import.meta.dir, '..', 'templates');

// targetDir is excluded from overrides — it is always the fresh temp subdir.
async function scaffoldInto(
  overrides: Omit<Partial<ScaffoldContext>, 'targetDir'> & {
    features?: readonly OptionalFeature[];
  } = {},
): Promise<{ dir: string; cleanup: () => Promise<void> }> {
  // Create a parent temp dir so scaffold() can create its own fresh subdirectory.
  // scaffold() exits with code 1 if targetDir already exists, so we must NOT
  // pass a pre-created directory as targetDir.
  const parent = await mkdtemp(join(tmpdir(), 'sb-e2e-'));
  const dir = join(parent, 'project');
  await scaffold({
    name: 'my-test-app',
    targetDir: dir,
    templateDir: join(TEMPLATES_DIR, 'default'),
    features: [],
    packageManager: 'bun',
    git: false,
    install: false,
    ...overrides,
  });
  return { dir, cleanup: () => rm(parent, { recursive: true, force: true }) };
}

// ── Base project (no optional features) ──────────────────────────────────────

describe('scaffold: base project', () => {
  test('creates all expected files', async () => {
    const { dir, cleanup } = await scaffoldInto();
    try {
      const expectedFiles = [
        'package.json',
        'vite.config.ts',
        'tsconfig.json',
        'tsconfig.app.json',
        'tsconfig.node.json',
        '.gitignore',
        'index.html',
        'src/App.svelte',
        'src/main.ts',
        'src/lib/index.ts',
      ];
      for (const file of expectedFiles) {
        expect(await pathExists(join(dir, file))).toBe(true);
      }
    } finally {
      await cleanup();
    }
  });

  test('does not leave _-prefixed template files behind', async () => {
    const { dir, cleanup } = await scaffoldInto();
    try {
      expect(await pathExists(join(dir, '_package.json'))).toBe(false);
      expect(await pathExists(join(dir, '_vite.config.ts'))).toBe(false);
      expect(await pathExists(join(dir, '_gitignore'))).toBe(false);
    } finally {
      await cleanup();
    }
  });

  test('package.json has correct project name', async () => {
    const { dir, cleanup } = await scaffoldInto({ name: 'cool-widget' });
    try {
      const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf-8')) as {
        name: string;
      };
      expect(pkg.name).toBe('cool-widget');
    } finally {
      await cleanup();
    }
  });

  test('index.html has project name substituted', async () => {
    const { dir, cleanup } = await scaffoldInto({ name: 'my-test-app' });
    try {
      const html = await readFile(join(dir, 'index.html'), 'utf-8');
      expect(html).toContain('my-test-app');
      expect(html).not.toContain('{{PROJECT_NAME}}');
    } finally {
      await cleanup();
    }
  });

  test('App.svelte has project name substituted', async () => {
    const { dir, cleanup } = await scaffoldInto({ name: 'my-test-app' });
    try {
      const svelte = await readFile(join(dir, 'src/App.svelte'), 'utf-8');
      expect(svelte).toContain('my-test-app');
      expect(svelte).not.toContain('{{PROJECT_NAME}}');
    } finally {
      await cleanup();
    }
  });
});

// ── vite.config.ts comment stripping ─────────────────────────────────────────

describe('scaffold: vite.config.ts comment stripping', () => {
  test('generated config includes legalComments: none', async () => {
    const { dir, cleanup } = await scaffoldInto();
    try {
      const config = await readFile(join(dir, 'vite.config.ts'), 'utf-8');
      expect(config).toContain("legalComments: 'none'");
    } finally {
      await cleanup();
    }
  });

  test('generated config includes comments: false', async () => {
    const { dir, cleanup } = await scaffoldInto();
    try {
      const config = await readFile(join(dir, 'vite.config.ts'), 'utf-8');
      expect(config).toContain('comments: false');
    } finally {
      await cleanup();
    }
  });

  test('with tailwind: config still includes legalComments: none', async () => {
    const { dir, cleanup } = await scaffoldInto({ features: ['tailwind'] });
    try {
      const config = await readFile(join(dir, 'vite.config.ts'), 'utf-8');
      expect(config).toContain("legalComments: 'none'");
    } finally {
      await cleanup();
    }
  });
});

// ── Optional feature: tailwind ────────────────────────────────────────────────

describe('scaffold: tailwind feature', () => {
  test('creates src/app.css', async () => {
    const { dir, cleanup } = await scaffoldInto({ features: ['tailwind'] });
    try {
      expect(await pathExists(join(dir, 'src/app.css'))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  test('app.css imports tailwindcss', async () => {
    const { dir, cleanup } = await scaffoldInto({ features: ['tailwind'] });
    try {
      const css = await readFile(join(dir, 'src/app.css'), 'utf-8');
      expect(css).toContain('@import "tailwindcss"');
    } finally {
      await cleanup();
    }
  });

  test('vite.config.ts imports tailwindcss plugin', async () => {
    const { dir, cleanup } = await scaffoldInto({ features: ['tailwind'] });
    try {
      const config = await readFile(join(dir, 'vite.config.ts'), 'utf-8');
      expect(config).toContain("@tailwindcss/vite");
      expect(config).toContain('tailwindcss()');
    } finally {
      await cleanup();
    }
  });

  test('package.json includes tailwindcss and @tailwindcss/vite devDeps', async () => {
    const { dir, cleanup } = await scaffoldInto({ features: ['tailwind'] });
    try {
      const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf-8')) as {
        devDependencies: Record<string, string>;
      };
      expect(pkg.devDependencies).toHaveProperty('tailwindcss');
      expect(pkg.devDependencies).toHaveProperty('@tailwindcss/vite');
    } finally {
      await cleanup();
    }
  });
});

// ── Optional feature: eslint ──────────────────────────────────────────────────

describe('scaffold: eslint feature', () => {
  test('creates eslint.config.js', async () => {
    const { dir, cleanup } = await scaffoldInto({ features: ['eslint'] });
    try {
      expect(await pathExists(join(dir, 'eslint.config.js'))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  test('package.json includes eslint devDeps', async () => {
    const { dir, cleanup } = await scaffoldInto({ features: ['eslint'] });
    try {
      const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf-8')) as {
        devDependencies: Record<string, string>;
      };
      expect(pkg.devDependencies).toHaveProperty('eslint');
      expect(pkg.devDependencies).toHaveProperty('eslint-plugin-svelte');
    } finally {
      await cleanup();
    }
  });
});

// ── Optional feature: prettier ────────────────────────────────────────────────

describe('scaffold: prettier feature', () => {
  test('creates .prettierrc', async () => {
    const { dir, cleanup } = await scaffoldInto({ features: ['prettier'] });
    try {
      expect(await pathExists(join(dir, '.prettierrc'))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  test('.prettierrc is valid JSON with svelte plugin', async () => {
    const { dir, cleanup } = await scaffoldInto({ features: ['prettier'] });
    try {
      const content = await readFile(join(dir, '.prettierrc'), 'utf-8');
      const parsed = JSON.parse(content) as { plugins: string[] };
      expect(parsed.plugins).toContain('prettier-plugin-svelte');
    } finally {
      await cleanup();
    }
  });
});

// ── Optional feature: vitest ──────────────────────────────────────────────────

describe('scaffold: vitest feature', () => {
  test('creates src/tests/example.test.ts', async () => {
    const { dir, cleanup } = await scaffoldInto({ features: ['vitest'] });
    try {
      expect(await pathExists(join(dir, 'src/tests/example.test.ts'))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  test('package.json includes test script', async () => {
    const { dir, cleanup } = await scaffoldInto({ features: ['vitest'] });
    try {
      const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf-8')) as {
        scripts: Record<string, string>;
      };
      expect(pkg.scripts['test']).toBe('vitest');
    } finally {
      await cleanup();
    }
  });
});

// ── All features together ─────────────────────────────────────────────────────

describe('scaffold: all features', () => {
  test('creates all expected feature files', async () => {
    const { dir, cleanup } = await scaffoldInto({
      features: ['tailwind', 'eslint', 'prettier', 'vitest'],
    });
    try {
      const featureFiles = [
        'src/app.css',
        'eslint.config.js',
        '.prettierrc',
        'src/tests/example.test.ts',
      ];
      for (const file of featureFiles) {
        expect(await pathExists(join(dir, file))).toBe(true);
      }
    } finally {
      await cleanup();
    }
  });
});
