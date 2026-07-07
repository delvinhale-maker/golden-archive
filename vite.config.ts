// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// Resolve tslib's native ESM build to an absolute path. pdf-lib (used by the
// watermarked preview generator) imports helpers via `import { __awaiter }
// from "tslib"`. In the Cloudflare Workers bundle, the CJS entry gets
// wrapped by esbuild's `__toESM(...).default`, which is `undefined`, and
// the preview endpoint crashes with "Cannot destructure property
// '__extends' of ...default". Pointing the alias at tslib.es6.mjs makes
// the named helpers resolve directly.
const tslibEsm = require.resolve("tslib/tslib.es6.mjs");

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    resolve: {
      alias: {
        tslib: tslibEsm,
      },
    },
  },
});


