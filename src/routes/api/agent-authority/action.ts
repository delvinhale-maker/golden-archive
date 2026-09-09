import { createFileRoute } from "@tanstack/react-router";
import { AuthorityApiError, authorityApiErrorResponse } from "@/lib/agent-authority/api-errors";
import { actionGateApiSchema, parseJsonWithSchema, requestBodyTooLarge } from "@/lib/agent-authority/api-validation";

export const Route = createFileRoute("/api/agent-authority/action")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          if (requestBodyTooLarge(request)) {
            throw new AuthorityApiError(413, "INVALID_INPUT", "Action Gate request body exceeds 32 KiB");
          }
          const { authenticateAuthorityApiKey } = await import("@/lib/agent-authority/api-auth.server");
          const identity = await authenticateAuthorityApiKey(request, "decisions:write");
          let raw: unknown;
          try {
            raw = await request.json();
          } catch {
            throw new AuthorityApiError(400, "INVALID_INPUT", "Request body must be valid JSON");
          }
          const parsed = parseJsonWithSchema(actionGateApiSchema, raw);
          if (!parsed.success) {
            throw new AuthorityApiError(400, "INVALID_INPUT", "Invalid Action Gate request", { issues: parsed.issues });
          }
          const { submitActionFromApiKey } = await import("@/lib/agent-authority/service.server");
          const result = await submitActionFromApiKey(identity, {
            passportId: parsed.data.passportId,
            request: {
              actionKey: parsed.data.actionKey,
              target: parsed.data.target,
              resourceKey: parsed.data.resourceKey,
              system: parsed.data.system,
              amount: parsed.data.amount,
              amountKind: parsed.data.amountKind,
              currency: parsed.data.currency,
              externalCommunication: parsed.data.externalCommunication,
              financialAction: parsed.data.financialAction,
              sensitiveData: parsed.data.sensitiveData,
              highRisk: parsed.data.highRisk,
              dataClassification: parsed.data.dataClassification,
              idempotencyKey: parsed.data.idempotencyKey,
            },
          });
          return Response.json(result, {
            status: 200,
            headers: {
              "cache-control": "no-store",
              "x-content-type-options": "nosniff",
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