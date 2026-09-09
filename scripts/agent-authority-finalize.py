from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"missing patch marker: {label}")
    return text.replace(old, new, 1)


ui_path = Path("src/routes/_authenticated/agent-authority.tsx")
ui = ui_path.read_text()
ui = replace_once(
    ui,
    'const tabs: Tab[] = ["Command Center", "Agents", "Approvals", "Risk & Least Privilege", "Simulations", "Incidents", "Delegations", "Activity", "Receipts", "Policies", "Data", "Reviews", "Integrations", "Reports", "Settings"];',
    '''type WorkspaceRole = "OWNER" | "ADMIN" | "APPROVER" | "AUDITOR" | "MEMBER";
const allTabs: Tab[] = ["Command Center", "Agents", "Approvals", "Risk & Least Privilege", "Simulations", "Incidents", "Delegations", "Activity", "Receipts", "Policies", "Data", "Reviews", "Integrations", "Reports", "Settings"];
const roleTabs: Record<WorkspaceRole, Tab[]> = {
  OWNER: allTabs,
  ADMIN: allTabs,
  APPROVER: ["Command Center", "Agents", "Approvals", "Risk & Least Privilege", "Simulations", "Incidents", "Delegations", "Activity", "Policies", "Reviews"],
  AUDITOR: ["Command Center", "Agents", "Risk & Least Privilege", "Activity", "Receipts", "Policies", "Reviews", "Reports"],
  MEMBER: ["Command Center", "Agents", "Risk & Least Privilege", "Simulations", "Activity", "Policies", "Reviews"],
};
function normalizeWorkspaceRole(value: unknown): WorkspaceRole {
  return value === "OWNER" || value === "ADMIN" || value === "APPROVER" || value === "AUDITOR" || value === "MEMBER" ? value : "MEMBER";
}''',
    "role tab model",
)
refresh_pattern = re.compile(r'  async function refresh\(selectedWorkspace = workspaceId\) \{.*?  const selectedWorkspace = workspaces\.find\(\(item\) => item\.id === workspaceId\);\n', re.S)
refresh_match = refresh_pattern.search(ui)
if not refresh_match:
    raise SystemExit("missing patch marker: refresh block")
