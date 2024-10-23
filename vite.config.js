import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig(({ mode }) => {
  const isSSR = mode === "ssr";

  // Use the input file from the environment variable or fallback to a default
  const inputFile = process.env.INPUT_FILE || './index.html';

  return {
    plugins: [
      svelte({
        compilerOptions: {
          hydratable: true,
        },
      }),
      !isSSR && viteSingleFile(),
    ],
    build: {
      ssr: isSSR,
      outDir: isSSR ? "dist-ssr" : "dist",
      rollupOptions: {
        // Dynamically set input
        input: inputFile,
        output: {
          format: isSSR ? "cjs" : "es",
        },
      },
    },
  };
});
