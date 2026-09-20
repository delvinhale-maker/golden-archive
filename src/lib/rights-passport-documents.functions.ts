/**
 * AurumVault Digital Rights Passport Generator — Round 3 document server
 * functions.
 *
 * Upload is two-step, mirroring why the storage path convention
 * ({user_id}/{passport_key}/{document_id}/{sanitized_filename}) needs a
 * document_id before any bytes are written:
 *
 *   1. beginDocumentUpload — verifies passport ownership, validates
 *      mime/size, mints a documentId + storage path. No DB row yet.
 *   2. (client uploads directly to that path via the RLS-bound storage
 *      client — same pattern as ProductDeliveryFilesManager.tsx.)
 *   3. registerDocument — verifies the object actually landed in storage at
 *      the expected path/size (via supabaseAdmin, mirroring
 *      manuscript-validate.functions.ts's existence check) before inserting
 *      the row with that same id. A client cannot register metadata for
 *      bytes it never uploaded, or claim a size that doesn't match reality.
 *
 * getDocumentSignedUrl is the only way storage_path ever leaves this
 * module — it is never returned directly to the client.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRightsPassportEnabled } from "@/lib/rights-passport-feature-flags.middleware";
import {
  registerDocumentSchema,
  sanitizeFileName,
  ALLOWED_MIME_TYPES,
  MAX_DOCUMENT_BYTES,
  DOCUMENT_LIST_COLS,
  DOCUMENT_INTERNAL_COLS,
  type DocumentRow,
  type DocumentRowInternal,
} from "@/lib/rights-passport-documents.schema";

const DOCUMENT_BUCKET = "digital-rights-evidence";

async function assertOwnsPassportKey(
  supabase: any,
  userId: string,
  passportKey: string,
): Promise<void> {
  const { data } = await supabase
    .from("rights_passports" as never)
    .select("id" as never)
    .eq("passport_key" as never, passportKey)
    .eq("owner_user_id" as never, userId)
    .limit(1)
    .maybeSingle();
  if (!data) throw new Error("Passport not found");
}

const beginUploadSchema = z.object({
  passportKey: z.string().uuid(),
  originalFileName: z.string().trim().min(1).max(300),
  mimeType: z.enum(ALLOWED_MIME_TYPES),
  fileSizeBytes: z.number().int().positive().max(MAX_DOCUMENT_BYTES),
});

export const beginDocumentUpload = createServerFn({ method: "POST" })
  .middleware([requireRightsPassportEnabled, requireSupabaseAuth])
  .inputValidator((input: unknown) => beginUploadSchema.parse(input))
  .handler(
    async ({
      data,
      context,
    }): Promise<{ documentId: string; storagePath: string; bucket: string }> => {
      const { supabase, userId } = context;
      await assertOwnsPassportKey(supabase, userId, data.passportKey);

      const documentId = crypto.randomUUID();
      const safeName = sanitizeFileName(data.originalFileName);
      const storagePath = `${userId}/${data.passportKey}/${documentId}/${safeName}`;

      return { documentId, storagePath, bucket: DOCUMENT_BUCKET };
    },
  );

const registerSchema = registerDocumentSchema.extend({ documentId: z.string().uuid() });

export const registerDocument = createServerFn({ method: "POST" })
  .middleware([requireRightsPassportEnabled, requireSupabaseAuth])
  .inputValidator((input: unknown) => registerSchema.parse(input))
  .handler(async ({ data, context }): Promise<DocumentRow> => {
    const { supabase, userId } = context;
    await assertOwnsPassportKey(supabase, userId, data.passportKey);

    const expectedPrefix = `${userId}/${data.passportKey}/${data.documentId}/`;
    if (!data.storagePath.startsWith(expectedPrefix)) {
      throw new Error("storagePath does not match the expected upload location");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const dir = data.storagePath.split("/").slice(0, -1).join("/");
    const filename = data.storagePath.split("/").pop() ?? "";
    const { data: listed, error: listErr } = await supabaseAdmin.storage
      .from(DOCUMENT_BUCKET)
      .list(dir, { search: filename, limit: 100 });
    if (listErr) throw new Error("Couldn't verify the uploaded file");
    const entry = listed?.find((o) => o.name === filename);
    const storedSize = (entry?.metadata as { size?: number } | null)?.size;
    if (storedSize === undefined || storedSize === null) {
      throw new Error("File not found in storage — upload it before registering");
    }
    if (Math.abs(storedSize - data.fileSizeBytes) > 1024) {
      throw new Error("Reported file size does not match the uploaded file");
    }

    const { data: row, error } = await (supabase.from("rights_passport_documents" as never) as any)
      .insert({
        id: data.documentId,
        owner_user_id: userId,
        passport_key: data.passportKey,
        file_name: filename,
        original_file_name: data.originalFileName,
        mime_type: data.mimeType,
        file_size_bytes: data.fileSizeBytes,
        storage_path: data.storagePath,
        document_type: data.documentType ?? "OTHER",
        status: "UPLOADED",
      })
      .select(DOCUMENT_LIST_COLS)
      .single();
    if (error || !row) throw new Error(error?.message ?? "Couldn't register document");
    return row;
  });

export const listDocuments = createServerFn({ method: "GET" })
  .inputValidator((input: { passportKey: string }) =>
    z.object({ passportKey: z.string().uuid() }).parse(input),
  )
  .middleware([requireRightsPassportEnabled, requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<DocumentRow[]> => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("rights_passport_documents" as never)
      .select(DOCUMENT_LIST_COLS as never)
      .eq("passport_key" as never, data.passportKey)
      .eq("owner_user_id" as never, userId)
      .order("created_at" as never, { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as DocumentRow[];
  });

export const getDocumentSignedUrl = createServerFn({ method: "POST" })
  .inputValidator((input: { documentId: string }) =>
    z.object({ documentId: z.string().uuid() }).parse(input),
  )
  .middleware([requireRightsPassportEnabled, requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<{ signedUrl: string; expiresIn: number }> => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("rights_passport_documents" as never)
      .select("storage_path" as never)
      .eq("id" as never, data.documentId)
      .eq("owner_user_id" as never, userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Document not found");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const expiresIn = 300;
    const signed = await supabaseAdmin.storage
      .from(DOCUMENT_BUCKET)
      .createSignedUrl((row as unknown as { storage_path: string }).storage_path, expiresIn);
    if (signed.error || !signed.data?.signedUrl) {
      throw new Error("Could not create a signed URL for this document");
    }
    return { signedUrl: signed.data.signedUrl, expiresIn };
  });

/**
 * Server-internal accessor for the parsing/analysis pipeline — never
 * exported as a client-callable server fn. Always scoped by both id and
 * owner_user_id, same as every other lookup in this module.
 */
export async function getDocumentInternal(
  supabase: any,
  userId: string,
  documentId: string,
): Promise<DocumentRowInternal> {
  const { data: row, error } = await supabase
    .from("rights_passport_documents" as never)
    .select(DOCUMENT_INTERNAL_COLS as never)
    .eq("id" as never, documentId)
    .eq("owner_user_id" as never, userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("Document not found");
  return row as unknown as DocumentRowInternal;
}
