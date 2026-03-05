import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  BuildFlag,
  OptionalFeature,
  PackageManager,
  ScaffoldContext,
} from "../../types.ts";
import { copyDir, ensureDir, pathExists } from "../../utils/fs.ts";
import { logger } from "../../utils/logger.ts";

import { version } from "../../../package.json";

// ---------------------------------------------------------------------------
// Template variable substitution
// ---------------------------------------------------------------------------

const TEMPLATE_VARS = {
  "{{PROJECT_NAME}}": (ctx: ScaffoldContext) => ctx.name,
} as const satisfies Record<string, (ctx: ScaffoldContext) => string>;

function applyTemplateVars(content: string, ctx: ScaffoldContext): string {
  let result = content;
  for (const [placeholder, getValue] of Object.entries(TEMPLATE_VARS)) {
    result = result.replaceAll(placeholder, getValue(ctx));
  }
  return result;
}

// ---------------------------------------------------------------------------
// Optional feature additions
// ---------------------------------------------------------------------------

interface FeatureAdditions {
  readonly devDependencies: Record<string, string>;
  readonly extraFiles: ReadonlyArray<{
    readonly path: string;
    readonly content: string;
  }>;
}

const FEATURE_ADDITIONS = {
  tailwind: {
    devDependencies: {
      tailwindcss: "^4.0.0",
      "@tailwindcss/vite": "^4.0.0",
    },
    extraFiles: [
      {
        path: "src/app.css",
        content: '@import "tailwindcss";\n',
      },
    ],
  },
  eslint: {
    devDependencies: {
      eslint: "^9.0.0",
      "@eslint/js": "^9.0.0",
      "typescript-eslint": "^8.0.0",
      "eslint-plugin-svelte": "^2.0.0",
    },
    extraFiles: [
      {
        path: "eslint.config.js",
        content: `import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';

/** @type {import('eslint').Linter.Config[]} */
export default [
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs['flat/recommended'],
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: {
        parser: ts.parser,
      },
    },
  },
  {
    ignores: ['dist/', 'node_modules/'],
  },
];
`,
      },
    ],
  },
  prettier: {
    devDependencies: {
      prettier: "^3.0.0",
      "prettier-plugin-svelte": "^3.0.0",
    },
    extraFiles: [
      {
        path: ".prettierrc",
        content:
          JSON.stringify(
            {
              plugins: ["prettier-plugin-svelte"],
              overrides: [{ files: "*.svelte", options: { parser: "svelte" } }],
              singleQuote: true,
              trailingComma: "all",
              printWidth: 100,
            },
            null,
            2,
          ) + "\n",
      },
    ],
  },
  vitest: {
    devDependencies: {
      vitest: "^3.0.0",
      "@vitest/ui": "^3.0.0",
    },
    extraFiles: [
      {
        path: "src/tests/example.test.ts",
        content: `import { describe, expect, it } from 'vitest';

describe('example', () => {
  it('should pass', () => {
    expect(true).toBe(true);
  });
});
`,
      },
    ],
  },
  playwright: {
    devDependencies: {
      "@playwright/test": "^1.0.0",
    },
    extraFiles: [
      {
        path: "playwright.config.ts",
        content: `import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'vite',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
`,
      },
      {
        path: "e2e/example.test.ts",
        content: `import { expect, test } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Vite/);
});
`,
      },
    ],
  },
} as const satisfies Record<OptionalFeature, FeatureAdditions>;

// ---------------------------------------------------------------------------
// Build script construction
// ---------------------------------------------------------------------------

const BUILD_FLAG_ARGS = {
  hydrate: "--hydrate",
  "inline-assets": "--inline-assets",
  "mode-development": "--mode development",
} as const satisfies Record<BuildFlag, string>;

function buildScript(flags: readonly BuildFlag[]): string {
  const args = flags.map((f) => BUILD_FLAG_ARGS[f]);
  return args.length > 0 ? `svelte-bundle build ${args.join(" ")}` : "svelte-bundle build";
}

// ---------------------------------------------------------------------------
// Package.json merging
// ---------------------------------------------------------------------------

type PackageJsonShape = {
  name: string;
  version: string;
  private: boolean;
  type: string;
  scripts: Record<string, string>;
  devDependencies: Record<string, string>;
};

