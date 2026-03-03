/**
 * CLI tests split across two strategies:
 *
 * 1. Subprocess tests — spawn `bun src/cli.ts` and check exit codes / error output.
 *    NOTE: bun intercepts `--help` at the launcher level, producing no capturable output,
 *    so content assertions for help text use strategy 2 instead.
 *
 * 2. Command definition tests — import command objects directly and assert that
 *    the expected flags are registered. This is more reliable than subprocess
 *    output parsing and catches arg regressions at the source level.
 */
import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildCommand } from '../src/commands/build/index.ts';
import { createCommand } from '../src/commands/create/index.ts';

const CLI = join(import.meta.dir, '..', 'src', 'cli.ts');

interface RunResult {
  readonly stdout: string;
  readonly stderr: string;
  /** stdout + stderr — use this for content assertions. */
  readonly output: string;
  readonly exitCode: number;
}

function run(args: string[], cwd = process.cwd()): RunResult {
  const result = spawnSync('bun', [CLI, ...args], {
    cwd,
    stdio: 'pipe',
    shell: false,
  });
  const stdout = result.stdout?.toString('utf-8') ?? '';
  const stderr = result.stderr?.toString('utf-8') ?? '';
  return { stdout, stderr, output: stdout + stderr, exitCode: result.status ?? 1 };
}

// ── --help exit codes (subprocess) ───────────────────────────────────────────

describe('svelte-bundle --help', () => {
  test('exits with 0', () => {
    expect(run(['--help']).exitCode).toBe(0);
  });
});

describe('svelte-bundle create --help', () => {
  test('exits with 0', () => {
    expect(run(['create', '--help']).exitCode).toBe(0);
  });
});

describe('svelte-bundle build --help', () => {
  test('exits with 0', () => {
    expect(run(['build', '--help']).exitCode).toBe(0);
  });
});

// ── Command arg definitions (direct import) ───────────────────────────────────
// Checks that expected flags are registered on each command definition.
// citty derives --help output from these definitions, so this is a reliable
// proxy for "flag appears in --help".

// citty types args as Resolvable<T>, which can be a function or plain object.
// Cast once to a plain record so we can inspect individual arg definitions.
type ArgDef = { readonly type?: string; readonly alias?: string; readonly default?: string };
type ArgRecord = Record<string, ArgDef | undefined>;

describe('createCommand arg definitions', () => {
  const argDefs = createCommand.args as unknown as ArgRecord;
  const args = Object.keys(argDefs);

  test('defines name positional arg', () => {
    expect(args).toContain('name');
  });

  test('defines --template / -t flag', () => {
    expect(args).toContain('template');
  });

  test('defines --pm flag', () => {
    expect(args).toContain('pm');
  });

  test('defines --no-install flag', () => {
    expect(args).toContain('no-install');
  });

  test('defines --no-git flag', () => {
    expect(args).toContain('no-git');
  });

  test('--template defaults to "default"', () => {
    expect(argDefs['template']?.default).toBe('default');
  });

  test('--no-install is a boolean flag', () => {
    expect(argDefs['no-install']?.type).toBe('boolean');
  });
});

describe('buildCommand arg definitions', () => {
  const argDefs = buildCommand.args as unknown as ArgRecord;
  const args = Object.keys(argDefs);

  test('defines --hydrate flag', () => {
    expect(args).toContain('hydrate');
  });

  test('defines --entry flag', () => {
    expect(args).toContain('entry');
  });

  test('defines --outfile flag', () => {
    expect(args).toContain('outfile');
  });

  test('defines --mode / -m flag', () => {
    expect(args).toContain('mode');
  });

  test('--hydrate is a boolean flag', () => {
    expect(argDefs['hydrate']?.type).toBe('boolean');
  });

  test('--mode has -m alias', () => {
    expect(argDefs['mode']?.alias).toBe('m');
  });

  test('--mode defaults to "production"', () => {
    expect(argDefs['mode']?.default).toBe('production');
  });
});

// ── create: error cases (subprocess) ─────────────────────────────────────────

describe('svelte-bundle create: error cases', () => {
  test('unknown template exits non-zero', () => {
    // Template validation runs before runCreatePrompts — no TTY needed
    const { exitCode } = run(['create', '--template', 'does-not-exist', 'my-project']);
    expect(exitCode).not.toBe(0);
  });

  test('unknown template prints error message', () => {
    const { output } = run(['create', '--template', 'does-not-exist', 'my-project']);
    expect(output.toLowerCase()).toMatch(/unknown|template|error/);
  });
});

// ── build: error cases (subprocess) ──────────────────────────────────────────

describe('svelte-bundle build: error cases', () => {
  test('exits non-zero when no vite.config.ts is present', () => {
    const { exitCode } = run(['build'], tmpdir());
    expect(exitCode).not.toBe(0);
  });

  test('prints error about missing vite.config', () => {
    const { output } = run(['build'], tmpdir());
    expect(output.toLowerCase()).toMatch(/vite\.config|error/);
  });
});
