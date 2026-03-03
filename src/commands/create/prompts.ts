import {
  cancel,
  confirm,
  intro,
  isCancel,
  multiselect,
  outro,
  select,
  text,
} from '@clack/prompts';
import pc from 'picocolors';
import type { CreatePromptAnswers, OptionalFeature, PackageManager } from '../../types.ts';
import { toValidPackageName, validatePackageName } from '../../utils/validate.ts';

/**
 * Asserts that a @clack/prompts return value is not a cancellation symbol.
 * Prints a cancellation message and exits if it is.
 */
function assertNotCancelled<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel('Operation cancelled.');
    process.exit(0);
  }
  return value;
}

/** Runs the full interactive prompt sequence for `svelte-bundle create`. */
export async function runCreatePrompts(
  nameArg: string | undefined,
  pmArg: string | undefined,
): Promise<CreatePromptAnswers> {
  intro(pc.bgCyan(pc.black(' svelte-bundle ')) + pc.dim(' v0.2.0'));

  // --- Project name ---
  let name: string;

  if (nameArg !== undefined && nameArg.length > 0) {
    const validationError = validatePackageName(nameArg);
    if (validationError !== null) {
      cancel(validationError);
      process.exit(1);
    }
    name = nameArg;
  } else {
    const rawName = assertNotCancelled(
      await text({
        message: 'Project name:',
        placeholder: 'my-svelte-app',
        validate(value) {
          return validatePackageName(value) ?? undefined;
        },
      }),
    );
    name = toValidPackageName(rawName);
  }

  // --- Package manager ---
  let packageManager: PackageManager;

  if (pmArg !== undefined) {
    const validPMs = ['bun', 'npm', 'pnpm', 'yarn'] as const satisfies readonly PackageManager[];
    const matched = validPMs.find((pm) => pm === pmArg);
    if (matched === undefined) {
      cancel(`Unknown package manager "${pmArg}". Must be one of: bun, npm, pnpm, yarn.`);
      process.exit(1);
    }
    packageManager = matched;
  } else {
    packageManager = assertNotCancelled(
      await select<PackageManager>({
        message: 'Package manager:',
        options: [
          { value: 'bun', label: 'bun', hint: 'recommended' },
          { value: 'npm', label: 'npm' },
          { value: 'pnpm', label: 'pnpm' },
          { value: 'yarn', label: 'yarn' },
        ],
      }),
    );
  }

  // --- Optional features ---
  const features = assertNotCancelled(
    await multiselect<OptionalFeature>({
      message: 'Add optional features: (space to toggle, enter to confirm)',
      options: [
        { value: 'tailwind', label: 'Tailwind CSS', hint: 'utility-first CSS framework' },
        { value: 'eslint', label: 'ESLint', hint: 'code linting' },
        { value: 'prettier', label: 'Prettier', hint: 'code formatting' },
        { value: 'vitest', label: 'Vitest', hint: 'unit testing' },
      ],
      required: false,
    }),
  );

  // --- Git init ---
  const git = assertNotCancelled(
    await confirm({
      message: 'Initialize a git repository?',
      initialValue: true,
    }),
  );

  // --- Install dependencies ---
  const install = assertNotCancelled(
    await confirm({
      message: `Install dependencies now? (${pc.cyan(packageManager)} install)`,
      initialValue: true,
    }),
  );

  outro(pc.green('Configuration complete!'));

  return {
    name,
    packageManager,
    features,
    git,
    install,
  } as const;
}
