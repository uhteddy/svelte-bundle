// bundle.js
import fs from 'fs/promises';
import path from 'path';
import { rollup } from 'rollup';
import svelte from 'rollup-plugin-svelte';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import css from 'rollup-plugin-css-only';
import terser from '@rollup/plugin-terser';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import cssnano from 'cssnano';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import alias from '@rollup/plugin-alias';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function buildStaticFile(svelteFilePath, outputDir, options = {}) {
  const { useTailwind = false, tailwindConfig = null, aliases = {} } = options;

  try {
    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    let cssText = '';
    
    // Setup PostCSS plugins based on whether Tailwind is enabled
    const postcssPlugins = useTailwind 
      ? [
          tailwindcss(tailwindConfig || {
            content: [svelteFilePath],
            theme: { extend: {} },
            plugins: [],
          }),
          autoprefixer(),
          cssnano({
            preset: ['default', {
              discardComments: {
                removeAll: true,
              },
            }],
          })
        ]
      : [
          autoprefixer(),
          cssnano({
            preset: ['default', {
              discardComments: {
                removeAll: true,
              },
            }],
          })
        ];

    // Process global styles
    let globalCssText = '';
    if (useTailwind) {
      const tailwindCss = `
        @tailwind base;
        @tailwind components;
        @tailwind utilities;
      `;

      const processedCss = await postcss(postcssPlugins)
        .process(tailwindCss, { from: undefined });
      globalCssText = processedCss.css;
    }

    // Get the absolute path to svelte/internal
    const svelteInternalPath = require.resolve('svelte/internal');
    
    // Create temporary SSR bundle
    const ssrBundle = await rollup({
      input: svelteFilePath,
      plugins: [
        alias({
          entries: Object.entries(aliases).map(([find, replacement]) => ({
            find,
            replacement
          }))
        }),
        svelte({
          compilerOptions: {
            generate: 'ssr',
            hydratable: true,
            css: false
          },
          emitCss: true,
          preprocess: useTailwind ? {
            style: async ({ content }) => {
              if (!content) return { code: '' };
              const result = await postcss(postcssPlugins)
                .process(content, { from: undefined });
              return { code: result.css };
            }
          } : undefined
        }),
        css({
          output: function(styles) {
            cssText = styles;
          }
        }),
        resolve({
          browser: true,
          dedupe: ['svelte'],
          modulePaths: [path.join(__dirname, 'node_modules')],
          rootDir: __dirname
        }),
        commonjs()
      ],
      external: ['svelte/internal']
    });

    // Create a temporary directory in the CLI package directory
    const tempDir = path.join(__dirname, '.temp');
    await fs.mkdir(tempDir, { recursive: true });
    const tempSSRFile = path.join(tempDir, 'ssr-bundle.js');

    // Generate SSR bundle as ESM
    await ssrBundle.write({
      file: tempSSRFile,
      format: 'es',
      exports: 'default',
      paths: {
        'svelte/internal': svelteInternalPath
      }
    });

    // Import the SSR bundle using dynamic import
    const { default: App } = await import(/* @vite-ignore */`file://${tempSSRFile}`);
    const { html: initialHtml } = App.render();

    // Clean up temp files
    await fs.rm(tempDir, { recursive: true, force: true });

    // Build client-side bundle
    const clientBundle = await rollup({
      input: svelteFilePath,
      plugins: [
        alias({
          entries: Object.entries(aliases).map(([find, replacement]) => ({
            find,
            replacement
          }))
        }),
        svelte({
          compilerOptions: {
            hydratable: true,
            css: false
          },
          emitCss: true,
          preprocess: useTailwind ? {
            style: async ({ content }) => {
              if (!content) return { code: '' };
              const result = await postcss(postcssPlugins)
                .process(content, { from: undefined });
              return { code: result.css };
            }
          } : undefined
        }),
        css({
          output: function(styles) {
            cssText = styles;
          }
        }),
        resolve({
          browser: true,
          dedupe: ['svelte'],
          modulePaths: [path.join(__dirname, 'node_modules')],
          rootDir: __dirname
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
    const finalHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Static Svelte App</title><style>${globalCssText}${cssText}</style></head><body><div id="app">${initialHtml}</div><script>${clientCode}const app=new App({target:document.getElementById("app"),hydrate:!0});</script></body></html>`;

    // Write the output file
    const outputPath = path.join(outputDir, 'output.html');
    await fs.writeFile(outputPath, finalHtml, 'utf-8');
  } catch (error) {
    console.error('Build error:', error);
    throw error;
  }
}