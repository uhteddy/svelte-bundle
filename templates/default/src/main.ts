import { hydrate, mount } from 'svelte';
import App from './App.svelte';

const target = document.getElementById('app')!;

// When `svelte-bundle build --hydrate` is used, this div will already contain
// server-rendered HTML. Calling hydrate() preserves that content and wires up
// Svelte's reactivity on top. Without SSR, mount() does a normal client render.
if (target.innerHTML.trim().length > 0) {
  hydrate(App, { target });
} else {
  mount(App, { target });
}
