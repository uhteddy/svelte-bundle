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

// Add check for node version
const nodeVersion = process.versions.node;
const [major] = nodeVersion.split('.').map(Number);
if (major < 18) {
  console.error(chalk.red(`Error: Node.js version 18 or higher is required. Current version: ${nodeVersion}`));
  process.exit(1);
}

program
  .name('svelte-bundle')
  .description(packageJson.description)
  .version(packageJson.version)
  .requiredOption('-i, --input <path>', 'Input Svelte file')
  .option('-o, --output <path>', 'Output directory (defaults to current directory)')
  .option('--tw', 'Enable Tailwind CSS processing')
  .option('--tw-config <path>', 'Path to custom Tailwind config file')
  .option('-f, --force', 'Force overwrite without asking');

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

    console.log(chalk.blue('Starting build process...'));
    console.log(chalk.gray(`Input: ${inputPath}`));
    console.log(chalk.gray(`Output directory: ${outputDir}`));
    if (options.tw) {
      console.log(chalk.gray('Tailwind CSS enabled'));
    }

    const buildOptions = {
      useTailwind: options.tw || false,
      tailwindConfig: tailwindConfig
    };

    await buildStaticFile(inputPath, outputDir, buildOptions);

    console.log(chalk.green('\n✨ Build completed successfully!'));
    console.log(chalk.gray(`Output file: ${outputPath}`));
  } catch (error) {
    console.error(chalk.red('\nBuild failed:'));
    console.error(chalk.red(error.message));
    if (error.stack) {
      console.error(chalk.gray(error.stack));
    }
    process.exit(1);
  } finally {
    rl.close();
  }
}

validateAndProcess();