import { defineCommand } from 'citty';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { logger } from '../../utils/logger.ts';
import pc from 'picocolors';

/** Resolves the vite binary to use: prefers the project-local install. */
function resolveViteBin(): string {
  const local = join(process.cwd(), 'node_modules', '.bin', 'vite');
  if (existsSync(local)) return local;
  return 'vite'; // fall back to global PATH
}

export const buildCommand = defineCommand({
  meta: {
    name: 'build',
    description: 'Build the project using Vite',
  },
  args: {
    mode: {
      type: 'string',
      description: 'Vite build mode (default: "production")',
      default: 'production',
      alias: 'm',
    },
    watch: {
      type: 'boolean',
      description: 'Enable watch mode',
      default: false,
      alias: 'w',
    },
    sourcemap: {
      type: 'boolean',
      description: 'Emit source maps',
      default: false,
    },
    minify: {
      type: 'boolean',
      description: 'Minify output (default: true)',
      default: true,
    },
    outDir: {
      type: 'string',
      description: 'Output directory (overrides vite.config.ts)',
    },
  },
  run({ args }) {
    const viteBin = resolveViteBin();

    const viteArgs: string[] = ['build'];

    if (args.mode !== 'production') {
      viteArgs.push('--mode', args.mode);
    }

    if (args.watch) {
      viteArgs.push('--watch');
    }

    if (args.sourcemap) {
      viteArgs.push('--sourcemap');
    }

    if (!args.minify) {
      viteArgs.push('--minify', 'false');
    }

    if (args.outDir !== undefined) {
      viteArgs.push('--outDir', args.outDir);
    }

    logger.info(`Running ${pc.cyan(viteBin + ' ' + viteArgs.join(' '))}`);

    const result = spawnSync(viteBin, viteArgs, {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    const exitCode = result.status ?? 1;

    if (exitCode !== 0) {
      logger.error('Build failed.');
    } else {
      logger.success('Build complete.');
    }

    process.exit(exitCode);
  },
});
