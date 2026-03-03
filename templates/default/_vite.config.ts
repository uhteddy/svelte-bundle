import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  esbuild: {
    // Strip all legal/license comments (e.g. from lucide-svelte) from JS and CSS
    legalComments: 'none',
  },
});
