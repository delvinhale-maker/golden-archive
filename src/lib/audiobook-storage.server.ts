/**
 * AurumVault Audiobook Studio — Phase 2 private storage helpers.
 *
 * Scope is deliberately narrow: ONLY the two private audiobook buckets, and
 * every operation refuses a path that does not begin with `<userId>/`, so a
 * server function bug can never read or write another creator's object.
 *
 * No public URL is ever produced.
 */
export const AUDIOBOOK_MANUSCRIPT_BUCKET = "audiobook-manuscripts";
export const AUDIOBOOK_AUDIO_BUCKET = "audiobook-audio";

export type AudiobookBucket =
  | typeof AUDIOBOOK_MANUSCRIPT_BUCKET
  | typeof AUDIOBOOK_AUDIO_BUCKET;

const ALLOWED_BUCKETS: string[] = [AUDIOBOOK_MANUSCRIPT_BUCKET, AUDIOBOOK_AUDIO_BUCKET];

export const DEFAULT_SIGNED_URL_SECONDS = 600;

export function sanitizeStorageFileName(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return cleaned.length > 0 ? cleaned : "file";
}

/** Throws unless the bucket is an audiobook bucket and the path is owner-scoped. */
export function assertOwnedAudiobookPath(
  bucket: string,
  path: string,
  userId: string,
): void {
  if (!ALLOWED_BUCKETS.includes(bucket)) {
    throw new Error("Invalid storage bucket for Audiobook Studio.");
  }
  if (typeof path !== "string" || path.length === 0) {
    throw new Error("Invalid storage path.");
  }
  if (path.includes("..") || path.startsWith("/")) {
    throw new Error("Invalid storage path.");
  }
  if (!path.startsWith(`${userId}/`)) {
    throw new Error("Storage path does not belong to the current user.");
  }
}

export function buildManuscriptPath(
  userId: string,
  projectId: string,
  sourceId: string,
  filename: string,
): string {
  return `${userId}/${projectId}/${sourceId}/${sanitizeStorageFileName(filename)}`;
}

export function buildAudioPath(
  userId: string,
  projectId: string,
  jobId: string,
  version: number,
): string {
  return `${userId}/${projectId}/${jobId}/v${version}.wav`;
}

type StorageClient = {
  storage: {
    from(bucket: string): {
      createSignedUrl(path: string, expires: number): Promise<{ data: { signedUrl: string } | null; error: unknown }>;
      createSignedUploadUrl(path: string): Promise<{ data: unknown; error: unknown }>;
      download(path: string): Promise<{ data: Blob | null; error: unknown }>;
      upload(
        path: string,
        body: ArrayBuffer | Uint8Array | Blob,
        options?: { contentType?: string; upsert?: boolean },
      ): Promise<{ data: unknown; error: unknown }>;
    };
  };
};

function errMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "message" in error) {
    const m = (error as { message?: unknown }).message;
    if (typeof m === "string" && m.length > 0) return m;
  }
  return fallback;
}

export async function createAudiobookSignedUrl(
  supabase: StorageClient,
  bucket: AudiobookBucket,
  path: string,
  userId: string,
  expiresInSeconds: number = DEFAULT_SIGNED_URL_SECONDS,
): Promise<string> {
  assertOwnedAudiobookPath(bucket, path, userId);
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) {
    throw new Error(errMessage(error, "Could not create a signed URL for this file."));
  }
  return data.signedUrl;
}

export async function createAudiobookSignedUpload(
  supabase: StorageClient,
  bucket: AudiobookBucket,
  path: string,
  userId: string,
): Promise<{ signedUrl: string; token: string; path: string }> {
  assertOwnedAudiobookPath(bucket, path, userId);
  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) {
    throw new Error(errMessage(error, "Could not prepare the upload."));
  }
  const upload = data as { signedUrl: string; token: string; path: string };
  return { signedUrl: upload.signedUrl, token: upload.token, path: upload.path };
}

export async function uploadAudiobookBytes(
  supabase: StorageClient,
  bucket: AudiobookBucket,
  path: string,
  userId: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<void> {
  assertOwnedAudiobookPath(bucket, path, userId);
  const body = bytes.slice().buffer as ArrayBuffer;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, body, { contentType, upsert: true });
  if (error) throw new Error(errMessage(error, "Could not store the audio file."));
}

export async function downloadAudiobookBytes(
  supabase: StorageClient,
  bucket: AudiobookBucket,
  path: string,
  userId: string,
): Promise<Uint8Array> {
  assertOwnedAudiobookPath(bucket, path, userId);
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) throw new Error(errMessage(error, "Could not read the stored file."));
  return new Uint8Array(await data.arrayBuffer());
}