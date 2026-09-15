/**
 * AurumVault Digital Rights Passport Generator — Round 4 versioned JSON
 * Schema for the public passport export format, plus a minimal structural
 * validator for it.
 *
 * Pure, dependency-free (no zod, no @supabase/supabase-js, no ajv — none of
 * which are installed in this sandbox for the same reason documented
 * throughout this codebase's other pure modules). validateExportPayload
 * below is NOT a general-purpose JSON Schema engine — it interprets only
 * the small subset of JSON Schema this file's own schema object actually
 * uses (type, required, properties, items, enum, nullable via a `type`
 * array including "null"). That is enough to genuinely validate the real
 * shape produced by serializePublicPassport(), which is exactly what this
 * module exists to check — not a claim of general JSON Schema conformance.
 *
 * Schema version 1.0 — bump PASSPORT_EXPORT_SCHEMA_VERSION and add a new
 * schema object (never mutate this one in place) if the export shape
 * changes in a backward-incompatible way; published snapshots record which
 * schema_version they were built against.
 */

export const PASSPORT_EXPORT_SCHEMA_VERSION = "1.0";

type JsonSchemaNode = {
  type?: string | string[];
  required?: string[];
  properties?: Record<string, JsonSchemaNode>;
  items?: JsonSchemaNode;
  enum?: string[];
};

export const PASSPORT_EXPORT_JSON_SCHEMA: JsonSchemaNode & { $id: string; title: string } = {
  $id: "https://aurumvault.store/schemas/digital-rights-passport/1.0.json",
  title: "AurumVault Digital Rights Passport — Public Export",
  type: "object",
  required: ["passport", "subject", "assets", "ai_permissions", "provenance", "legacy", "notices"],
  properties: {
    passport: {
      type: "object",
      required: [
        "schema_name",
        "schema_version",
        "passport_id",
        "passport_version",
        "status",
        "published_at",
        "human_readable_url",
      ],
      properties: {
        schema_name: { type: "string" },
        schema_version: { type: "string" },
        passport_id: { type: "string" },
        passport_version: { type: "number" },
        status: { type: "string", enum: ["ACTIVE", "SUPERSEDED", "REVOKED", "ARCHIVED"] },
        published_at: { type: "string" },
        effective_at: { type: ["string", "null"] },
        human_readable_url: { type: "string" },
      },
    },
    subject: {
      type: "object",
      required: ["verification_level", "rights_contact"],
      properties: {
        public_name: { type: ["string", "null"] },
        professional_name: { type: ["string", "null"] },
        rights_entity: { type: ["string", "null"] },
        primary_role: { type: ["string", "null"] },
        jurisdiction: { type: ["string", "null"] },
        verification_level: { type: "string" },
        rights_contact: {
          type: "object",
          required: [],
          properties: {
            email: { type: ["string", "null"] },
            url: { type: ["string", "null"] },
          },
        },
      },
    },
    assets: {
      type: "array",
      items: {
        type: "object",
        required: ["name", "asset_type", "default_ai_policy"],
        properties: {
          name: { type: "string" },
          asset_type: { type: "string" },
          territory: { type: ["string", "null"] },
          default_ai_policy: { type: "string" },
          default_license_policy: { type: ["string", "null"] },
        },
      },
    },
    ai_permissions: {
      type: "array",
      items: {
        type: "object",
        required: ["use_case", "permission"],
        properties: {
          use_case: { type: "string" },
          permission: { type: "string" },
        },
      },
    },
    provenance: {
      type: "array",
      items: {
        type: "object",
        required: ["evidence_type", "status"],
        properties: {
          evidence_type: { type: "string" },
          status: { type: "string" },
        },
      },
    },
    legacy: {
      type: "object",
      required: ["successor_planning_on_file", "posthumous_ai_use"],
      properties: {
        successor_planning_on_file: { type: "boolean" },
        posthumous_ai_use: { type: "string" },
      },
    },
    notices: {
      type: "object",
      required: ["legal_effect", "standards"],
      properties: {
        legal_effect: { type: "string" },
        standards: { type: "string" },
      },
    },
  },
};

export type ValidationIssue = { path: string; message: string };
export type ValidationResult = { valid: boolean; issues: ValidationIssue[] };

function typeMatches(value: unknown, expected: string): boolean {
  if (expected === "null") return value === null;
  if (expected === "array") return Array.isArray(value);
  if (expected === "object")
    return typeof value === "object" && value !== null && !Array.isArray(value);
  if (expected === "number") return typeof value === "number" && Number.isFinite(value);
  return typeof value === expected;
}

function validateNode(
  value: unknown,
  node: JsonSchemaNode,
  path: string,
  issues: ValidationIssue[],
): void {
  if (node.type) {
    const expectedTypes = Array.isArray(node.type) ? node.type : [node.type];
    if (!expectedTypes.some((t) => typeMatches(value, t))) {
      issues.push({
        path,
        message: `expected type ${expectedTypes.join(" | ")}, got ${value === null ? "null" : typeof value}`,
      });
      return;
    }
  }
  if (node.enum && typeof value === "string" && !node.enum.includes(value)) {
    issues.push({ path, message: `value "${value}" is not one of: ${node.enum.join(", ")}` });
  }
  if (node.properties && typeof value === "object" && value !== null && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    for (const key of node.required ?? []) {
      if (!(key in obj) || obj[key] === undefined) {
        issues.push({ path: `${path}.${key}`, message: "required property missing" });
      }
    }
    for (const [key, childNode] of Object.entries(node.properties)) {
      if (key in obj && obj[key] !== undefined) {
        validateNode(obj[key], childNode, `${path}.${key}`, issues);
      }
    }
  }
  if (node.items && Array.isArray(value)) {
    value.forEach((item, i) => validateNode(item, node.items!, `${path}[${i}]`, issues));
  }
}

/** Validates a payload against PASSPORT_EXPORT_JSON_SCHEMA. See module docstring for scope. */
export function validateExportPayload(payload: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  validateNode(payload, PASSPORT_EXPORT_JSON_SCHEMA, "$", issues);
  return { valid: issues.length === 0, issues };
}
