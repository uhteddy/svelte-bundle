#!/usr/bin/env node
import { program } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs/promises';
import { buildStaticFile } from './bundle.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

program
  .name('svelte-bundle')
  .description('Bundle a Svelte component into a standalone HTML file')
  .version('1.0.0')
  .requiredOption('-i, --input <path>', 'Input Svelte file')
  .option('-o, --output <path>', 'Output directory (defaults to current directory)');

program.parse();

const options = program.opts();

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

    // Determine output directory
    let outputDir = process.cwd();
    if (options.output) {
      outputDir = path.resolve(options.output);
      // Create output directory if it doesn't exist
      await fs.mkdir(outputDir, { recursive: true });
    }

    console.log(chalk.blue('Starting build process...'));
    console.log(chalk.gray(`Input: ${inputPath}`));
    console.log(chalk.gray(`Output directory: ${outputDir}`));

    // Process the file
    await buildStaticFile(inputPath, outputDir);

    console.log(chalk.green('\n✨ Build completed successfully!'));
    console.log(chalk.gray(`Output file: ${path.join(outputDir, 'output.html')}`));
  } catch (error) {
    console.error(chalk.red('\nBuild failed:'));
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

validateAndProcess();