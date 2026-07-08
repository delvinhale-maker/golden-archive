/**
 * Marketplace configuration constants.
 *
 * Single source of truth for pagination, list sizes, and other tunables that
 * are used across server functions, route loaders, and client components.
 * Import from here — do not redeclare these numbers inline.
 */

/**
 * Default number of products shown per page in the marketplace grid.
 * Used by `getProducts` (server slice) and by any client pagination UI.
 */
export const MARKETPLACE_PAGE_SIZE = 12;

/**
 * Number of featured products shown on the home page rail.
 * Kept separate from PAGE_SIZE so the home rail can be tuned independently.
 */
export const FEATURED_PRODUCTS_LIMIT = 12;