export function buildPackageJson(ctx: ScaffoldContext): string {
  const pkg: PackageJsonShape = {
    name: ctx.name,
    version: "0.0.1",
    private: true,
    type: "module",
    scripts: {
      dev: "vite",
      build: buildScript(ctx.buildFlags),
      preview: "vite preview",
      "type-check": "tsc --noEmit",
    },
    devDependencies: {
      "@sveltejs/vite-plugin-svelte": "^5.0.0",
      svelte: "^5.0.0",
      typescript: "^5.0.0",
      vite: "^6.0.0",
      "svelte-bundle": `^${version}`,
    },
  };

  for (const feature of ctx.features) {
    const additions = FEATURE_ADDITIONS[feature];
    Object.assign(pkg.devDependencies, additions.devDependencies);
  }

  if (ctx.features.includes("vitest")) {
    pkg.scripts["test"] = "vitest";
    pkg.scripts["test:ui"] = "vitest --ui";
  }

  if (ctx.features.includes("playwright")) {
    pkg.scripts["test:e2e"] = "playwright test";
    pkg.scripts["test:e2e:ui"] = "playwright test --ui";
  }

  return JSON.stringify(pkg, null, 2) + "\n";
}

// ---------------------------------------------------------------------------
// Vite config generation
// ---------------------------------------------------------------------------

export function buildViteConfig(ctx: ScaffoldContext): string {
  const hasTailwind = ctx.features.includes("tailwind");

  const imports = [
    "import { defineConfig } from 'vite';",
    "import { svelte } from '@sveltejs/vite-plugin-svelte';",
  ];
  if (hasTailwind) {
    imports.push("import tailwindcss from '@tailwindcss/vite';");
  }

  const plugins = hasTailwind ? ["tailwindcss()", "svelte()"] : ["svelte()"];

  return `${imports.join("\n")}

export default defineConfig({
  plugins: [${plugins.join(", ")}],
  esbuild: {
    // Strip all legal/license comments (e.g. from lucide-svelte) from JS and CSS
    legalComments: 'none',
    comments: false,
  },
});
`;
}

// ---------------------------------------------------------------------------
// Install command
// ---------------------------------------------------------------------------

const INSTALL_COMMANDS = {
  bun: ["bun", "install"],
  npm: ["npm", "install"],
  pnpm: ["pnpm", "install"],
  yarn: ["yarn"],
} as const satisfies Record<PackageManager, readonly string[]>;

// ---------------------------------------------------------------------------
// Main scaffold function
// ---------------------------------------------------------------------------

/** Scaffolds the full project into `ctx.targetDir`. */
export async function scaffold(ctx: ScaffoldContext): Promise<void> {
  logger.step(`Creating project in ${ctx.targetDir}`);

  if (await pathExists(ctx.targetDir)) {
    logger.error(`Directory "${ctx.targetDir}" already exists.`);
    process.exit(1);
  }

  await ensureDir(ctx.targetDir);

  // Copy base template (excluding _package.json and _vite.config.ts — we generate those)
  const GENERATED_FILENAMES = new Set(["_package.json", "_vite.config.ts"]);

  await copyDir(ctx.templateDir, ctx.targetDir, (content, filename) => {
    if (GENERATED_FILENAMES.has(filename)) return content;
    return applyTemplateVars(content, ctx);
  });

  // Write generated files
  await writeFile(
    join(ctx.targetDir, "package.json"),
    buildPackageJson(ctx),
    "utf-8",
  );
  await writeFile(
    join(ctx.targetDir, "vite.config.ts"),
    buildViteConfig(ctx),
    "utf-8",
  );

  // Write extra feature files
  for (const feature of ctx.features) {
    const additions = FEATURE_ADDITIONS[feature];
    for (const extraFile of additions.extraFiles) {
      const filePath = join(ctx.targetDir, extraFile.path);
      const dir = join(filePath, "..");
      await ensureDir(dir);
      await writeFile(filePath, extraFile.content, "utf-8");
    }
  }

  logger.success("Project files written.");

  // Git init
  if (ctx.git) {
    logger.step("Initializing git repository...");
    const gitResult = spawnSync("git", ["init"], {
      cwd: ctx.targetDir,
      stdio: "pipe",
    });
    if (gitResult.status === 0) {
      spawnSync("git", ["add", "-A"], { cwd: ctx.targetDir, stdio: "pipe" });
      spawnSync(
        "git",
        ["commit", "-m", "chore: initial commit from svelte-bundle"],
        {
          cwd: ctx.targetDir,
          stdio: "pipe",
        },
      );
      logger.success("Git repository initialized.");
    } else {
      logger.warn("git init failed — skipping.");
    }
  }

  // Install
  if (ctx.install) {
    const installCmd = INSTALL_COMMANDS[ctx.packageManager];
    const [bin, ...args] = installCmd;
    if (bin === undefined) {
      logger.error("Internal error: install command is empty.");
      process.exit(1);
    }
    logger.step(`Running ${installCmd.join(" ")}...`);
    const installResult = spawnSync(bin, args, {
      cwd: ctx.targetDir,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    if (installResult.status !== 0) {
      logger.warn(
        "Dependency installation failed. Run the install command manually.",
      );
    } else {
      logger.success("Dependencies installed.");
    }
  }
}
