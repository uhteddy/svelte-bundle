// bundle.js
import fs from "fs/promises";
import path from "path";
import { rollup } from "rollup";
import svelte from "rollup-plugin-svelte";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import css from "rollup-plugin-css-only";
import terser from "@rollup/plugin-terser";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import cssnano from "cssnano";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Creates PostCSS plugins array based on Tailwind configuration
 */
function createPostCSSPlugins(useTailwind, tailwindConfig, svelteFilePath) {
  const plugins = [];

  if (useTailwind) {
    plugins.push(
      tailwindcss(
        tailwindConfig || {
          content: [svelteFilePath],
          theme: { extend: {} },
          plugins: [],
        },
      ),
    );
  }

  plugins.push(
    autoprefixer(),
    cssnano({
      preset: [
        "default",
        {
          discardComments: { removeAll: true },
        },
      ],
    }),
  );

  return plugins;
}

/**
 * Generates global Tailwind CSS if enabled
 */
async function generateGlobalCSS(useTailwind, postcssPlugins) {
  if (!useTailwind) return "";

  const tailwindCss = `
    @tailwind base;
    @tailwind components;
    @tailwind utilities;
  `;

  const processedCss = await postcss(postcssPlugins).process(tailwindCss, {
    from: undefined,
  });
  return processedCss.css;
}

/**
 * Creates style preprocessor for Svelte components
 */
function createStylePreprocessor(useTailwind, postcssPlugins) {
  if (!useTailwind) return undefined;

  return {
    style: async ({ content }) => {
      if (!content) return { code: "" };
      const result = await postcss(postcssPlugins).process(content, {
        from: undefined,
      });
      return { code: result.css };
    },
  };
}

/**
 * Creates Rollup configuration for Svelte compilation
 */
function createSvelteConfig(options) {
  const { generate, preprocess, emitCss = true } = options;

  return {
    compilerOptions: {
      generate,
      css: "injected", // Svelte 5: use 'injected' for CSS handling
    },
    emitCss,
    preprocess,
  };
}

/**
 * Builds SSR bundle and renders component to HTML
 */
async function buildSSRBundle(
  svelteFilePath,
  preprocessor,
  __dirname,
  verbose = false,
) {
  let cssText = "";

  const ssrBundle = await rollup({
    input: svelteFilePath,
    onwarn: (warning, warn) => {
      // Suppress warnings unless verbose mode is enabled
      if (verbose) warn(warning);
    },
    plugins: [
      svelte({
        ...createSvelteConfig({
          generate: "server",
          preprocess: preprocessor,
          emitCss: true,
        }),
        onwarn: (warning, handler) => {
          // Suppress svelte plugin warnings unless verbose mode is enabled
          if (verbose) handler(warning);
        },
      }),
      css({
        output: (styles) => {
          cssText = styles;
        },
      }),
      resolve({
        browser: false, // SSR bundle should use Node resolution
        dedupe: ["svelte"],
      }),
      commonjs(),
    ],
  });

  const tempDir = path.join(__dirname, ".temp");
  await fs.mkdir(tempDir, { recursive: true });
  const tempSSRFile = path.join(tempDir, "ssr-bundle.js");

  await ssrBundle.write({
    file: tempSSRFile,
    format: "es",
  });

  // Svelte 5: Import both the component and render function
  const { default: App } = await import(`file://${tempSSRFile}`);
  const { render } = await import("svelte/server");

  // Svelte 5: Use render function instead of App.render()
  const { body, head } = render(App, { props: {} });

  await fs.rm(tempDir, { recursive: true, force: true });

  return { html: body, head: head || "", cssText };
}

/**
 * Builds client-side bundle for hydration
 */
