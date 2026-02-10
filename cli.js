#!/usr/bin/env node
import { program } from "commander";
import chalk from "chalk";
import path from "path";
import fs from "fs/promises";
import { createInterface } from "readline";
import { buildStaticFile } from "./bundle.js";
import { fileURLToPath } from "url";
import { readFile } from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read package.json
const packageJson = JSON.parse(
  await readFile(new URL("./package.json", import.meta.url)),
);

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query) =>
  new Promise((resolve) => rl.question(query, resolve));

// Validate Node.js version
const nodeVersion = process.versions.node;
const [major] = nodeVersion.split(".").map(Number);
if (major < 18) {
  console.error(
    chalk.red(`✗ Error: Node.js 18+ required (current: ${nodeVersion})`),
  );
  process.exit(1);
}

// Display banner
function displayBanner() {
  console.log(chalk.cyan.bold("\n╔════════════════════════════════════════╗"));
  console.log(
    chalk.cyan.bold("║        ") +
      chalk.white.bold("SVELTE BUNDLE") +
      chalk.cyan.bold("             ║"),
  );
  console.log(chalk.cyan.bold("╚════════════════════════════════════════╝\n"));
}

// Configure CLI
program
  .name("svelte-bundle")
  .description(chalk.gray(packageJson.description))
  .version(packageJson.version)
  .requiredOption("-i, --input <path>", "Input Svelte file")
  .option(
    "-o, --output <path>",
    "Output directory (default: current directory)",
  )
  .option("--tw", "Enable Tailwind CSS processing")
  .option("--tw-config <path>", "Path to custom Tailwind config")
  .option("-f, --force", "Force overwrite without confirmation")
  .option("-v, --verbose", "Show detailed build output and warnings")
  .addHelpText(
    "after",
    `
${chalk.cyan("Examples:")}
  ${chalk.gray("# Basic usage")}
  $ svelte-bundle -i App.svelte

  ${chalk.gray("# With output directory")}
  $ svelte-bundle -i App.svelte -o dist

  ${chalk.gray("# With Tailwind CSS")}
  $ svelte-bundle -i App.svelte --tw

  ${chalk.gray("# With custom Tailwind config")}
  $ svelte-bundle -i App.svelte --tw --tw-config tailwind.config.js

  ${chalk.gray("# With verbose output")}
  $ svelte-bundle -i App.svelte -v
`,
  );

program.parse();
const options = program.opts();

/**
 * Loads a Tailwind configuration file
 */
async function loadTailwindConfig(configPath) {
  const fullPath = path.resolve(configPath);
  try {
    const { default: config } = await import(fullPath);
    return config;
  } catch (error) {
    throw new Error(`Failed to load Tailwind config: ${error.message}`);
  }
}

/**
 * Validates the input file exists and is a .svelte file
 */
async function validateInput(inputPath) {
  if (path.extname(inputPath) !== ".svelte") {
    throw new Error("Input file must have a .svelte extension");
  }

  try {
    await fs.access(inputPath);
  } catch {
    throw new Error(`Input file not found: ${inputPath}`);
  }
}

/**
 * Checks if output file exists and prompts for overwrite if needed
 */
async function checkOutputExists(outputPath, force) {
  const exists = await fs
    .access(outputPath)
    .then(() => true)
    .catch(() => false);

  if (exists && !force) {
    const response = await question(
      chalk.yellow(
        `\n⚠  File ${chalk.white(path.basename(outputPath))} already exists. Overwrite? (y/N): `,
      ),
    );
    if (response.toLowerCase() !== "y") {
      console.log(chalk.gray("\nOperation cancelled."));
      process.exit(0);
    }
  }
}

/**
 * Displays build configuration summary
 */
function displayBuildInfo(inputPath, outputDir, useTailwind) {
  console.log(chalk.cyan("Build Configuration:"));
  console.log(chalk.gray("┌─────────────────────────────────────────"));
  console.log(
    chalk.gray("│ Input:    ") +
      chalk.white(path.relative(process.cwd(), inputPath)),
  );
  console.log(
    chalk.gray("│ Output:   ") +
      chalk.white(path.relative(process.cwd(), outputDir)),
  );
  console.log(
    chalk.gray("│ Tailwind: ") +
      (useTailwind ? chalk.green("✓ Enabled") : chalk.gray("✗ Disabled")),
  );
  console.log(chalk.gray("└─────────────────────────────────────────\n"));
}

/**
 * Main validation and build process
 */
async function validateAndProcess() {
  try {
    displayBanner();

    // Resolve paths
    const inputPath = path.resolve(options.input);
    const outputDir = options.output
      ? path.resolve(options.output)
      : process.cwd();
    const outputPath = path.join(outputDir, "output.html");

    // Validate input file
    await validateInput(inputPath);

    // Handle Tailwind configuration
    let tailwindConfig = null;
    if (options.tw && options.twConfig) {
      tailwindConfig = await loadTailwindConfig(options.twConfig);
      console.log(chalk.green("✓ Loaded custom Tailwind configuration\n"));
    } else if (options.twConfig && !options.tw) {
      throw new Error("Tailwind config provided but --tw flag not set");
    }

    // Check if output file exists
    await checkOutputExists(outputPath, options.force);

    // Display build configuration
    displayBuildInfo(inputPath, outputDir, options.tw);

    // Start build process
    console.log(chalk.cyan("⚡ Building..."));
    const startTime = Date.now();

    const buildOptions = {
      useTailwind: options.tw || false,
      tailwindConfig: tailwindConfig,
      verbose: options.verbose || false,
    };

    await buildStaticFile(inputPath, outputDir, buildOptions);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Success message
    console.log(chalk.green("\n✓ Build completed successfully!"));
    console.log(chalk.gray(`  Time: ${duration}s`));
    console.log(
      chalk.gray(
        `  Output: ${chalk.white(path.relative(process.cwd(), outputPath))}\n`,
      ),
    );
  } catch (error) {
    console.log(chalk.red("\n✗ Build failed\n"));
    console.error(chalk.red("Error: ") + chalk.white(error.message));

    if (process.env.DEBUG) {
      console.error(chalk.gray("\nStack trace:"));
      console.error(chalk.gray(error.stack));
    }

    process.exit(1);
  } finally {
    rl.close();
  }
}

validateAndProcess();
