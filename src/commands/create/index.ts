import { defineCommand } from 'citty';
import { dirname, join, resolve } from 'node:path';
import type { ProjectTemplate } from '../../types.ts';
import { runCreatePrompts } from './prompts.ts';
import { scaffold } from './scaffold.ts';
import { logger } from '../../utils/logger.ts';
import pc from 'picocolors';

const SUPPORTED_TEMPLATES = ['default'] as const satisfies readonly ProjectTemplate[];

/**
 * Resolves the templates directory relative to the CLI entry file.
 *
 * Bun bundles all source into a single flat `dist/cli.js`, so `import.meta.url`
 * inside any bundled module points to `dist/cli.js` — NOT to the original source
 * file's location. Using `process.argv[1]` (the actual entry file on disk) is more
 * reliable: it is always one directory below the package root, whether the CLI runs
 * as `node dist/cli.js`, `bun run src/cli.ts`, or a globally-installed `svelte-bundle`.
 */
function getTemplatesDir(): string {
  const argv1 = process.argv[1];
  if (argv1 === undefined) {
    throw new Error('Cannot determine CLI entry location from process.argv[1].');
  }
  // argv[1] is always the entry file (e.g. dist/cli.js or src/cli.ts).
  // Both live exactly one level below the package root → ../templates.
  return resolve(dirname(argv1), '..', 'templates');
}

export const createCommand = defineCommand({
  meta: {
    name: 'create',
    description: 'Scaffold a new Vite + Svelte project',
  },
  args: {
    name: {
      type: 'positional',
      description: 'Project name (also used as the directory name)',
      required: false,
    },
    template: {
      type: 'string',
      description: `Template to use (${SUPPORTED_TEMPLATES.join(', ')})`,
      default: 'default',
      alias: 't',
    },
    pm: {
      type: 'string',
      description: 'Package manager: bun | npm | pnpm | yarn',
    },
    'no-install': {
      type: 'boolean',
      description: 'Skip dependency installation',
      default: false,
    },
    'no-git': {
      type: 'boolean',
      description: 'Skip git repository initialization',
      default: false,
    },
  },
  async run({ args }) {
    const template = args.template ?? 'default';

    if (!SUPPORTED_TEMPLATES.includes(template as ProjectTemplate)) {
      logger.error(
        `Unknown template "${template}". Supported: ${SUPPORTED_TEMPLATES.join(', ')}.`,
      );
      process.exit(1);
    }

    const answers = await runCreatePrompts(args.name, args.pm);

    const targetDir = resolve(process.cwd(), answers.name);
    const templateDir = join(getTemplatesDir(), template);

    await scaffold({
      ...answers,
      // Override git/install if flags were passed
      git: args['no-git'] ? false : answers.git,
      install: args['no-install'] ? false : answers.install,
      targetDir,
      templateDir,
    });

    const relativeDir = answers.name;
    const installCmd = answers.install ? '' : `\n  ${pc.cyan(answers.packageManager + ' install')}`;
    const devCmd = `  ${pc.cyan('cd ' + relativeDir)}\n  ${pc.cyan('npm run dev')}`;

    console.log('');
    console.log(pc.bold('Next steps:'));
    console.log(installCmd + devCmd);
    console.log('');
    console.log(pc.dim('Happy coding!'));
  },
});