async function buildClientBundle(
  svelteFilePath,
  preprocessor,
  verbose = false,
) {
  let cssText = "";

  // Create a wrapper entry that imports and hydrates the component
  const tempDir = path.join(__dirname, ".temp");
  await fs.mkdir(tempDir, { recursive: true });
  const wrapperPath = path.join(tempDir, "wrapper.js");

  // Create wrapper that imports component and hydrate function
  await fs.writeFile(
    wrapperPath,
    `
    import { hydrate } from 'svelte';
    import Component from '${svelteFilePath.replace(/\\/g, "/")}';

    hydrate(Component, {
      target: document.getElementById('app')
    });
  `,
  );

  const clientBundle = await rollup({
    input: wrapperPath,
    onwarn: (warning, warn) => {
      // Suppress warnings unless verbose mode is enabled
      if (verbose) warn(warning);
    },
    plugins: [
      svelte({
        ...createSvelteConfig({
          generate: "client",
          preprocess: preprocessor,
          emitCss: true,
        }),
        onwarn: (warning, handler) => {
          // Suppress svelte plugin warnings unless verbose mode is enabled
          if (verbose) handler(warning);
        },
      }),
      css({
        output: (styles) => {
          cssText = styles;
        },
      }),
      resolve({
        browser: true,
        dedupe: ["svelte"],
      }),
      commonjs(),
      terser(),
    ],
  });

  const {
    output: [{ code }],
  } = await clientBundle.generate({
    format: "iife",
  });

  // Clean up temp files
  await fs.rm(tempDir, { recursive: true, force: true });

  return { code, cssText };
}

/**
 * Generates final HTML document
 */
function generateHTML(ssrHtml, clientCode, globalCss, componentCss) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Static Svelte App</title>
  <style>${globalCss}${componentCss}</style>
</head>
<body>
  <div id="app">${ssrHtml}</div>
  <script>
    ${clientCode}
  </script>
</body>
</html>`;
}

/**
 * Main build function - bundles a Svelte file into a static HTML file
 * @param {string} svelteFilePath - Path to the input Svelte file
 * @param {string} outputDir - Directory for the output HTML file
 * @param {Object} options - Build options
 * @param {boolean} options.useTailwind - Enable Tailwind CSS processing
 * @param {Object} options.tailwindConfig - Custom Tailwind configuration
 * @param {boolean} options.verbose - Show detailed build output and warnings
 */
export async function buildStaticFile(svelteFilePath, outputDir, options = {}) {
  const {
    useTailwind = false,
    tailwindConfig = null,
    verbose = false,
  } = options;

  // Suppress console warnings unless verbose mode is enabled
  const originalConsoleWarn = console.warn;

  if (!verbose) {
    console.warn = () => {};
  }

  try {
    await fs.mkdir(outputDir, { recursive: true });

    const postcssPlugins = createPostCSSPlugins(
      useTailwind,
      tailwindConfig,
      svelteFilePath,
    );
    const preprocessor = createStylePreprocessor(useTailwind, postcssPlugins);

    // Generate global Tailwind CSS
    const globalCss = await generateGlobalCSS(useTailwind, postcssPlugins);

    // Build SSR bundle and render to HTML
    const { html: ssrHtml, cssText: ssrCss } = await buildSSRBundle(
      svelteFilePath,
      preprocessor,
      __dirname,
      verbose,
    );

    // Build client bundle for hydration
    const { code: clientCode, cssText: clientCss } = await buildClientBundle(
      svelteFilePath,
      preprocessor,
      verbose,
    );

    // Combine CSS from both bundles
    const combinedCss = ssrCss || clientCss;

    // Generate final HTML
    const finalHtml = generateHTML(ssrHtml, clientCode, globalCss, combinedCss);

    // Write output file
    const outputPath = path.join(outputDir, "output.html");
    await fs.writeFile(outputPath, finalHtml, "utf-8");
  } catch (error) {
    console.error("Build error:", error);
    throw error;
  } finally {
    // Restore original console methods
    if (!verbose) {
      console.warn = originalConsoleWarn;
    }
  }
}
