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

// Create readline interface for prompts
const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

// Promisify readline question
const question = (query) => new Promise((resolve) => rl.question(query, resolve));

program
  .name('svelte-bundle')
  .description(packageJson.description)
  .version(packageJson.version)
  .requiredOption('-i, --input <path>', 'Input Svelte file')
  .option('-o, --output <path>', 'Output directory (defaults to current directory)')
  .option('-f, --force', 'Force overwrite without asking');

program.parse();

const options = program.opts();

async function checkFileExists(filepath) {
  try {
    await fs.access(filepath);
    return true;
  } catch {
    return false;
  }
}

async function shouldOverwrite(filepath) {
  const answer = await question(
    chalk.yellow(`File ${filepath} already exists. Overwrite? (y/N): `)
  );
  return answer.toLowerCase() === 'y';
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

    // Determine output directory and file path
    let outputDir = process.cwd();
    if (options.output) {
      outputDir = path.resolve(options.output);
      // Create output directory if it doesn't exist
      await fs.mkdir(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, 'output.html');

    // Check if output file exists and handle overwriting
    if (await checkFileExists(outputPath)) {
      if (!options.force) {
        const shouldProceed = await shouldOverwrite(outputPath);
        if (!shouldProceed) {
          console.log(chalk.yellow('Operation cancelled.'));
          process.exit(0);
        }
      }
    }

    console.log(chalk.blue(`Starting ${packageJson.name} v${packageJson.version} build process...`));
    console.log(chalk.gray(`Input: ${inputPath}`));
    console.log(chalk.gray(`Output: ${outputPath}`));

    // Process the file
    await buildStaticFile(inputPath, outputDir);

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