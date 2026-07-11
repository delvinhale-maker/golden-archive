/**
 * Runtime compatibility for pdfjs-dist v6.
 *
 * Some deployed/mobile Chromium builds do not yet expose
 * `Map.prototype.getOrInsertComputed`, but pdf.js calls it while rendering
 * optional content config. Add the tiny standards-compatible behavior before
 * loading pdf.js so PDF pages render instead of failing on older browsers.
 */
export function ensurePdfJsRuntimeCompat() {
  type CollectionWithInsertHelpers = {
    has: (key: unknown) => boolean;
    get: (key: unknown) => unknown;
    set: (key: unknown, value: unknown) => unknown;
    getOrInsertComputed?: (key: unknown, callback: (key: unknown) => unknown) => unknown;
    getOrInsert?: (key: unknown, value: unknown) => unknown;
  };

  const patch = (proto: CollectionWithInsertHelpers) => {
    if (typeof proto.getOrInsertComputed !== "function") {
      Object.defineProperty(proto, "getOrInsertComputed", {
        configurable: true,
        writable: true,
        value: function getOrInsertComputed(
          this: CollectionWithInsertHelpers,
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

    if (typeof proto.getOrInsert !== "function") {
      Object.defineProperty(proto, "getOrInsert", {
        configurable: true,
        writable: true,
        value: function getOrInsert(
          this: CollectionWithInsertHelpers,
          key: unknown,
          value: unknown,
        ) {
          if (this.has(key)) return this.get(key);
          this.set(key, value);
          return value;
        },
      });
    }
  };

  patch(Map.prototype as unknown as CollectionWithInsertHelpers);
  patch(WeakMap.prototype as unknown as CollectionWithInsertHelpers);
}