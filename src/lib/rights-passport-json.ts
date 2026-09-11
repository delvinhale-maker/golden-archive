/**
 * JSON value type used at Rights Passport server-function boundaries.
 *
 * TanStack Start validates that server-function return values are
 * serializable. `unknown` fails that check, so JSON-shaped payloads
 * (model output, snapshots, proposed records) are typed with this instead.
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };
