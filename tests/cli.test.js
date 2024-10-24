import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildStaticFile } from '../bundle.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Svelte Bundler', () => {
  const testDir = path.join(__dirname, 'temp');
  const testOutput = path.join(testDir, 'output.html');
  
  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  it('should build a valid html file from a svelte component', async () => {
    const testComponent = `
      <script>
        let count = 0;
      </script>

      <button on:click={() => count++}>
        Count is {count}
      </button>
    `;

    const testSvelteFile = path.join(testDir, 'Test.svelte');
    await fs.writeFile(testSvelteFile, testComponent);

    await buildStaticFile(testSvelteFile, testDir);

    const outputExists = await fs.access(testOutput)
      .then(() => true)
      .catch(() => false);
    expect(outputExists).toBe(true);

    const output = await fs.readFile(testOutput, 'utf-8');
    expect(output).toContain('<!DOCTYPE html>');
    expect(output).toContain('<button');
    expect(output).toContain('Count is');
    expect(output).toContain('new App({');
    expect(output).toContain('target: document.getElementById(\'app\')');
  });

  it('should handle components with styles', async () => {
    const testComponent = `
      <script>
        let name = 'world';
      </script>

      <h1>Hello {name}!</h1>

      <style>
        h1 {
          color: blue;
        }
      </style>
    `;

    const testSvelteFile = path.join(testDir, 'TestStyle.svelte');
    await fs.writeFile(testSvelteFile, testComponent);

    await buildStaticFile(testSvelteFile, testDir);

    const output = await fs.readFile(testOutput, 'utf-8');
    expect(output).toContain('<style>');
    expect(output).toContain('color:blue');
  });

  it('should create output directory if it doesn\'t exist', async () => {
    const deepDir = path.join(testDir, 'deep', 'nested');
    const testComponent = '<h1>Hello</h1>';
    const testSvelteFile = path.join(testDir, 'TestDeep.svelte');
    const outputFile = path.join(deepDir, 'output.html');
    
    // Create test file
    await fs.writeFile(testSvelteFile, testComponent);

    // Build the file
    await buildStaticFile(testSvelteFile, deepDir);

    // Wait a bit for file system operations to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check if directory was created
    const dirExists = await fs.access(deepDir)
      .then(() => true)
      .catch(() => false);
    expect(dirExists).toBe(true);

    // Check if output file exists
    const outputExists = await fs.access(outputFile)
      .then(() => true)
      .catch(() => false);
    expect(outputExists).toBe(true);

    // Verify file contents
    const output = await fs.readFile(outputFile, 'utf-8');
    expect(output).toContain('<h1>Hello</h1>');
  });

  it('should throw error for non-existent input file', async () => {
    const nonExistentFile = path.join(testDir, 'NonExistent.svelte');
    await expect(buildStaticFile(nonExistentFile, testDir)).rejects.toThrow();
  });
});

// tests/cli.integration.test.js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('CLI Integration', () => {
  const testDir = path.join(__dirname, 'temp-cli');
  
  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
      // Also remove output.html from current directory if it exists
      await fs.unlink('output.html').catch(() => {});
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  it('should show help text', async () => {
    const { stdout } = await execAsync('node cli.js --help');
    expect(stdout).toContain('Usage:');
    expect(stdout).toContain('Options:');
    expect(stdout).toContain('--input');
  }, { timeout: 10000 });

  it('should require input parameter', async () => {
    try {
      await execAsync('node cli.js');
    } catch (error) {
      expect(error.stderr).toContain('required option');
    }
  }, { timeout: 10000 });

  it('should build a file with default output location', async () => {
    const testComponent = '<h1>Hello World</h1>';
    const testFile = path.join(testDir, 'Test.svelte');
    await fs.writeFile(testFile, testComponent);

    await execAsync(`node cli.js -i ${testFile}`);

    const outputExists = await fs.access('output.html')
      .then(() => true)
      .catch(() => false);
    expect(outputExists).toBe(true);
  }, { timeout: 10000 });
});