from pathlib import Path

root = Path(__file__).resolve().parents[1]


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected exactly one match in {path}: found {count}")
    path.write_text(text.replace(old, new, 1))


function_old = """language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.action_requests%rowtype;
"""
function_new = """language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_request public.action_requests%rowtype;
"""

for relative in [
    "docs/ai-agent-authority-passport/migration-parts/04-daily-spend-reservations.sql",
    "supabase/migrations/20260913120437_agent_authority_daily_spend_reservations.sql",
]:
    replace_once(root / relative, function_old, function_new)

contract = root / "scripts/verify-agent-authority-release-contract.mjs"
needle = '''forbidText(migrationTextLower, "create or replace function public.agent_authority_has_role", "SECURITY DEFINER membership helper must not live in exposed public schema");
'''
replacement = needle + '''if (/create or replace function public\\.reserve_agent_daily_spend[\\s\\S]*?language plpgsql\\s+security definer/i.test(migrationText)) {
  throw new Error("Agent Authority release contract failed: daily-spend reservation RPC must not use SECURITY DEFINER in exposed public schema");
}
'''
replace_once(contract, needle, replacement)

print("Agent Authority daily-spend function security patch applied")
