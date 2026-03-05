#!/usr/bin/env node
import { defineCommand, runMain } from "citty";
import { createCommand } from "./commands/create/index.ts";
import { buildCommand } from "./commands/build/index.ts";

import { version } from "../package.json";

const main = defineCommand({
  meta: {
    name: "svelte-bundle",
    version: version,
    description: "Scaffold and bundle Svelte components with Vite",
  },
  subCommands: {
    create: createCommand,
    build: buildCommand,
  },
});

await runMain(main);
