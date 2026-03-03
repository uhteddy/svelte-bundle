import { defineCommand } from 'citty';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { ensureDir } from '../../utils/fs.ts';
import { logger } from '../../utils/logger.ts';
import pc from 'picocolors';

// ── Types ───────────────────────────────────────────────────────────────────

interface RunResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

interface SSRResult {
  readonly html: string;
  readonly head: string;
}

// ── Low-level helpers ───────────────────────────────────────────────────────

/** Resolves the vite binary, preferring the project-local install. */
function resolveViteBin(cwd: string): string {
  const local = join(cwd, 'node_modules', '.bin', 'vite');
  if (existsSync(local)) return local;
  return 'vite';
}

/** Typed wrapper around spawnSync. */
function run(
  bin: string,
  args: readonly string[],
  cwd: string,
  stdio: 'inherit' | 'pipe' = 'inherit',
): RunResult {
  const result = spawnSync(bin, args as string[], {
    cwd,
    stdio,
    shell: process.platform === 'win32',
  });
  return {
    exitCode: result.status ?? 1,
    stdout: result.stdout?.toString('utf-8') ?? '',
    stderr: result.stderr?.toString('utf-8') ?? '',
  };
}

// ── Asset Inlining ──────────────────────────────────────────────────────────

/**
 * Like String.prototype.replace but supports async replacer functions.
 * All matches are processed in parallel via Promise.all.
 */
async function replaceAsync(
  str: string,
  regex: RegExp,
  replacer: (match: string, ...groups: string[]) => Promise<string>,
): Promise<string> {
  // Always work with a global regex to gather all matches via exec()
  const re = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g');

  type MatchEntry = { readonly match: string; readonly groups: readonly string[]; readonly index: number };
  const matches: MatchEntry[] = [];
  let m: RegExpExecArray | null;

  while ((m = re.exec(str)) !== null) {
    const groups = (m.slice(1) as Array<string | undefined>).map((g) => g ?? '');
    matches.push({ match: m[0], groups, index: m.index });
  }

  const replacements = await Promise.all(
    matches.map(({ match, groups }) => replacer(match, ...groups)),
  );

  // Apply from right to left so earlier indices remain valid after each substitution
  let result = str;
  for (let i = matches.length - 1; i >= 0; i--) {
    const entry = matches[i];
    const replacement = replacements[i];
    if (entry === undefined || replacement === undefined) continue;
    result =
      result.slice(0, entry.index) + replacement + result.slice(entry.index + entry.match.length);
  }

  return result;
}

/**
 * Reads `{distDir}/index.html` and returns an HTML string with every external
 * CSS `<link>` and JS `<script src="...">` replaced by inline equivalents,
 * producing a fully self-contained single-file document.
 */
async function inlineAssets(distDir: string): Promise<string> {
  let html = await readFile(join(distDir, 'index.html'), 'utf-8');

  // <link rel="stylesheet" ... href="/assets/xxx.css"> → <style>...</style>
  html = await replaceAsync(
    html,
    /<link\b[^>]*\bhref="(\/[^"]+\.css)"[^>]*>/gi,
    async (originalTag, href) => {
      const filePath = join(distDir, href);
      if (!existsSync(filePath)) return originalTag; // safe fallback
      const css = await readFile(filePath, 'utf-8');
      return `<style>${css}</style>`;
    },
  );

  // <script type="module" ... src="/assets/xxx.js"></script> → <script type="module">...</script>
  html = await replaceAsync(
    html,
    /<script\b([^>]*)src="(\/[^"]+\.js)"([^>]*)><\/script>/gi,
    async (originalTag, before, src, after) => {
      const filePath = join(distDir, src);
      if (!existsSync(filePath)) return originalTag;
      const js = await readFile(filePath, 'utf-8');
      // Rebuild attrs — strip src= and crossorigin (irrelevant once inlined)
      const attrs = (before + ' ' + after)
        .replace(/\s*src="[^"]*"/g, '')
        .replace(/\s*crossorigin\b/gi, '')
        .trim();
      return `<script${attrs ? ' ' + attrs : ''}>${js}</script>`;
    },
  );

  return html;
}

// ── SSR Rendering ───────────────────────────────────────────────────────────

/**
 * Server-side renders the root component using Svelte 5's `render()` from
 * `svelte/server`. Works by:
 *   1. Writing a temporary TypeScript entry that calls render() and prints JSON.
 *   2. Running `vite build --ssr` on it (the user's vite.config.ts handles Svelte SSR).
 *   3. Executing the output bundle with Node and parsing its stdout.
 *
 * Temp files are always cleaned up in a finally block.
 */
