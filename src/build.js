const fs = require('fs');
const path = require('path');
const { fileURLToPath } = require('url');
const { createRequire } = require('module');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputPath = process.argv[2] || 'dist';
const outputPath = process.argv[3] || 'dist/index.html';

const distDir = path.resolve(__dirname, inputPath);
const indexHtmlPath = path.join(distDir, "index.html");
const ssrBundlePath = path.resolve(__dirname, "dist-ssr", "entry-server.cjs");

async function build() {
  try {
    // Read index.html
    if (!fs.existsSync(indexHtmlPath)) {
      throw new Error(`Client build output not found at ${indexHtmlPath}`);
    }
    const indexHtml = fs.readFileSync(indexHtmlPath, 'utf-8');

    // SSR bundle
    if (!fs.existsSync(ssrBundlePath)) {
      throw new Error(`SSR build output not found at ${ssrBundlePath}`);
    }
    const { render } = require(ssrBundlePath);
    const { html } = render();

    if (!html || typeof html !== 'string') {
      throw new Error("Rendered HTML is empty or invalid.");
    }

    // Inject rendered HTML into index.html
    const finalHtml = indexHtml.replace(
      '<div id="app"></div>',
      `<div id="app">${html}</div>`
    );

    // Write final HTML
    fs.writeFileSync(path.resolve(outputPath), finalHtml);

    console.log("Build complete. The final file is at", outputPath);
  } catch (error) {
    console.error("Error during build:", error);
    process.exit(1);
  }
}

build();
