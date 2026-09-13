from pathlib import Path

root = Path(__file__).resolve().parents[1]


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected exactly one match in {path}: found {count}\n--- OLD ---\n{old}")
    path.write_text(text.replace(old, new, 1))


service = root / "src/lib/agent-authority/service.server.ts"
replace_once(
    service,
    'import { loadRecordedDailyPurchaseSpend } from "./daily-spend.server";',
    'import { applyDailySpendReservation, approvalExpiryForReservation, reserveDailyPurchaseSpend } from "./daily-spend-reservation.server";',
)

replace_once(
    service,
    '''  const dailySpendToDate =
    input.request.amountKind === "PURCHASE" && policy.limits.maxDailySpend != null
      ? await loadRecordedDailyPurchaseSpend({ client, workspaceId: input.workspaceId, passportId: input.passportId })
      : 0;
  const requestForEvaluation = {
    ...input.request,
    dataClassification: resolvedClassification,
    // Never trust a caller-supplied spend-to-date value for an authorization limit.
    dailySpendToDate,
  };
  const evaluated = evaluateActionGate(policy, requestForEvaluation);
  const requestedAt = input.request.requestedAt ?? new Date().toISOString();
''',
    '''  // Action timestamps and daily spend state are server/database-owned trust inputs.
  const requestedAt = new Date().toISOString();
  const effectiveCurrency = input.request.amount != null
    ? (input.request.currency?.toUpperCase() ?? policy.limits.currency.toUpperCase())
    : null;
  const requestForEvaluation = {
    ...input.request,
    dataClassification: resolvedClassification,
    currency: effectiveCurrency,
    requestedAt,
    // Daily spend is enforced atomically after the immutable Action Request exists.
    dailySpendToDate: 0,
  };
  let evaluated = evaluateActionGate(policy, requestForEvaluation, new Date(requestedAt));
''',
)

replace_once(
    service,
    '      currency: input.request.currency?.toUpperCase() ?? null,',
    '      currency: effectiveCurrency,',
)

replace_once(
    service,
    '''  const policyCode = `PASSPORT:${policy.passportCode}`;
''',
    '''  let dailySpendReservation: Awaited<ReturnType<typeof reserveDailyPurchaseSpend>> | null = null;
  if (
    evaluated.decision !== "BLOCK" &&
    input.request.amountKind === "PURCHASE" &&
    input.request.amount != null &&
    policy.limits.maxDailySpend != null
  ) {
    dailySpendReservation = await reserveDailyPurchaseSpend({
      client,
      workspaceId: input.workspaceId,
      actionRequestId: actionRequest.id,
    });
    evaluated = applyDailySpendReservation(evaluated, dailySpendReservation);
  }

  const policyCode = `PASSPORT:${policy.passportCode}`;
''',
)

replace_once(
    service,
    '''      policyVersion: policy.version,
    },
''',
    '''      policyVersion: policy.version,
      dailySpendReservationId: dailySpendReservation?.reservationId ?? null,
      dailySpendProjectedAmount: dailySpendReservation?.projectedAmount ?? null,
    },
''',
)

replace_once(
    service,
    '''    const expiresAt = new Date(new Date(requestedAt).getTime() + 24 * 60 * 60 * 1000).toISOString();
''',
    '''    const expiresAt = approvalExpiryForReservation(
      requestedAt,
      dailySpendReservation?.reservationExpiresAt ?? null,
    );
''',
)

contract = root / "scripts/verify-agent-authority-release-contract.mjs"
replace_once(
    contract,
    '''requireText(service, "Passport authorization has expired; re-evaluate before execution", "execution must reject expired authorization");
''',
    '''requireText(service, "Passport authorization has expired; re-evaluate before execution", "execution must reject expired authorization");
requireText(service, "reserveDailyPurchaseSpend", "daily purchase limits must use the atomic reservation RPC path");
requireText(service, "applyDailySpendReservation", "reservation rejection must fail closed into the Action Gate decision");
requireText(service, "const requestedAt = new Date().toISOString()", "Action Request timestamps must be server owned");
forbidText(service, "loadRecordedDailyPurchaseSpend", "daily spend authorization must not use read-then-check accounting");
forbidText(service, "input.request.requestedAt ??", "Action Request timestamps must not trust caller input");
''',
)

replace_once(
    contract,
    '''  "set search_path = ''",
]) requireText(migrationTextLower, marker.toLowerCase(), `migration set must retain ${marker}`);
''',
    '''  "set search_path = ''",
  "agent_daily_spend_reservations",
  "reserve_agent_daily_spend",
  "pg_advisory_xact_lock",
  "execution_daily_spend_reservation_required",
  "settle_agent_daily_spend_from_receipt",
  "execution_passport_not_authorized",
  "ad.approval_request_id",
]) requireText(migrationTextLower, marker.toLowerCase(), `migration set must retain ${marker}`);
''',
)

rls = root / "supabase/tests/agent_authority_rls.sql"
replace_once(rls, "select plan(20);", "select plan(21);")
replace_once(
    rls,
    '''select throws_ok($$select count(*) from public.agent_authority_api_rate_windows$$, '42501', null, 'rate windows are not client-readable');
''',
    '''select throws_ok($$select count(*) from public.agent_authority_api_rate_windows$$, '42501', null, 'rate windows are not client-readable');
select throws_ok($$select count(*) from public.agent_daily_spend_reservations$$, '42501', null, 'daily spend reservations are server-only');
''',
)

print("Agent Authority daily spend source patch applied")
