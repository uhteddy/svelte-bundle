#!/usr/bin/env node

const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const program = new Command();

program
  .option('-i, --input <path>', 'Specify the input file (e.g., .svelte file)', 'src/App.svelte')
  .option('-o, --output <path>', 'Specify the output directory', 'dist')
  .parse(process.argv);

const options = program.opts();
const inputPath = path.resolve(process.cwd(), options.input);
const outputPath = path.resolve(process.cwd(), options.output);

// Validate input path
if (!fs.existsSync(inputPath)) {
  console.error(`Input path does not exist: ${inputPath}`);
  process.exit(1);
}

try {
  console.log(`Bundling from ${inputPath} to ${outputPath}`);

  // Set the input path as an environment variable for Vite to use
  process.env.INPUT_FILE = inputPath;

  // Run Vite build
  execSync('vite build', { stdio: 'inherit' });

  // Run SSR build
  execSync('vite build --ssr src/entry-server.js --mode ssr', { stdio: 'inherit' });

  // Custom post-build processing
  execSync(`node build.js ${inputPath} ${outputPath}`, { stdio: 'inherit' });

  console.log(`Successfully bundled to ${outputPath}`);
} catch (error) {
  console.error('Error during build:', error.message);
  process.exit(1);
}
