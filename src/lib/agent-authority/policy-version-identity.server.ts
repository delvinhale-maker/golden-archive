export async function loadPassportVersionIdentity(input: {
  client: any;
  workspaceId: string;
  passportId: string;
  passportVersion: number;
}): Promise<{ passportCode: string; agentName: string }> {
  const [{ data: passport, error: passportError }, { data: version, error: versionError }] = await Promise.all([
    input.client
      .from("agent_passports")
      .select("passport_code,agent_name")
      .eq("workspace_id", input.workspaceId)
      .eq("id", input.passportId)
      .single(),
    input.client
      .from("agent_passport_versions")
      .select("identity_snapshot")
      .eq("workspace_id", input.workspaceId)
      .eq("passport_id", input.passportId)
      .eq("version", input.passportVersion)
      .maybeSingle(),
  ]);
  if (passportError || !passport) throw passportError ?? new Error("Passport identity not found");
  if (versionError) throw versionError;
  const snapshot = version?.identity_snapshot as Record<string, unknown> | null | undefined;
  const agentName = typeof snapshot?.agentName === "string" && snapshot.agentName.trim() ? snapshot.agentName.trim() : passport.agent_name;
  return { passportCode: passport.passport_code, agentName };
}