async function renderSSR(
  projectDir: string,
  appEntry: string,
  viteBin: string,
): Promise<SSRResult> {
  const tempDir = join(projectDir, '.svelte-bundle');
  const ssrEntryPath = join(tempDir, 'entry-ssr.ts');
  const ssrOutDir = join(tempDir, '.ssr-out');

  await ensureDir(tempDir);

  // Relative import path from .svelte-bundle/ to the user's root component
  const entryRelative = relative(tempDir, join(projectDir, appEntry)).replace(/\\/g, '/');

  const ssrSource = [
    `import { render } from 'svelte/server';`,
    `import App from '${entryRelative}';`,
    `const { html, head } = render(App, { props: {} });`,
    `process.stdout.write(JSON.stringify({ html, head }));`,
  ].join('\n');

  await writeFile(ssrEntryPath, ssrSource, 'utf-8');

  try {
    logger.step('Running SSR vite build...');
    const buildResult = run(
      viteBin,
      ['build', '--ssr', ssrEntryPath, '--outDir', ssrOutDir],
      projectDir,
      'pipe',
    );

    if (buildResult.exitCode !== 0) {
      throw new Error(
        `SSR vite build failed:\n${buildResult.stderr || buildResult.stdout}`,
      );
    }

    const ssrBundlePath = join(ssrOutDir, 'entry-ssr.js');

    logger.step('Executing SSR render...');
    const execResult = run('node', [ssrBundlePath], projectDir, 'pipe');

    if (execResult.exitCode !== 0) {
      throw new Error(`SSR execution failed:\n${execResult.stderr}`);
    }

    const parsed = JSON.parse(execResult.stdout) as unknown;

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('html' in parsed) ||
      !('head' in parsed)
    ) {
      throw new Error(`Unexpected SSR output format: ${execResult.stdout}`);
    }

    const obj = parsed as Record<string, unknown>;
    return {
      html: String(obj['html']),
      head: String(obj['head']),
    };
  } finally {
    await rm(ssrEntryPath, { force: true });
    await rm(ssrOutDir, { recursive: true, force: true });
  }
}

/**
 * Injects SSR pre-rendered content into the already-inlined HTML string:
 *   - `ssr.html` is placed inside `<div id="app">…</div>`
 *   - `ssr.head` (from `<svelte:head>`) is appended before `</head>`
 */
function injectSSRContent(html: string, ssr: SSRResult): string {
  let result = html;

  result = result.replace(
    /(<div\b[^>]*\bid="app"[^>]*>)<\/div>/i,
    `$1${ssr.html}</div>`,
  );

  if (ssr.head.trim().length > 0) {
    result = result.replace('</head>', `  ${ssr.head}\n</head>`);
  }

  return result;
}

// ── Command definition ──────────────────────────────────────────────────────

export const buildCommand = defineCommand({
  meta: {
    name: 'build',
    description: 'Build the project into a single self-contained HTML file',
  },
  args: {
    hydrate: {
      type: 'boolean',
      description: 'Pre-render with Svelte SSR for SEO-friendly output',
      default: false,
    },
    entry: {
      type: 'string',
      description: 'Root component for SSR pre-rendering (default: src/App.svelte)',
      default: 'src/App.svelte',
    },
    outfile: {
      type: 'string',
      description: 'Output HTML file path (default: dist/index.html)',
      default: 'dist/index.html',
    },
    mode: {
      type: 'string',
      description: 'Vite build mode (default: production)',
      default: 'production',
      alias: 'm',
    },
  },
  async run({ args }) {
    const projectDir = process.cwd();
    const viteBin = resolveViteBin(projectDir);
    const distDir = resolve(projectDir, 'dist');
    const outfile = resolve(projectDir, args.outfile ?? 'dist/index.html');

    const hasViteConfig =
      existsSync(join(projectDir, 'vite.config.ts')) ||
      existsSync(join(projectDir, 'vite.config.js'));

    if (!hasViteConfig) {
      logger.error('No vite.config.ts found. Run svelte-bundle build from inside a project.');
      process.exit(1);
    }

    // ── Step 1: Standard client build ─────────────────────────────────────
    logger.info(pc.bold('Building client bundle...'));
    const { exitCode } = run(
      viteBin,
      ['build', '--mode', args.mode ?? 'production'],
      projectDir,
    );
    if (exitCode !== 0) {
      logger.error('Client build failed.');
      process.exit(exitCode);
    }

    // ── Step 2: Inline all CSS and JS into index.html ──────────────────────
    logger.step('Inlining CSS and JS assets...');
    let html = await inlineAssets(distDir);

    // ── Step 3: SSR pre-rendering (optional) ──────────────────────────────
    if (args.hydrate) {
      logger.info(pc.bold('Running SSR pre-render...'));
      const appEntry = args.entry ?? 'src/App.svelte';

      if (!existsSync(join(projectDir, appEntry))) {
        logger.error(`SSR entry component not found: ${pc.cyan(appEntry)}`);
        process.exit(1);
      }

      const ssrResult = await renderSSR(projectDir, appEntry, viteBin);
      html = injectSSRContent(html, ssrResult);
      logger.success('SSR content injected.');
    }

    // ── Step 4: Write final output ─────────────────────────────────────────
    await ensureDir(dirname(outfile));
    await writeFile(outfile, html, 'utf-8');

    const relOut = relative(projectDir, outfile);
    logger.success(`Output → ${pc.cyan(relOut)}`);
  },
});
