import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// Resolve tslib's native ESM build to an absolute path. pdf-lib imports tslib
// helpers by name, so this keeps those helpers stable in the SSR bundle.
const tslibEsm = require.resolve("tslib/tslib.es6.mjs");

export default defineConfig({
  resolve: {
    alias: {
      tslib: tslibEsm,
    },
  },
  plugins: [
    tsConfigPaths(),
    tanstackStart(),
    nitro(),
    viteReact(),
    tailwindcss(),
  ],
});
