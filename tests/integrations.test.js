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

// vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 10000,
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/**', 'tests/**']
    },
    include: ['tests/**/*.test.js'],
  },
});