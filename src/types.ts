// All shared types for svelte-bundle CLI.
// Every interface uses readonly properties — no mutable state leaks through the type system.

export type PackageManager = 'bun' | 'npm' | 'pnpm' | 'yarn';

export type ProjectTemplate = 'default';

export type OutputFormat = 'es' | 'cjs';

export type OptionalFeature = 'tailwind' | 'eslint' | 'prettier' | 'vitest';

/** Answers collected from the interactive create prompts. */
export interface CreatePromptAnswers {
  readonly name: string;
  readonly packageManager: PackageManager;
  readonly features: readonly OptionalFeature[];
  readonly git: boolean;
  readonly install: boolean;
}

/** Full context passed to the scaffolding step. */
export interface ScaffoldContext extends CreatePromptAnswers {
  readonly targetDir: string;
  readonly templateDir: string;
}

/** Configuration for the build command. */
export interface BuildConfig {
  readonly entry: string;
  readonly outDir: string;
  readonly formats: readonly OutputFormat[];
  readonly sourcemap: boolean;
  readonly minify: boolean;
}

/** A single template variable substitution. */
export interface TemplateVar {
  readonly placeholder: string;
  readonly value: string;
}
