import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AuthorityApiError, authorityApiErrorResponse } from "@/lib/agent-authority/api-errors";

const EvidenceSchema = z.object({
  actionRequestId: z.string().uuid(),
  executionStatus: z.enum(["EXECUTED", "FAILED", "CANCELLED"]),
  executedAt: z.string().datetime().nullable().optional(),
  sourceSystem: z.string().min(1).max(160).nullable().optional(),
  externalReference: z.string().max(500).nullable().optional(),
  executionConfirmed: z.boolean().optional(),
  signedEvidencePresent: z.boolean().optional(),
  evidenceReferences: z.array(z.string().max(500)).max(50).optional(),
});

export const Route = createFileRoute("/api/agent-authority/evidence")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { authenticateAuthorityApiKey } = await import("@/lib/agent-authority/api-auth.server");
          const identity = await authenticateAuthorityApiKey(request, "evidence:write");
          let parsed: z.infer<typeof EvidenceSchema>;
          try {
            parsed = EvidenceSchema.parse(await request.json());
          } catch (error) {
            throw new AuthorityApiError(400, "INVALID_INPUT", "Invalid evidence report", {
              issues: error instanceof z.ZodError ? error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) : undefined,
            });
          }
          const { reportExecutionFromApiKey } = await import("@/lib/agent-authority/service.server");
          const result = await reportExecutionFromApiKey(identity, parsed);
          return Response.json(result, {
            status: 200,
            headers: {
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
