import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CREATOR_STUDIO_BUCKET = "creator-studio-assets";
const SIGNED_URL_TTL_SECONDS = 15 * 60;

export type CreatorStudioSignedAssets = {
  cover?: string;
  screenshots: string[];
  logo?: string;
};

type AssetRow = {
  id: string;
  owner_user_id: string;
  project_id: string;
  kind: "COVER" | "SCREENSHOT" | "LOGO" | "OTHER";
  storage_path: string;
  sort_order: number;
};

export async function getSignedCreatorStudioAssets(projectId: string, ownerUserId: string): Promise<CreatorStudioSignedAssets> {
  const { data: project, error: projectError } = await (supabaseAdmin.from("creator_studio_projects" as never) as any)
    .select("id,owner_user_id")
    .eq("id", projectId)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();

  if (projectError || !project) throw new Error("CREATOR_STUDIO_PROJECT_NOT_FOUND");

  const { data, error } = await (supabaseAdmin.from("creator_studio_assets" as never) as any)
    .select("id,owner_user_id,project_id,kind,storage_path,sort_order")
    .eq("project_id", projectId)
    .eq("owner_user_id", ownerUserId)
    .order("sort_order", { ascending: true });

  if (error) throw new Error("CREATOR_STUDIO_ASSETS_UNAVAILABLE");

  const assets = (data ?? []) as AssetRow[];
  const signed: CreatorStudioSignedAssets = { screenshots: [] };

  for (const asset of assets) {
    if (!asset.storage_path.startsWith(`${ownerUserId}/`)) throw new Error("CREATOR_STUDIO_ASSET_PATH_INVALID");
    const { data: signedUrl, error: signError } = await supabaseAdmin.storage
      .from(CREATOR_STUDIO_BUCKET)
      .createSignedUrl(asset.storage_path, SIGNED_URL_TTL_SECONDS);

    if (signError || !signedUrl?.signedUrl) throw new Error("CREATOR_STUDIO_ASSET_SIGNING_FAILED");

    if (asset.kind === "COVER" && !signed.cover) signed.cover = signedUrl.signedUrl;
    else if (asset.kind === "SCREENSHOT") signed.screenshots.push(signedUrl.signedUrl);
    else if (asset.kind === "LOGO" && !signed.logo) signed.logo = signedUrl.signedUrl;
  }

  return signed;
}
