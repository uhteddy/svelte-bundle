#!/usr/bin/env node
import { defineCommand, runMain } from 'citty';
import { createCommand } from './commands/create/index.ts';
import { buildCommand } from './commands/build/index.ts';

const main = defineCommand({
  meta: {
    name: 'svelte-bundle',
    version: '0.2.0',
    description: 'Scaffold and bundle Svelte components with Vite',
  },
  subCommands: {
    create: createCommand,
    build: buildCommand,
  },
});

await runMain(main);
