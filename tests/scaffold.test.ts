import { describe, expect, test } from 'bun:test';
import type { ScaffoldContext } from '../src/types.ts';
import { buildPackageJson, buildViteConfig } from '../src/commands/create/scaffold.ts';

function makeCtx(overrides: Partial<ScaffoldContext> = {}): ScaffoldContext {
  return {
    name: 'test-project',
    targetDir: '/tmp/test-project',
    templateDir: '/tmp/template',
    features: [],
    packageManager: 'bun',
    git: false,
    install: false,
    ...overrides,
  };
}

// ── buildViteConfig ──────────────────────────────────────────────────────────

describe('buildViteConfig', () => {
  describe('comment stripping', () => {
    test('includes legalComments: none (no features)', () => {
      expect(buildViteConfig(makeCtx())).toContain("legalComments: 'none'");
    });

    test('includes legalComments: none (with tailwind)', () => {
      expect(buildViteConfig(makeCtx({ features: ['tailwind'] }))).toContain("legalComments: 'none'");
    });

    test('includes legalComments: none (all features)', () => {
      const ctx = makeCtx({ features: ['tailwind', 'eslint', 'prettier', 'vitest'] });
      expect(buildViteConfig(ctx)).toContain("legalComments: 'none'");
    });

    test('includes comments: false', () => {
      expect(buildViteConfig(makeCtx())).toContain('comments: false');
    });
  });

  describe('base structure', () => {
    test('imports defineConfig from vite', () => {
      expect(buildViteConfig(makeCtx())).toContain("import { defineConfig } from 'vite'");
    });

    test('imports svelte plugin', () => {
      expect(buildViteConfig(makeCtx())).toContain(
        "import { svelte } from '@sveltejs/vite-plugin-svelte'",
      );
    });

    test('uses svelte() in plugins', () => {
      expect(buildViteConfig(makeCtx())).toContain('svelte()');
    });

    test('exports defineConfig call', () => {
      expect(buildViteConfig(makeCtx())).toContain('export default defineConfig');
    });
  });

  describe('tailwind feature', () => {
    test('without tailwind: no tailwindcss import', () => {
      expect(buildViteConfig(makeCtx({ features: [] }))).not.toContain('tailwindcss');
    });

    test('with tailwind: imports @tailwindcss/vite', () => {
      expect(buildViteConfig(makeCtx({ features: ['tailwind'] }))).toContain(
        "import tailwindcss from '@tailwindcss/vite'",
      );
    });

    test('with tailwind: adds tailwindcss() to plugins', () => {
      expect(buildViteConfig(makeCtx({ features: ['tailwind'] }))).toContain('tailwindcss()');
    });
  });
});

// ── buildPackageJson ─────────────────────────────────────────────────────────

describe('buildPackageJson', () => {
  test('produces valid JSON', () => {
    expect(() => JSON.parse(buildPackageJson(makeCtx()))).not.toThrow();
  });

  test('sets project name', () => {
    const pkg = JSON.parse(buildPackageJson(makeCtx({ name: 'my-app' }))) as { name: string };
    expect(pkg.name).toBe('my-app');
  });

  test('includes required base devDependencies', () => {
    const pkg = JSON.parse(buildPackageJson(makeCtx())) as {
      devDependencies: Record<string, string>;
    };
    expect(pkg.devDependencies).toHaveProperty('svelte');
    expect(pkg.devDependencies).toHaveProperty('vite');
    expect(pkg.devDependencies).toHaveProperty('@sveltejs/vite-plugin-svelte');
    expect(pkg.devDependencies).toHaveProperty('typescript');
  });

  test('includes dev, build, preview, type-check scripts', () => {
    const pkg = JSON.parse(buildPackageJson(makeCtx())) as { scripts: Record<string, string> };
    expect(pkg.scripts).toHaveProperty('dev');
    expect(pkg.scripts).toHaveProperty('build');
    expect(pkg.scripts).toHaveProperty('preview');
    expect(pkg.scripts).toHaveProperty('type-check');
  });

  describe('tailwind feature', () => {
    test('adds tailwindcss devDependencies', () => {
      const pkg = JSON.parse(buildPackageJson(makeCtx({ features: ['tailwind'] }))) as {
        devDependencies: Record<string, string>;
      };
      expect(pkg.devDependencies).toHaveProperty('tailwindcss');
      expect(pkg.devDependencies).toHaveProperty('@tailwindcss/vite');
    });
  });

  describe('vitest feature', () => {
    test('adds vitest devDependencies', () => {
      const pkg = JSON.parse(buildPackageJson(makeCtx({ features: ['vitest'] }))) as {
        devDependencies: Record<string, string>;
      };
      expect(pkg.devDependencies).toHaveProperty('vitest');
    });

    test('adds test and test:ui scripts', () => {
      const pkg = JSON.parse(buildPackageJson(makeCtx({ features: ['vitest'] }))) as {
        scripts: Record<string, string>;
      };
      expect(pkg.scripts['test']).toBe('vitest');
      expect(pkg.scripts['test:ui']).toBe('vitest --ui');
    });
  });

  describe('without vitest', () => {
    test('does not add test script', () => {
      const pkg = JSON.parse(buildPackageJson(makeCtx({ features: [] }))) as {
        scripts: Record<string, string>;
      };
      expect(pkg.scripts).not.toHaveProperty('test');
    });
  });
});
