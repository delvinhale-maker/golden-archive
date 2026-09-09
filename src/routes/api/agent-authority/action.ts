import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AuthorityApiError, authorityApiErrorResponse } from "@/lib/agent-authority/api-errors";

const ActionSchema = z.object({
  passportId: z.string().uuid(),
  actionKey: z.string().min(1).max(160),
  target: z.string().max(500).nullable().optional(),
  resourceKey: z.string().max(240).nullable().optional(),
  system: z.string().max(160).nullable().optional(),
  amount: z.number().nonnegative().nullable().optional(),
  amountKind: z.enum(["PURCHASE", "REFUND", "INVOICE", "OTHER"]).nullable().optional(),
  currency: z.string().length(3).nullable().optional(),
  dailySpendToDate: z.number().nonnegative().nullable().optional(),
  externalCommunication: z.boolean().optional(),
  financialAction: z.boolean().optional(),
  sensitiveData: z.boolean().optional(),
  highRisk: z.boolean().optional(),
  dataClassification: z.enum(["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"]).nullable().optional(),
  idempotencyKey: z.string().min(8).max(200),
});

export const Route = createFileRoute("/api/agent-authority/action")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { authenticateAuthorityApiKey } = await import("@/lib/agent-authority/api-auth.server");
          const identity = await authenticateAuthorityApiKey(request, "decisions:write");
          let parsed: z.infer<typeof ActionSchema>;
          try {
            parsed = ActionSchema.parse(await request.json());
          } catch (error) {
            throw new AuthorityApiError(400, "INVALID_INPUT", "Invalid Action Gate request", {
              issues: error instanceof z.ZodError ? error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) : undefined,
            });
          }
          const { submitActionFromApiKey } = await import("@/lib/agent-authority/service.server");
          const result = await submitActionFromApiKey(identity, {
            passportId: parsed.passportId,
            request: {
              actionKey: parsed.actionKey,
              target: parsed.target,
              resourceKey: parsed.resourceKey,
              system: parsed.system,
              amount: parsed.amount,
              amountKind: parsed.amountKind,
              currency: parsed.currency?.toUpperCase(),
              dailySpendToDate: parsed.dailySpendToDate,
              externalCommunication: parsed.externalCommunication,
              financialAction: parsed.financialAction,
              sensitiveData: parsed.sensitiveData,
              highRisk: parsed.highRisk,
              dataClassification: parsed.dataClassification,
              idempotencyKey: parsed.idempotencyKey,
            },
          });
          return Response.json(result, {
            status: 200,
            headers: {
              "x-ratelimit-limit": String(identity.rateLimitPerMinute),
              "x-ratelimit-remaining": String(identity.rateLimitRemaining),
              "x-ratelimit-reset": identity.rateLimitResetAt,
            },
          });
        } catch (error) {
          return authorityApiErrorResponse(error, "Action Gate request failed");
        }
      },
    },
  },
});