refresh_replacement = '''  async function refresh(selectedWorkspace = workspaceId) {
    if (!selectedWorkspace) return;
    const role = normalizeWorkspaceRole(workspaces.find((item) => item.id === selectedWorkspace)?.role);
    const canResolveApprovals = role === "OWNER" || role === "ADMIN" || role === "APPROVER";
    const canReadDelegations = role !== "MEMBER";
    setBusy(true); setError(null);
    try {
      const [command, approvalRows, events, readinessResult, incidentRows, delegationRows, changeRows, classificationRows] = await Promise.all([
        getCommandCenter({ data: { workspaceId: selectedWorkspace } }),
        canResolveApprovals ? getApprovals({ data: { workspaceId: selectedWorkspace } }) : Promise.resolve([]),
        getEvidence({ data: { workspaceId: selectedWorkspace, limit: 100 } }),
        getReadiness({ data: { workspaceId: selectedWorkspace } }),
        getIncidents({ data: { workspaceId: selectedWorkspace, limit: 100 } }),
        canReadDelegations ? getDelegations({ data: { workspaceId: selectedWorkspace } }) : Promise.resolve([]),
        getPolicyChanges({ data: { workspaceId: selectedWorkspace } }),
        getClassifications({ data: { workspaceId: selectedWorkspace } }),
      ]);
      setDashboard(command); setApprovals(approvalRows as any[]); setLedger(events as any[]); setReadiness(readinessResult);
      setIncidents(incidentRows as any[]); setDelegations(delegationRows as any[]); setPolicyChanges(changeRows as any[]); setClassifications(classificationRows as any[]);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load Agent Authority workspace"); }
    finally { setBusy(false); }
  }
  useEffect(() => { void loadWorkspaceList(); }, []);
  useEffect(() => { if (workspaceId && workspaces.some((item) => item.id === workspaceId)) void refresh(workspaceId); }, [workspaceId, workspaces]);
  const selectedWorkspace = workspaces.find((item) => item.id === workspaceId);
  const workspaceRole = normalizeWorkspaceRole(selectedWorkspace?.role);
  const canAdmin = workspaceRole === "OWNER" || workspaceRole === "ADMIN";
  const canApprove = canAdmin || workspaceRole === "APPROVER";
  const visibleTabs = roleTabs[workspaceRole];
  useEffect(() => { if (!visibleTabs.includes(tab)) setTab("Command Center"); }, [workspaceRole, tab]);
'''
ui = ui[:refresh_match.start()] + refresh_replacement + ui[refresh_match.end():]
ui = replace_once(
    ui,
    '<div className="flex flex-wrap gap-3"><select value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-white">{workspaces.map((w) => <option className="text-slate-900" key={w.id} value={w.id}>{w.name}</option>)}</select><button onClick={() => setShowRegister(true)} className="rounded-xl bg-[#B8860B] px-4 py-2.5 text-sm font-bold text-white">Register Agent</button></div>',
    '<div className="flex flex-wrap items-center gap-3"><select data-testid="agent-authority-workspace-select" value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-white">{workspaces.map((w) => <option className="text-slate-900" key={w.id} value={w.id}>{w.name}</option>)}</select><span data-testid="agent-authority-role" className="rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold tracking-wide text-slate-100">{workspaceRole}</span>{canAdmin && <button onClick={() => setShowRegister(true)} className="rounded-xl bg-[#B8860B] px-4 py-2.5 text-sm font-bold text-white">Register Agent</button>}</div>',
    "role-aware header",
)
ui = replace_once(ui, '{tabs.map((item) => <button key={item}', '{visibleTabs.map((item) => <button key={item}', "role-aware navigation")
ui = replace_once(
    ui,
    '<CommandCenter dashboard={dashboard} readiness={readiness} onRegister={() => setShowRegister(true)} onSuspend={(passportId) => setSuspension({ passportId, reason: "" })} />',
    '<CommandCenter dashboard={dashboard} readiness={readiness} canAdmin={canAdmin} onRegister={() => setShowRegister(true)} onSuspend={(passportId) => setSuspension({ passportId, reason: "" })} />',
    "command center permissions",
)
ui = replace_once(ui, '<ApprovalCenter approvals={approvals} onResolve={handleApproval} />', '<ApprovalCenter approvals={approvals} canResolve={canApprove} onResolve={handleApproval} />', "approval UI permissions")
ui = replace_once(ui, '<PolicyPanel workspaceId={workspaceId} passports={dashboard?.passports ?? []} requests={policyChanges} onChanged={() => refresh()} />', '<PolicyPanel workspaceId={workspaceId} passports={dashboard?.passports ?? []} requests={policyChanges} canResolve={canApprove} onChanged={() => refresh()} />', "policy UI permissions")
ui = replace_once(ui, '{showRegister && <RegisterAgentModal', '{showRegister && canAdmin && <RegisterAgentModal', "register modal permission")
ui = replace_once(ui, '{suspension && <div className="fixed inset-0', '{suspension && canAdmin && <div className="fixed inset-0', "suspension modal permission")
ui = replace_once(
    ui,
    'function CommandCenter({ dashboard, readiness, onRegister, onSuspend }: { dashboard: any; readiness: any; onRegister: () => void; onSuspend: (id: string) => void }) {',
    'function CommandCenter({ dashboard, readiness, canAdmin, onRegister, onSuspend }: { dashboard: any; readiness: any; canAdmin: boolean; onRegister: () => void; onSuspend: (id: string) => void }) {',
    "command center signature",
)
ui = replace_once(
    ui,
    '<button onClick={onRegister} className="rounded-xl bg-[#0F1E35] px-4 py-2 text-sm font-semibold text-white">Register Agent</button>',
    '{canAdmin ? <button onClick={onRegister} className="rounded-xl bg-[#0F1E35] px-4 py-2 text-sm font-semibold text-white">Register Agent</button> : <Badge>Read-only role view</Badge>}',
    "registry admin action",
)
ui = replace_once(
    ui,
    '<td><button disabled={["SUSPENDED","REVOKED"].includes(a.status)} onClick={()=>onSuspend(a.id)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-30">Suspend</button></td>',
    '<td>{canAdmin ? <button disabled={["SUSPENDED","REVOKED"].includes(a.status)} onClick={()=>onSuspend(a.id)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-30">Suspend</button> : <span className="text-xs text-slate-400">View only</span>}</td>',
    "registry suspension permission",
)
ui = replace_once(
    ui,
    'function ApprovalCenter({ approvals, onResolve }: { approvals: any[]; onResolve: (id:string,d:"APPROVED"|"REJECTED")=>void }) {',
    'function ApprovalCenter({ approvals, canResolve, onResolve }: { approvals: any[]; canResolve: boolean; onResolve: (id:string,d:"APPROVED"|"REJECTED")=>void }) {',
    "approval signature",
)
ui = replace_once(ui, 'row.status==="PENDING"&&<div className="flex gap-2">', 'row.status==="PENDING"&&canResolve&&<div className="flex gap-2">', "approval action gating")
ui = replace_once(
    ui,
    'function PolicyPanel({ workspaceId, passports, requests, onChanged }: { workspaceId:string; passports:any[]; requests:any[]; onChanged:()=>Promise<void> }) {',
    'function PolicyPanel({ workspaceId, passports, requests, canResolve, onChanged }: { workspaceId:string; passports:any[]; requests:any[]; canResolve:boolean; onChanged:()=>Promise<void> }) {',
    "policy signature",
)
ui = replace_once(ui, 'r.status==="PENDING"&&<div className="mt-3 flex gap-2">', 'r.status==="PENDING"&&canResolve&&<div className="mt-3 flex gap-2">', "policy decision gating")
ui_path.write_text(ui)


