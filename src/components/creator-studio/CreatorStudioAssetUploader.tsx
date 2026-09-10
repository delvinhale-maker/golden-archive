import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { registerCreatorStudioAsset } from "@/lib/creator-studio.functions";

const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 20 * 1024 * 1024;

type Kind = "COVER" | "SCREENSHOT" | "LOGO";

export function CreatorStudioAssetUploader({ projectId, onUploaded }: { projectId: string; onUploaded: () => void | Promise<void> }) {
  const register = useServerFn(registerCreatorStudioAsset);
  const [busy, setBusy] = useState(false);

  async function upload(file: File, kind: Kind) {
    if (!ACCEPTED.has(file.type)) return toast.error("Use a JPG, PNG or WebP image.");
    if (file.size <= 0 || file.size > MAX_BYTES) return toast.error("Image must be 20 MB or smaller.");
    setBusy(true);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Sign in again to upload assets.");
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120) || "asset";
      const path = `${auth.user.id}/${projectId}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("creator-studio-assets").upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw new Error("Upload failed. Please try again.");
      try {
        await register({ data: { projectId, kind, storagePath: path, mimeType: file.type, byteSize: file.size, sortOrder: 0 } });
      } catch (error) {
        // No client DELETE grant by design; orphan cleanup is trusted-server maintenance.
        throw error;
      }
      toast.success("Asset added");
      await onUploaded();
    } catch (error: any) {
      toast.error(error?.message ?? "Couldn't upload asset");
    } finally {
      setBusy(false);
    }
  }

  return <div className="grid gap-3 sm:grid-cols-3">
    {([['COVER','Product cover'],['SCREENSHOT','Screenshot'],['LOGO','Logo']] as const).map(([kind,label]) => <label key={kind} className="cursor-pointer rounded-xl border border-dashed border-ink/20 bg-cream/20 p-4 text-center hover:border-gold/60">
      <Upload size={17} className="mx-auto text-gold" />
      <span className="mt-2 block text-sm font-semibold text-navy">{label}</span>
      <span className="mt-1 block text-xs text-mute">JPG, PNG or WebP · max 20 MB</span>
      <input disabled={busy} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ""; if (file) void upload(file, kind); }} />
    </label>)}
  </div>;
}
