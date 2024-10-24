import fs from 'fs/promises';
import path from 'path';
import { rollup } from 'rollup';
import svelte from 'rollup-plugin-svelte';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import css from 'rollup-plugin-css-only';
import terser from '@rollup/plugin-terser';

export async function buildStaticFile(svelteFilePath, outputDir) {
  try {
    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    let cssText = '';
    
    // Create temporary SSR bundle
    const ssrBundle = await rollup({
      input: svelteFilePath,
      plugins: [
        svelte({
          compilerOptions: {
            generate: 'ssr',
            hydratable: true,
            css: false
          },
          emitCss: true
        }),
        css({
          output: function(styles) {
            cssText = styles;
          }
        }),
        resolve({
          browser: true,
          dedupe: ['svelte']
        }),
        commonjs()
      ],
      external: ['svelte/internal']
    });

    // Create a temporary directory for SSR
    const tempDir = path.join(path.dirname(svelteFilePath), '.temp');
    await fs.mkdir(tempDir, { recursive: true });
    const tempSSRFile = path.join(tempDir, 'ssr-bundle.js');

    // Generate SSR bundle
    await ssrBundle.write({
      file: tempSSRFile,
      format: 'es',
      exports: 'default'
    });

    // Import the SSR bundle
    const { default: App } = await import(tempSSRFile);
    const { html: initialHtml } = App.render();

    // Clean up temp files
    await fs.rm(tempDir, { recursive: true, force: true });

    // Build client-side bundle
    const clientBundle = await rollup({
      input: svelteFilePath,
      plugins: [
        svelte({
          compilerOptions: {
            hydratable: true,
            css: false
          },
          emitCss: true
        }),
        css({
          output: function(styles) {
            cssText = styles;
          }
        }),
        resolve({
          browser: true,
          dedupe: ['svelte']
        }),
        commonjs(),
        terser()
      ]
    });

    const { output: [{ code: clientCode }] } = await clientBundle.generate({
      format: 'iife',
      name: 'App',
      globals: {
        svelte: 'Svelte'
      }
    });

    // Create the final HTML
    const finalHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Static Svelte App</title>
    <style>
      ${cssText}
    </style>
</head>
<body>
    <div id="app">${initialHtml}</div>
    <script src="https://unpkg.com/svelte@3.58.0/internal/index.js"></script>
    <script>
      ${clientCode}
      const app = new App({
        target: document.getElementById('app'),
        hydrate: true
      });
    </script>
</body>
</html>`;

    // Write the output file
    const outputPath = path.join(outputDir, 'output.html');
    await fs.writeFile(outputPath, finalHtml, 'utf-8');
  } catch (error) {
    console.error('Build error:', error);
    throw error;
  }
}