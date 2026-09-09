import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCreatorStudioEnabled } from "@/lib/creator-studio-feature-flags.middleware";

const idSchema = z.object({ projectId: z.string().uuid() });

export const getCreatorStudioProjectWorkspace = createServerFn({ method: "POST" })
  .middleware([requireCreatorStudioEnabled, requireSupabaseAuth])
  .inputValidator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: project, error } = await (context.supabase.from("creator_studio_projects" as never) as any)
      .select("id,title,goal,status,duration_seconds,aspect_ratio,style_key,product_title,call_to_action,destination_url,price_label,wizard_step,archived_at")
      .eq("id", data.projectId)
      .eq("owner_user_id", context.userId)
      .maybeSingle();
    if (error || !project || project.archived_at) throw new Error("Creator Studio project not found");

    const [{ data: assets }, { data: jobs }, { data: entitlement }] = await Promise.all([
      (context.supabase.from("creator_studio_assets" as never) as any)
        .select("id,kind,storage_path,mime_type,byte_size,sort_order,created_at")
        .eq("project_id", data.projectId)
        .eq("owner_user_id", context.userId)
        .order("sort_order"),
      (context.supabase.from("creator_studio_render_jobs" as never) as any)
        .select("id,status,duration_seconds,output_url,estimated_cost_usd,actual_cost_usd,created_at,completed_at")
        .eq("project_id", data.projectId)
        .eq("owner_user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(10),
      (context.supabase.from("creator_studio_entitlements" as never) as any)
        .select("plan_key,included_videos,extra_video_credits,period_start,period_end")
        .eq("owner_user_id", context.userId)
        .maybeSingle(),
    ]);

    return {
      project,
      assets: assets ?? [],
      jobs: jobs ?? [],
      entitlement: entitlement ?? {
        plan_key: "FREE",
        included_videos: 1,
        extra_video_credits: 0,
        period_start: null,
        period_end: null,
      },
    };
  });
