import { createFileRoute } from "@tanstack/react-router";
import { AuthorityApiError, authorityApiErrorResponse } from "@/lib/agent-authority/api-errors";
import { evidenceApiSchema, parseJsonWithSchema, requestBodyTooLarge } from "@/lib/agent-authority/api-validation";

export const Route = createFileRoute("/api/agent-authority/evidence")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          if (requestBodyTooLarge(request)) {
            throw new AuthorityApiError(413, "INVALID_INPUT", "Evidence report body exceeds 32 KiB");
          }
          const { authenticateAuthorityApiKey } = await import("@/lib/agent-authority/api-auth.server");
          const identity = await authenticateAuthorityApiKey(request, "evidence:write");
          let raw: unknown;
          try {
            raw = await request.json();
          } catch {
            throw new AuthorityApiError(400, "INVALID_INPUT", "Request body must be valid JSON");
          }
          const parsed = parseJsonWithSchema(evidenceApiSchema, raw);
          if (!parsed.success) {
            throw new AuthorityApiError(400, "INVALID_INPUT", "Invalid evidence report", { issues: parsed.issues });
          }
          const { reportExecutionFromApiKey } = await import("@/lib/agent-authority/service.server");
          const result = await reportExecutionFromApiKey(identity, {
            actionRequestId: parsed.data.actionRequestId,
            executionStatus: parsed.data.executionStatus,
            sourceSystem: parsed.data.sourceSystem,
            externalReference: parsed.data.externalReference,
            executionConfirmed: parsed.data.executionConfirmed,
            signedEvidencePresent: parsed.data.signedEvidencePresent,
            evidenceReferences: parsed.data.evidenceReferences,
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
          return authorityApiErrorResponse(error, "Evidence report failed");
        }
      },
    },
  },
});