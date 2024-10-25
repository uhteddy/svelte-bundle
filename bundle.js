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

export async function buildStaticFile(svelteFilePath, outputDir, options = {}) {
  const { useTailwind = false, tailwindConfig = null } = options;

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
    const finalHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Static Svelte App</title><style>${globalCssText}${cssText}</style></head><body><div id="app">${initialHtml}</div><script src="https://unpkg.com/svelte@3.58.0/internal/index.js"></script><script>${clientCode}const app=new App({target:document.getElementById("app"),hydrate:!0});</script></body></html>`;

    // Write the output file
    const outputPath = path.join(outputDir, 'output.html');
    await fs.writeFile(outputPath, finalHtml, 'utf-8');
  } catch (error) {
    console.error('Build error:', error);
    throw error;
  }
}