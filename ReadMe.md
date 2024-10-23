# Svelte Bundle CLI

**Svelte Bundle CLI** is a simple command-line tool that allows you to bundle a Svelte application into a single `index.html` file using Vite and SSR (Server-Side Rendering). The goal of this tool is to make it easy to bundle Svelte apps for deployment, particularly for cases where everything needs to be contained in a single file.

⚠️ **Note**: This tool is currently in early development and is not fully complete. The roadmap and additional features will be added over time. There is currently **NO** testing on this, meaning there is no guarentee it will work for most usecases.

## Features (In Progress)
- Bundles Svelte applications using Vite and SSR.
- Outputs a single `index.html` file ready for deployment.
- CLI arguments for specifying input and output directories.

## Roadmap
- [ ] Handle CSS and assets within the bundled file.
- [ ] Implement error handling and more robust validation.
- [ ] Add support for environment-specific builds (development/production).
- [ ] Documentation and guides on using the tool with different Svelte apps.
- [ ] Tests and CI integration.

## Installation (Planned)
Once the tool is published on npm, it will be available via `npx`:
```bash
npx svelte-bundle -i <input-dir> -o <output-dir>