> **Early release** — functional but not yet battle-tested across all use-cases.

![svelte-bundle](https://media2.dev.to/dynamic/image/width=1000,height=420,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Farticles%2Fcwfyh1w8r8g4f2ap1hff.png)

# svelte-bundle

Scaffold a Svelte 5 + Vite project and bundle it into a **single self-contained `.html` file** — CSS and JS fully inlined, no web server required.

Built for environments that only accept plain HTML: legacy CMS platforms or anywhere you need real reactivity without a build server.

> **Not a SvelteKit tool.** This scaffolds a standalone Svelte 5 app and outputs one `.html` file.

---

## Install

```bash
npm install -g svelte-bundle
# or
bun add -g svelte-bundle
```

Short alias `sb` is also available.

---

## Quickstart

```bash
svelte-bundle create my-app
cd my-app
npm run dev          # develop with hot reload
svelte-bundle build  # → dist/index.html
```

---

## Commands

### `svelte-bundle create [name]`

Scaffolds a new project with Svelte 5, Vite, and TypeScript — ready to run.

```bash
svelte-bundle create my-app
```

Interactive prompts let you choose a package manager and optional features. You can also skip prompts with flags:

```bash
svelte-bundle create my-app --pm bun --no-git
```

| Flag | Description |
|---|---|
| `-t, --template` | Template to use (default: `default`) |
| `--pm` | Package manager: `bun`, `npm`, `pnpm`, `yarn` |
| `--no-install` | Skip dependency installation |
| `--no-git` | Skip git initialization |

**Optional features** (selected during prompts):
- **Tailwind CSS** — `@tailwindcss/vite` v4, zero config
- **ESLint** — with Svelte plugin
- **Prettier** — with Svelte plugin
- **Vitest** — unit testing setup

**Output structure:**
```
my-app/
├── src/
│   ├── App.svelte       ← root component
│   ├── main.ts          ← entry point
│   └── lib/index.ts
├── public/
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

### `svelte-bundle build`

Compiles the project and inlines everything into a single `dist/index.html`.

```bash
svelte-bundle build
```

Add `--hydrate` to pre-render with SSR — useful for SEO, fast LCP, or CMS environments that crawl content:

```bash
svelte-bundle build --hydrate
```

With `--hydrate`, the root component is server-rendered first so real HTML content exists before JavaScript runs. The client JS automatically calls `hydrate()` or `mount()` depending on what it finds — no extra config needed.

| Flag | Default | Description |
|---|---|---|
| `--hydrate` | `false` | Pre-render with Svelte SSR |
| `--entry` | `src/App.svelte` | Root component for SSR |
| `--outfile` | `dist/index.html` | Output path |
| `-m, --mode` | `production` | Vite build mode |

**How the build works:**
1. `vite build` compiles and minifies the Svelte app
2. Every `<link rel="stylesheet">` is replaced with an inline `<style>` block
3. Every `<script src="...">` is replaced with an inline `<script type="module">` block
4. *(with `--hydrate`)* A Vite SSR build pre-renders the component and injects the HTML into `<div id="app">`

The result is one `.html` file you can open directly in a browser or drop into any system.

---

## Requirements

- Node.js 18+ or Bun 1.0+
- Projects created with `svelte-bundle create` include Vite 6 and Svelte 5 as devDependencies