e2e_path = Path("tests/agent-authority/agent-authority-authenticated.spec.py")
e2e = e2e_path.read_text()
insert_after = '''def ok(message: str) -> None:\n    print(f"PASS: {message}")\n'''
helper = '''def ok(message: str) -> None:\n    print(f"PASS: {message}")\n\n\nasync def select_option_containing(select, needle: str) -> None:\n    options = select.locator("option")\n    for index in range(await options.count()):\n        option = options.nth(index)\n        text = (await option.text_content()) or ""\n        if needle in text:\n            value = await option.get_attribute("value")\n            if value is None:\n                fail(f"Option containing {needle!r} has no value")\n            await select.select_option(value=value)\n            return\n    fail(f"No select option contained {needle!r}")\n'''
e2e = replace_once(e2e, insert_after, helper, "E2E option helper")
e2e = replace_once(e2e, '    await passport_select.select_option(label=lambda text: agent_name in text)', '    await select_option_containing(passport_select, agent_name)', "invalid Playwright selector")
e2e = replace_once(
    e2e,
    '        await expect(page.get_by_role("button", name="Register Agent").first).to_be_visible(timeout=15000)\n        ok("Loaded existing test governance workspace")',
    '        await expect(page.get_by_role("button", name="Register Agent").first).to_be_visible(timeout=15000)\n        await expect(page.get_by_test_id("agent-authority-workspace-select")).to_be_visible(timeout=15000)\n        ok("Loaded existing test governance workspace")',
    "stable workspace E2E locator",
)
e2e_path.write_text(e2e)


e2e_workflow_path = Path(".github/workflows/agent-authority-e2e.yml")
e2e_workflow = e2e_workflow_path.read_text()
e2e_workflow = replace_once(
    e2e_workflow,
    '          test -n "$STAGING_PROJECT_ID" || { echo "Missing dedicated Agent Authority staging project id"; exit 1; }\n          test -n "$STORAGE_KEY" || { echo "Missing Agent Authority browser storage key"; exit 1; }',
    '          test -n "$STAGING_PROJECT_ID" || { echo "Missing dedicated Agent Authority staging project id"; exit 1; }\n          test -n "$PROD_PROJECT_ID" || { echo "Missing production project identity safety secret"; exit 1; }\n          test -n "$RIGHTS_PROJECT_ID" || { echo "Missing Digital Rights Passport staging identity safety secret"; exit 1; }\n          test "$STAGING_PROJECT_ID" != "ypelutaddlibqvpaekyq" || { echo "Refusing known Digital Rights Passport staging backend"; exit 1; }\n          test -n "$STORAGE_KEY" || { echo "Missing Agent Authority browser storage key"; exit 1; }',
    "fail-closed staging identity",
)
e2e_workflow = e2e_workflow.replace('if [ -n "$PROD_PROJECT_ID" ] && [ "$STAGING_PROJECT_ID" = "$PROD_PROJECT_ID" ]; then', 'if [ "$STAGING_PROJECT_ID" = "$PROD_PROJECT_ID" ]; then', 1)
e2e_workflow = e2e_workflow.replace('if [ -n "$RIGHTS_PROJECT_ID" ] && [ "$STAGING_PROJECT_ID" = "$RIGHTS_PROJECT_ID" ]; then', 'if [ "$STAGING_PROJECT_ID" = "$RIGHTS_PROJECT_ID" ]; then', 1)
e2e_workflow_path.write_text(e2e_workflow)


gate_path = Path(".github/workflows/agent-authority-gate.yml")
gate = gate_path.read_text()
for anchor in ['      - "docs/ai-agent-authority-passport/**"\n']:
    replacement = anchor + '      - "supabase/migrations/*_agent_authority_*.sql"\n      - "tests/agent-authority/**"\n      - "scripts/verify-agent-authority-release-contract.mjs"\n      - ".github/workflows/agent-authority-e2e.yml"\n'
    if gate.count(anchor) != 2:
        raise SystemExit("unexpected Agent Authority gate path layout")
    gate = gate.replace(anchor, replacement)
gate = replace_once(
    gate,
    '      - name: Build AurumVault application\n        run: bun run build',
    '      - name: Verify permanent Agent Authority release contract\n        run: bun run scripts/verify-agent-authority-release-contract.mjs\n\n      - name: Build AurumVault application\n        run: bun run build',
    "release contract gate step",
)
gate_path.write_text(gate)


contract_path = Path("scripts/verify-agent-authority-release-contract.mjs")
contract = contract_path.read_text().replace("RIGHTS_PASSPORT_STAGING_PROJECT_ID", "DIGITAL_RIGHTS_PASSPORT_STAGING_PROJECT_ID")
contract_path.write_text(contract)

print("AGENT_AUTHORITY_FINALIZE_PATCH_OK")
