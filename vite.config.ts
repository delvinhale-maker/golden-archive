// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    resolve: {
      alias: {
        // pdf-lib (used by the watermarked preview generator) imports tslib
        // helpers via `import { __awaiter } from "tslib"`. In the Cloudflare
        // Workers bundle, esbuild's CJS→ESM interop resolves tslib's CJS
        // entry and destructures `.default`, which is undefined — the
        // resulting runtime error crashes the preview endpoint with
        // "Cannot destructure property '__extends' of ...default". Pin
        // tslib to its native ESM build so named helpers resolve directly.
        tslib: "tslib/tslib.es6.mjs",
      },
    },
  },
});

