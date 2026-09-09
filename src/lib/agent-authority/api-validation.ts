import { z } from "zod";

const UUID = z.string().uuid();
const shortText = (max: number) => z.string().trim().min(1).max(max);
const optionalShortText = (max: number) => z.union([shortText(max), z.null()]).optional();
const strictBoolean = z.boolean().optional();
const money = z.number().finite().min(0).max(1_000_000_000);

export const actionGateApiSchema = z
  .object({
    passportId: UUID,
    actionKey: z.string().trim().min(1).max(128).regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/),
    target: optionalShortText(512),
    resourceKey: optionalShortText(256),
    system: optionalShortText(128),
    amount: z.union([money, z.null()]).optional(),
    amountKind: z.enum(["PURCHASE", "REFUND", "INVOICE", "OTHER"]).nullable().optional(),
    currency: z
      .union([z.string().trim().regex(/^[A-Za-z]{3}$/).transform((value) => value.toUpperCase()), z.null()])
      .optional(),
    externalCommunication: strictBoolean,
    financialAction: strictBoolean,
    sensitiveData: strictBoolean,
    highRisk: strictBoolean,
    dataClassification: z.enum(["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"]).nullable().optional(),
    idempotencyKey: z.string().trim().min(8).max(200).regex(/^[\x21-\x7E]+$/, "idempotencyKey must contain visible ASCII characters only"),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.amount != null && !value.amountKind) {
      ctx.addIssue({ code: "custom", path: ["amountKind"], message: "amountKind is required when amount is supplied" });
    }
    if (value.amountKind && value.amount == null) {
      ctx.addIssue({ code: "custom", path: ["amount"], message: "amount is required when amountKind is supplied" });
    }
    if (value.currency && value.amount == null) {
      ctx.addIssue({ code: "custom", path: ["currency"], message: "currency may only be supplied with an amount" });
    }
  });

export const evidenceApiSchema = z
  .object({
    actionRequestId: UUID,
    executionConfirmed: z.boolean(),
    signedEvidencePresent: z.boolean().optional().default(false),
    outcome: z.enum(["SUCCEEDED", "FAILED", "CANCELLED", "PARTIAL", "UNKNOWN"]),
    sourceSystem: optionalShortText(128),
    externalReference: optionalShortText(256),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.signedEvidencePresent && !value.executionConfirmed) {
      ctx.addIssue({ code: "custom", path: ["signedEvidencePresent"], message: "signed evidence cannot be asserted without confirmed execution" });
    }
  });

export type ActionGateApiInput = z.infer<typeof actionGateApiSchema>;
export type EvidenceApiInput = z.infer<typeof evidenceApiSchema>;

export function parseJsonWithSchema<T>(schema: z.ZodType<T>, value: unknown): { success: true; data: T } | { success: false; issues: Array<{ path: string; message: string }> } {
  const result = schema.safeParse(value);
  if (result.success) return { success: true, data: result.data };
  return {
    success: false,
    issues: result.error.issues.slice(0, 12).map((issue) => ({ path: issue.path.join("."), message: issue.message })),
  };
}

export function requestBodyTooLarge(request: Request, maxBytes = 32 * 1024): boolean {
  const raw = request.headers.get("content-length");
  if (!raw) return false;
  const length = Number(raw);
  return Number.isFinite(length) && length > maxBytes;
}
