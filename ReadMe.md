> ⚠️ **NOTICE:** While this tool is currently functional, it has not nearly been battle-tested enough to ensure it works in most use-cases.

![svelte-bundle](https://media2.dev.to/dynamic/image/width=1000,height=420,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Farticles%2Fcwfyh1w8r8g4f2ap1hff.png)

## Usage
```bash
svelte-bundle create my-app
cd my-app
svelte-bundle build
```

### Full Documentation: [https://github.com/uhteddy/svelte-bundle/wiki](https://github.com/uhteddy/svelte-bundle/wiki)

# Svelte Bundle CLI

**Svelte Bundle CLI** is a command-line tool that scaffolds a Svelte 5 + Vite project and bundles it into a single self-contained `.html` file. The goal of this tool is to make it easy to develop with Svelte and deploy anywhere — particularly for cases where everything needs to be contained in a single file.

Just note, the purpose of this tool is **NOT** to bundle an entire large-scale Svelte app. The purpose is to expand the capabilities of Svelte to work on systems like certain Content Management Systems (CMS) that only allow HTML, CSS, and JS. It was also built with SSR hydration support so the generated file is SEO-safe, with necessary elements already pre-rendered.

Utilizing this you will be able to develop a page with the joy of Svelte — components, reactivity, TypeScript, Tailwind — and output a single `.html` file you can drop anywhere.

⚠️ **Note**: This tool is **NOT** made to function with SvelteKit natively. It scaffolds a standalone Svelte 5 app (not a SvelteKit project) and outputs a single `.html` file.

## Inspiration
This tool was inspired by the need I had when it came to updating the CMS for a company I worked for. They were looking for more custom content on their website which used an outdated CMS. Pages were only able to include HTML, CSS, and JS.

Pure HTML, CSS, and JS can be granular and more importantly, lacks the reactivity that Svelte has. Meaning, to develop certain features I had to focus a lot more on the "what to do" when data changes, rather than Svelte handling that for me.

So, I searched for tools around that could be of assistance. I found [figsvelte](https://github.com/thomas-lowry/figsvelte) which was of so much help in the underlying understanding of what to do. But, it did not accomplish all I was looking for. I needed a solution that didn't just generate an HTML file with JS that hydrated the page. Through a lot of tinkering I was finally able to get the system to work.

I noticed through a lot of Google searches I wasn't the only one looking for a solution like this, yet I was unable to find one that addressed everything I was looking for. So, for this reason I built svelte-bundle to take care of this in a much more simplistic and CLI-driven way.

## Installation

```bash
npm install -g svelte-bundle
# or
bun add -g svelte-bundle
```

`sb` is available as a short alias:

```bash
sb create my-app
sb build --hydrate
```

---

## `svelte-bundle create`

Scaffolds a new Vite + Svelte 5 project with TypeScript configured and ready to go.

```bash
svelte-bundle create my-app
```

Interactive prompts will ask for:
- **Package manager** — bun, npm, pnpm, or yarn
- **Optional features** — Tailwind CSS, ESLint, Prettier, Vitest
- **Git** — initialize a repository
- **Install** — run the package manager automatically

| Flag | Description |
|---|---|
| `--template / -t` | Template to use (currently: `default`) |
| `--pm` | Skip the package manager prompt (`bun`, `npm`, `pnpm`, `yarn`) |
| `--no-install` | Skip dependency installation |
| `--no-git` | Skip git initialization |

```bash
svelte-bundle create my-app --pm bun --no-git
```

### Project structure

```
my-app/
├── src/
│   ├── App.svelte       ← root component
│   ├── main.ts          ← entry point
│   └── lib/
│       └── index.ts     ← library re-export entry
├── public/
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

### Dev server

```bash
cd my-app
npm run dev
```

---

## `svelte-bundle build`

Builds the project into a **single self-contained `dist/index.html`** with all CSS and JavaScript inlined — no separate asset files, no web server needed.

```bash
cd my-app
svelte-bundle build
```

| Flag | Default | Description |
|---|---|---|
| `--hydrate` | `false` | Pre-render with Svelte SSR for SEO-friendly output |
| `--entry` | `src/App.svelte` | Root component for SSR pre-rendering |
| `--outfile` | `dist/index.html` | Output file path |
| `--mode / -m` | `production` | Vite build mode |

### Default build

```bash
svelte-bundle build
```

Produces a single `dist/index.html` with CSS and JS fully inlined. Open it directly in a browser — no web server required. Drop it into any CMS, email, or embedded environment.

### Hydrated build (SSR)

```bash
svelte-bundle build --hydrate
```

Pre-renders the root component server-side so the page contains real HTML content before JavaScript executes. Useful for:

- **SEO** — search engine crawlers see actual content immediately
- **LCP** — Largest Contentful Paint is not blocked by JS execution
- **CMS / embedded use** — a fully pre-rendered, static single file

The client JS automatically detects whether SSR content is present and calls `hydrate()` or `mount()` accordingly — no separate builds or entry points needed.

### How the build pipeline works

1. **Client bundle** — `vite build` compiles and minifies the Svelte app via your `vite.config.ts`
2. **Inline** — every `<link rel="stylesheet">` becomes an inline `<style>` block; every `<script src="...">` becomes an inline `<script type="module">` block
3. **SSR** *(with `--hydrate` only)* — a temporary Vite SSR build server-renders the component; the HTML is injected into `<div id="app">` before inlining; all temp files are cleaned up automatically

---

## Features
- [x] Scaffold a Svelte 5 + Vite project with a single command
- [x] Outputs a single `.html` file ready for deployment anywhere
- [x] All CSS and JS fully inlined — zero external dependencies at runtime
- [x] SSR hydration support for SEO-safe output
- [x] Tailwind CSS support out of the box (selected during `create`)
- [x] Optional ESLint, Prettier, and Vitest setup
- [x] TypeScript everywhere, strict mode enforced
- [x] Works with any Vite plugin ecosystem

## Requirements

- Node.js 18+ or Bun 1.0+
- Projects created with `svelte-bundle create` include Vite 6 and Svelte 5 as devDependencies
