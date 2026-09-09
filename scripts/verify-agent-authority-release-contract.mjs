import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const requireText = (text, marker, label) => {
  if (!text.includes(marker)) throw new Error(`Agent Authority release contract failed: ${label}`);
};
const forbidText = (text, marker, label) => {
  if (text.includes(marker)) throw new Error(`Agent Authority release contract failed: ${label}`);
};

const service = read("src/lib/agent-authority/service.server.ts");
const decision = read("src/lib/agent-authority/decision-engine.ts");
const receipt = read("src/lib/agent-authority/receipt.ts");
const apiValidation = read("src/lib/agent-authority/api-validation.ts");
const integrations = read("src/lib/agent-authority/integrations/catalog.ts");
const e2eWorkflow = read(".github/workflows/agent-authority-e2e.yml");
const ui = read("src/routes/_authenticated/agent-authority.tsx");
const e2e = read("tests/agent-authority/agent-authority-authenticated.spec.py");

requireText(service, 'rpc("resolve_agent_authority_approval_atomic"', "approval resolution must use the atomic PostgreSQL RPC");
requireText(service, "assertActionApprovalAuthority", "approval authority must be proven before atomic resolution");
const approvalStart = service.indexOf("export async function resolveApproval(");
const approvalEnd = service.indexOf("export async function reportExecution(", approvalStart);
if (approvalStart < 0 || approvalEnd < 0) throw new Error("Agent Authority release contract failed: approval function boundaries not found");
const approvalBody = service.slice(approvalStart, approvalEnd);
forbidText(approvalBody, '.from("approval_decisions").insert', "resolveApproval must not directly insert an approval decision outside the atomic RPC");
forbidText(approvalBody, '.from("approval_requests").update', "resolveApproval must not directly update approval state outside the atomic RPC");
requireText(service, "Passport policy version changed after authorization; submit a new Action Gate request", "execution must reject stale policy versions");
requireText(service, "Passport authorization has expired; re-evaluate before execution", "execution must reject expired authorization");

requireText(decision, 'passport.status === "SUSPENDED"', "suspended Passports must fail closed");
requireText(decision, 'passport.status === "REVOKED"', "revoked Passports must fail closed");
requireText(decision, 'passport.status !== "AUTHORIZED"', "non-authorized Passports must fail closed");
requireText(decision, '"UNKNOWN_ACTION"', "unknown actions must fail closed");
requireText(decision, 'return result(passport, "BLOCK", ["UNKNOWN_ACTION"])', "unknown actions must return BLOCK");

requireText(receipt, 'input.evidenceLevel === "EXECUTION_VERIFIED" && !input.executionConfirmed', "execution verification must require confirmed execution");
requireText(receipt, 'input.evidenceLevel === "SIGNED_EVIDENCE"', "signed evidence must have an explicit truth check");
requireText(receipt, 'input.evidenceLevel === "APPROVAL_VERIFIED"', "approval verification must require attributable human approval");

const strictCount = (apiValidation.match(/\.strict\(\)/g) || []).length;
if (strictCount < 2) throw new Error("Agent Authority release contract failed: both public API schemas must remain strict");
forbidText(apiValidation, "dailySpendToDate:", "public Action Gate schema must not accept caller-controlled daily spend");
forbidText(apiValidation, "requestedAt:", "public Action Gate schema must not accept caller-controlled request timestamps");
requireText(apiValidation, 'value.executionStatus !== "EXECUTED" && value.executionConfirmed', "failed/cancelled outcomes must not claim confirmed execution");

const providers = ["gmail", "google_drive", "slack", "hubspot", "quickbooks", "stripe", "n8n", "make", "zapier"];
for (const provider of providers) requireText(integrations, `provider: "${provider}"`, `integration catalog must retain ${provider}`);
const foundationCount = (integrations.match(/status: "FOUNDATION_ONLY"/g) || []).length;
if (foundationCount !== providers.length + 1) throw new Error(`Agent Authority release contract failed: expected ${providers.length} provider descriptors plus one type-level FOUNDATION_ONLY marker, found ${foundationCount}`);
requireText(integrations, "assertFoundationOnlyIntegration", "integration execution must remain disabled by an explicit guard");
requireText(integrations, "execution is not enabled", "integration guard must remain fail closed");

requireText(e2eWorkflow, "ypelutaddlibqvpaekyq", "authenticated E2E must explicitly deny the Digital Rights Passport staging project");
requireText(e2eWorkflow, "AURUMVAULT_PRODUCTION_PROJECT_ID", "authenticated E2E must compare against production project identity");
requireText(e2eWorkflow, "RIGHTS_PASSPORT_STAGING_PROJECT_ID", "authenticated E2E must compare against Rights Passport staging identity");
requireText(ui, 'data-testid="agent-authority-workspace-select"', "workspace selector must expose a stable authenticated E2E locator");
forbidText(e2e, "select_option(label=lambda", "Playwright must not use predicate callbacks with select_option");
requireText(e2e, 'get_by_test_id("agent-authority-workspace-select")', "authenticated E2E must use the stable workspace selector locator");

const migrationDir = path.join(root, "supabase/migrations");
const migrationFiles = fs.existsSync(migrationDir)
  ? fs.readdirSync(migrationDir).filter((name) => /agent_authority/.test(name) && name.endsWith(".sql")).sort()
  : [];
if (migrationFiles.length < 3) throw new Error(`Agent Authority release contract failed: expected at least 3 CLI-generated Agent Authority migrations, found ${migrationFiles.length}`);
const migrationText = migrationFiles.map((name) => fs.readFileSync(path.join(migrationDir, name), "utf8")).join("\n");
for (const marker of [
  "enable row level security",
  "resolve_agent_authority_approval_atomic",
  "for update",
  "authorization_receipts",
]) requireText(migrationText.toLowerCase(), marker.toLowerCase(), `migration set must retain ${marker}`);

console.log(`AGENT_AUTHORITY_RELEASE_CONTRACT_PASS migrations=${migrationFiles.length} providers=${providers.length}`);
