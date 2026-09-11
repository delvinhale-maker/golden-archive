import { useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import { ProjectStepNav } from "@/components/creator-studio/ProjectStepNav";
import {
  createUploadUrlFn,
  registerAssetFn,
  attachAssetToProjectFn,
  detachAssetFromProjectFn,
  listProjectAssetsFn,
} from "@/lib/creator-studio/assets.functions";
import type { ProjectAssetRole } from "@/lib/creator-studio/schema";

export const Route = createFileRoute("/_authenticated/creator-studio/$projectId/assets")({
  component: AssetsStepPage,
});

const SLOTS: { role: ProjectAssetRole; label: string; hint: string }[] = [
  { role: "COVER", label: "Cover", hint: "The main image for your video." },
  { role: "SCREENSHOT", label: "Screenshots", hint: "Up to 6 — feature highlights." },
  { role: "LOGO", label: "Logo", hint: "Optional. Shown at the end." },
];

const ACCEPT = "image/png,image/jpeg,image/webp";
const EXT_BY_TYPE: Record<string, "png" | "jpg" | "webp"> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

function AssetsStepPage() {
  const { projectId } = Route.useParams();
  const queryClient = useQueryClient();
  const [uploadingRole, setUploadingRole] = useState<ProjectAssetRole | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingRoleRef = useRef<ProjectAssetRole | null>(null);

  const getUploadUrlFn = useServerFn(createUploadUrlFn);
  const registerFn = useServerFn(registerAssetFn);
  const attachFn = useServerFn(attachAssetToProjectFn);
  const detachFn = useServerFn(detachAssetFromProjectFn);
  const listFn = useServerFn(listProjectAssetsFn);

  const { data: assets, isLoading } = useQuery({
    queryKey: ["creator-studio", "project-assets", projectId],
    queryFn: () => listFn({ data: { projectId } }),
    retry: false,
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ file, role }: { file: File; role: ProjectAssetRole }) => {
      const ext = EXT_BY_TYPE[file.type];
      if (!ext) throw new Error("Please choose a PNG, JPG, or WEBP image");
      if (file.size > 15 * 1024 * 1024) throw new Error("That file is too large (max 15MB)");

      const { signedUrl, token, path } = await getUploadUrlFn({ data: { fileExt: ext } });
      const putRes = await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type, "x-upsert": "false" },
        body: file,
      });
      if (!putRes.ok) throw new Error("Upload failed — try again");
      void token;

      const assetType = role === "COVER" ? "COVER" : role === "LOGO" ? "LOGO" : "SCREENSHOT";
      const asset = await registerFn({
        data: { assetType, storagePath: path, mediaType: file.type, sizeBytes: file.size },
      });
      await attachFn({ data: { projectId, assetId: asset.id, role, sortOrder: 0 } });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["creator-studio", "project-assets", projectId],
      });
    },
    onError: (err: Error) => toast.error(err.message || "Couldn't upload this file"),
    onSettled: () => setUploadingRole(null),
  });

  const removeMutation = useMutation({
    mutationFn: (projectAssetId: string) => detachFn({ data: { projectAssetId } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["creator-studio", "project-assets", projectId],
      });
    },
    onError: (err: Error) => toast.error(err.message || "Couldn't remove this item"),
  });

  function openPicker(role: ProjectAssetRole) {
    pendingRoleRef.current = role;
    fileInputRef.current?.click();
  }

  function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const role = pendingRoleRef.current;
    e.target.value = "";
    if (!file || !role) return;
    setUploadingRole(role);
    uploadMutation.mutate({ file, role });
  }

  const hasCover = (assets ?? []).some((a) => a.role === "COVER");

  return (
    <PublisherShell accent={ACCENTS.creatorStudio}>
      <div className="mx-auto max-w-2xl">
        <ProjectStepNav projectId={projectId} current="assets" />
        <h1 className="text-center font-display text-2xl text-navy">Add your assets</h1>
        <p className="mt-2 text-center text-sm text-mute">
          Cover, screenshots, and an optional logo.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={onFileChosen}
        />

        {isLoading ? (
          <p className="mt-8 text-center text-sm text-mute">Loading…</p>
        ) : (
          <div className="mt-8 space-y-6">
            {SLOTS.map((slot) => {
              const items = (assets ?? []).filter((a) => a.role === slot.role);
              return (
                <div key={slot.role}>
                  <div className="flex items-baseline justify-between">
                    <h3 className="font-display text-base text-navy">{slot.label}</h3>
                    <span className="text-xs text-mute">{slot.hint}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="group relative h-20 w-20 overflow-hidden rounded-lg border border-ink/10 bg-paper"
                      >
                        <button
                          type="button"
                          onClick={() => removeMutation.mutate(item.id)}
                          className="absolute right-1 top-1 z-10 rounded-full bg-white/90 p-1 opacity-0 transition group-hover:opacity-100"
                          aria-label="Remove"
                        >
                          <Trash2 size={12} className="text-destructive" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => openPicker(slot.role)}
                      disabled={uploadingRole === slot.role}
                      className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-ink/20 text-mute transition hover:border-[#7A2E52]/40 disabled:opacity-50"
                    >
                      {uploadingRole === slot.role ? (
                        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                      ) : (
                        <>
                          <Upload size={16} aria-hidden="true" />
                          <span className="text-[10px]">Add</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <Link
            to="/creator-studio/new"
            className="inline-flex items-center gap-2 rounded-full border border-ink/15 px-5 py-3 text-sm font-semibold text-navy"
          >
            Back
          </Link>
          <Link
            to="/creator-studio/$projectId/style"
            params={{ projectId }}
            aria-disabled={!hasCover}
            className={`inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-semibold text-navy ${
              !hasCover ? "pointer-events-none opacity-50" : ""
            }`}
          >
            Continue <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </PublisherShell>
  );
}
