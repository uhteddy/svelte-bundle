#!/usr/bin/env node
import { program } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs/promises';
import { createInterface } from 'readline';
import { buildStaticFile } from './bundle.js';
import { fileURLToPath } from 'url';

// Get package.json data
import { readFile } from 'fs/promises';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read package.json
const packageJson = JSON.parse(
  await readFile(
    new URL('./package.json', import.meta.url)
  )
);

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

program
  .name('svelte-bundle')
  .description(packageJson.description)
  .version(packageJson.version)
  .requiredOption('-i, --input <path>', 'Input Svelte file')
  .option('-o, --output <path>', 'Output directory (defaults to current directory)')
  .option('--tw', 'Enable Tailwind CSS processing')
  .option('--tw-config <path>', 'Path to custom Tailwind config file')
  .option('-f, --force', 'Force overwrite without asking')
  .option('--svelte-version <version>', 'Specify Svelte version (3 or 5)', '3')
  .option('--dev', 'Enable development mode')
  .option('--preserve-comments', 'Preserve HTML comments')
  .option('--preserve-whitespace', 'Preserve whitespace')
  .option('--sourcemap', 'Generate sourcemaps');

program.parse();

const options = program.opts();

async function loadTailwindConfig(configPath) {
  const fullPath = path.resolve(configPath);
  try {
    const { default: config } = await import(fullPath);
    return config;
  } catch (error) {
    console.error(chalk.red(`Error loading Tailwind config: ${error.message}`));
    process.exit(1);
  }
}

async function validateAndProcess() {
  try {
    // Validate Svelte version
    const svelteVersion = options.svelteVersion;
    if (!['3', '5'].includes(svelteVersion)) {
      console.error(chalk.red('Error: Svelte version must be either 3 or 5'));
      process.exit(1);
    }

    // Validate input file
    const inputPath = path.resolve(options.input);
    const inputExt = path.extname(inputPath);
    
    if (inputExt !== '.svelte') {
      console.error(chalk.red('Error: Input file must be a .svelte file'));
      process.exit(1);
    }

    // Check if input file exists
    try {
      await fs.access(inputPath);
    } catch {
      console.error(chalk.red(`Error: Input file ${inputPath} does not exist`));
      process.exit(1);
    }

    // Handle Tailwind configuration
    let tailwindConfig = null;
    if (options.tw) {
      if (options.twConfig) {
        try {
          tailwindConfig = await loadTailwindConfig(options.twConfig);
          console.log(chalk.blue('Using custom Tailwind configuration'));
        } catch (error) {
          console.error(chalk.red(`Error loading Tailwind config: ${error.message}`));
          process.exit(1);
        }
      } else {
        console.log(chalk.blue('Using default Tailwind configuration'));
      }
    }

    // Validate Tailwind config usage
    if (options.twConfig && !options.tw) {
      console.error(chalk.yellow('Warning: Tailwind config provided but Tailwind is not enabled. Use --tw to enable Tailwind.'));
      process.exit(1);
    }

    // Determine output directory
    let outputDir = process.cwd();
    if (options.output) {
      outputDir = path.resolve(options.output);
    }

    const outputPath = path.join(outputDir, 'output.html');

    // Check if output file exists
    if (await fs.access(outputPath).then(() => true).catch(() => false)) {
      if (!options.force) {
        const shouldProceed = await question(
          chalk.yellow(`File ${outputPath} already exists. Overwrite? (y/N): `)
        );
        if (shouldProceed.toLowerCase() !== 'y') {
          console.log(chalk.yellow('Operation cancelled.'));
          process.exit(0);
        }
      }
    }

    // Log configuration
    console.log(chalk.blue('Starting build process...'));
    console.log(chalk.gray(`Input: ${inputPath}`));
    console.log(chalk.gray(`Output directory: ${outputDir}`));
    console.log(chalk.gray(`Svelte version: ${svelteVersion}`));
    if (options.dev) {
      console.log(chalk.gray('Development mode enabled'));
    }
    if (options.preserveComments) {
      console.log(chalk.gray('Preserving HTML comments'));
    }
    if (options.preserveWhitespace) {
      console.log(chalk.gray('Preserving whitespace'));
    }
    if (options.sourcemap) {
      console.log(chalk.gray('Generating sourcemaps'));
    }
    if (options.tw) {
      console.log(chalk.gray('Tailwind CSS enabled'));
    }

    const buildOptions = {
      useTailwind: options.tw || false,
      tailwindConfig: tailwindConfig,
      svelteVersion: parseInt(svelteVersion),
      dev: options.dev || false,
      preserveComments: options.preserveComments || false,
      preserveWhitespace: options.preserveWhitespace || false,
      sourcemap: options.sourcemap || false
    };

    await buildStaticFile(inputPath, outputDir, buildOptions);

    console.log(chalk.green('\n✨ Build completed successfully!'));
    console.log(chalk.gray(`Output file: ${outputPath}`));
  } catch (error) {
    console.error(chalk.red('\nBuild failed:'));
    console.error(chalk.red(error.message));
    process.exit(1);
  } finally {
    rl.close();
  }
}

validateAndProcess();