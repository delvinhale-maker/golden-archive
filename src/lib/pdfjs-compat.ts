/**
 * Runtime compatibility for pdfjs-dist v6.
 *
 * Some deployed/mobile Chromium builds do not yet expose
 * `Map.prototype.getOrInsertComputed`, but pdf.js calls it while rendering
 * optional content config. Add the tiny standards-compatible behavior before
 * loading pdf.js so PDF pages render instead of failing on older browsers.
 */
export function ensurePdfJsRuntimeCompat() {
  type MapWithGetOrInsertComputed = Map<unknown, unknown> & {
    getOrInsertComputed?: (key: unknown, callback: (key: unknown) => unknown) => unknown;
  };

  const proto = Map.prototype as MapWithGetOrInsertComputed;
  if (typeof proto.getOrInsertComputed === "function") return;

  Object.defineProperty(proto, "getOrInsertComputed", {
    configurable: true,
    writable: true,
    value: function getOrInsertComputed(
      this: Map<unknown, unknown>,
      key: unknown,
      callback: (key: unknown) => unknown,
    ) {
      if (this.has(key)) return this.get(key);
      const value = callback(key);
      this.set(key, value);
      return value;
    },
  });
}