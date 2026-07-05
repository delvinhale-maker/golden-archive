import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validateManuscriptBytes } from "@/lib/manuscript-validate";

/**
 * Server-side manuscript validator. The client already validates before
 * upload, but a bad actor (or a stale draft) could still push a malformed
 * file into storage. This function re-reads the object from `product-files`
 * and rejects it before the product is allowed to publish.
 *
 * Auth: the caller must be signed in AND own the object (path prefix is
 * `<seller_id>/…`). Admins may validate any object.
 */
export const validateStoredManuscript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { filePath: string }) => {
    if (!data.filePath || typeof data.filePath !== "string") {
      throw new Error("filePath required");
    }
    if (data.filePath.length > 512) throw new Error("filePath too long");
    if (data.filePath.includes("..")) throw new Error("Invalid filePath");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as {
      userId: string;
      supabase: import("@supabase/supabase-js").SupabaseClient;
    };
    const pathPrefix = data.filePath.split("/")[0] ?? "";

    if (pathPrefix !== userId) {
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });
      if (!isAdmin) return { ok: false as const, reason: "Not your file." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const dl = await supabaseAdmin.storage.from("product-files").download(data.filePath);
    if (dl.error || !dl.data) {
      return { ok: false as const, reason: "File not found in storage." };
    }
    const buf = new Uint8Array(await dl.data.arrayBuffer());
    const filename = data.filePath.split("/").pop() ?? "file";
    const result = validateManuscriptBytes(buf, filename);
    if (result.ok) return { ok: true as const, ext: result.ext };
    return { ok: false as const, reason: result.reason, ext: result.ext };
  });
