import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildStaticFile } from '../bundle.js';

const __filename = fileURLToPath(import.meta.url);
const TESTS_DIR = path.dirname(__filename);

describe('Svelte Bundler', () => {
  const testDir = path.join(TESTS_DIR, 'temp');
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

  it('should throw error for non-existent input file', async () => {
    const nonExistentFile = path.join(testDir, 'NonExistent.svelte');
    await expect(buildStaticFile(nonExistentFile, testDir)).rejects.toThrow();
  });
});