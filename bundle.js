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
import { minify } from 'html-minifier-terser';

export async function buildStaticFile(svelteFilePath, outputDir, options = {}) {
  const { 
    useTailwind = false, 
    tailwindConfig = null,
    svelteVersion = 3,
    dev = false,
    preserveComments = false,
    preserveWhitespace = false,
    sourcemap = false
  } = options;

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

    // Configure Svelte options based on version
    const getSvelteOptions = (isSSR = false) => {
      // Base options that work for both versions
      const baseOptions = {
        compilerOptions: {
          dev,
          css: false,
          hydratable: true,
          generate: isSSR ? 'ssr' : 'dom',
          preserveComments,
          preserveWhitespace,
          enableSourcemap: sourcemap
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
      };

      // Add version-specific options
      if (svelteVersion === 5) {
        return {
          ...baseOptions,
          compilerOptions: {
            ...baseOptions.compilerOptions,
            runes: true,
            modernAst: true
          }
        };
      } else if (svelteVersion === 3) {
        return {
          ...baseOptions,
          compilerOptions: {
            ...baseOptions.compilerOptions,
            runes: false,
            compatibility: {
              componentApi: 4  // Use componentApi instead of mode
            }
          }
        };
      }

      return baseOptions;
    };
    
    // Create temporary SSR bundle
    const ssrBundle = await rollup({
      input: svelteFilePath,
      plugins: [
        svelte(getSvelteOptions(true)),
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

    // Import the SSR bundle with version-specific rendering
    const { default: App } = await import(tempSSRFile);
    let initialHtml = '';

    if (svelteVersion === 5) {
      // Svelte 5 SSR
      const instance = new App({
        target: null,
        props: {}
      });
      const rendered = instance.render();
      initialHtml = rendered.html || '';
    } else {
      // Svelte 3 SSR when using Svelte 5's compiler
      const rendered = App.render && App.render() || new App({
        props: {},
        target: null,
        $$inline: true
      }).render();

      initialHtml = rendered.html || '';
      
      if (rendered.css?.code) {
        cssText = rendered.css.code + cssText;
      }
      if (rendered.head) {
        initialHtml = rendered.head + initialHtml;
      }
    }

    // Clean up temp files
    await fs.rm(tempDir, { recursive: true, force: true });

    // Build client-side bundle
    const clientBundle = await rollup({
      input: svelteFilePath,
      plugins: [
        svelte(getSvelteOptions(false)),
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
    var finalHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Static Svelte App</title>
    <style>${globalCssText}${cssText}</style>
</head>
<body>
    <div id="app">${initialHtml}</div>
    <script>${clientCode}
    new App({
        target: document.getElementById("app"),
        hydrate: true
    });</script>
</body>
</html>`;

  finalHtml = await minify(finalHtml, {
    collapseWhitespace: true,
    removeComments: true,
    minifyCSS: true,
    minifyJS: true,
    removeRedundantAttributes: true,
    removeScriptTypeAttributes: true,
    removeStyleLinkTypeAttributes: true,
    useShortDoctype: true
  });

  // Write the output file
  const outputPath = path.join(outputDir, 'output.html');
  await fs.writeFile(outputPath, finalHtml, 'utf-8');
  } catch (error) {
    console.error('Build error:', error);
    throw error;
  }
}