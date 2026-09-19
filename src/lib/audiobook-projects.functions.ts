/**
 * AurumVault Audiobook Studio — Phase 2 project/source/chapter/metadata server
 * functions. All gated: requireAudiobookStudioEnabled runs BEFORE
 * requireSupabaseAuth so a disabled product never touches auth or the DB.
 *
 * Ownership rules:
 * - owner_id always comes from context.userId; client input can never set it.
 * - every parent id is re-resolved through an owner-scoped query before writes.
 * - storage_path never leaves this module except through a signed-URL helper.
 * - marketplace-product import returns a SUGGESTION payload only; nothing is
 *   written, so stale product values can never silently overwrite metadata.
 */
import { requireAudiobookBetaCohort } from "@/lib/audiobook-beta-cohort.middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAudiobookStudioEnabled } from "@/lib/audiobook-feature-flags.middleware";
import {
  AUDIOBOOK_MANUSCRIPT_BUCKET,
  assertOwnedAudiobookPath,
  buildManuscriptPath,
  createAudiobookSignedUpload,
  createAudiobookSignedUrl,
  downloadAudiobookBytes,
} from "@/lib/audiobook-storage.server";

type Db = any;

const uuid = z.string().uuid();

async function assertOwnsProject(supabase: Db, userId: string, projectId: string) {
  const { data } = await supabase
    .from("audiobook_projects")
    .select("id, owner_id, title, language, author_name, description, source_product_id, status")
    .eq("id", projectId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (!data) throw new Error("Audiobook project not found");
  return data as { id: string; owner_id: string; title: string; language: string; author_name: string | null; description: string | null; source_product_id: string | null; status: string };
}

async function assertOwnsChapter(supabase: Db, userId: string, chapterId: string) {
  const { data } = await supabase
    .from("audiobook_chapters")
    .select("id, project_id, owner_id, original_text, chapter_index, title")
    .eq("id", chapterId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (!data) throw new Error("Chapter not found");
  return data as { id: string; project_id: string; owner_id: string; original_text: string; chapter_index: number; title: string | null };
}

async function logEvent(supabase: Db, userId: string, eventType: string, projectId: string | null, payload: Record<string, unknown> = {}) {
  await supabase.from("audiobook_activity_events").insert({ owner_id: userId, actor_id: userId, project_id: projectId, event_type: eventType, payload });
}

export const listAudiobookProjects = createServerFn({ method: "GET" })
  .middleware([requireAudiobookStudioEnabled, requireSupabaseAuth, requireAudiobookBetaCohort])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: Db; userId: string };
    const { data, error } = await supabase.from("audiobook_projects").select("id, title, author_name, language, status, source_product_id, created_at, updated_at").eq("owner_id", userId).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { projects: data ?? [] };
  });

const createProjectSchema = z.object({ title: z.string().trim().min(1).max(300), authorName: z.string().trim().max(200).optional().nullable(), language: z.string().trim().min(2).max(20).default("en"), description: z.string().trim().max(5000).optional().nullable(), sourceProductId: uuid.optional().nullable() });

export const createAudiobookProject = createServerFn({ method: "POST" })
  .middleware([requireAudiobookStudioEnabled, requireSupabaseAuth, requireAudiobookBetaCohort])
  .inputValidator((input: unknown) => createProjectSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: Db; userId: string };
    if (data.sourceProductId) {
      const { data: product } = await supabase.from("marketplace_products").select("id").eq("id", data.sourceProductId).eq("seller_id", userId).maybeSingle();
      if (!product) throw new Error("Source product not found");
    }
    const { data: created, error } = await supabase.from("audiobook_projects").insert({ owner_id: userId, title: data.title, author_name: data.authorName ?? null, language: data.language, description: data.description ?? null, source_product_id: data.sourceProductId ?? null }).select("id, title, author_name, language, status, created_at").single();
    if (error) throw new Error(error.message);
    await logEvent(supabase, userId, "PROJECT_CREATED", created.id, { title: data.title });
    return { project: created };
  });

export const getAudiobookProject = createServerFn({ method: "GET" })
  .middleware([requireAudiobookStudioEnabled, requireSupabaseAuth, requireAudiobookBetaCohort])
  .inputValidator((input: unknown) => z.object({ projectId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: Db; userId: string };
    const project = await assertOwnsProject(supabase, userId, data.projectId);
    const [{ data: chapters }, { data: sources }, { data: metadata }, { data: rights }] = await Promise.all([
      supabase.from("audiobook_chapters").select("id, chapter_index, title, char_count, created_at").eq("project_id", data.projectId).eq("owner_id", userId).order("chapter_index", { ascending: true }),
      supabase.from("audiobook_sources").select("id, file_name, file_size_bytes, mime_type, validation_status, word_count, page_count, created_at").eq("project_id", data.projectId).eq("owner_id", userId).order("created_at", { ascending: false }),
      supabase.from("audiobook_metadata").select("*").eq("project_id", data.projectId).eq("owner_id", userId).maybeSingle(),
      supabase.from("audiobook_rights_attestations").select("id, status, version, statement_text, attested_at, revoked_at").eq("project_id", data.projectId).eq("owner_id", userId).order("version", { ascending: false }).limit(1).maybeSingle(),
    ]);
    return { project, chapters: chapters ?? [], sources: sources ?? [], metadata: metadata ?? null, rights: rights ?? null };
  });

const updateProjectSchema = z.object({ projectId: uuid, title: z.string().trim().min(1).max(300).optional(), authorName: z.string().trim().max(200).nullable().optional(), language: z.string().trim().min(2).max(20).optional(), description: z.string().trim().max(5000).nullable().optional(), status: z.enum(["DRAFT", "IN_PROGRESS", "READY", "ARCHIVED"]).optional() });

export const updateAudiobookProject = createServerFn({ method: "POST" })
  .middleware([requireAudiobookStudioEnabled, requireSupabaseAuth, requireAudiobookBetaCohort])
  .inputValidator((input: unknown) => updateProjectSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: Db; userId: string };
    await assertOwnsProject(supabase, userId, data.projectId);
    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.authorName !== undefined) patch.author_name = data.authorName;
    if (data.language !== undefined) patch.language = data.language;
    if (data.description !== undefined) patch.description = data.description;
    if (data.status !== undefined) patch.status = data.status;
    if (Object.keys(patch).length === 0) return { updated: false };
    const { error } = await supabase.from("audiobook_projects").update(patch).eq("id", data.projectId).eq("owner_id", userId);
    if (error) throw new Error(error.message);
    return { updated: true };
  });

const beginSourceUploadSchema = z.object({ projectId: uuid, fileName: z.string().trim().min(1).max(300), fileSizeBytes: z.number().int().positive().max(50 * 1024 * 1024), mimeType: z.string().trim().max(200).optional().nullable() });

export const beginAudiobookSourceUpload = createServerFn({ method: "POST" })
  .middleware([requireAudiobookStudioEnabled, requireSupabaseAuth, requireAudiobookBetaCohort])
  .inputValidator((input: unknown) => beginSourceUploadSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: Db; userId: string };
    await assertOwnsProject(supabase, userId, data.projectId);
    const sourceId = crypto.randomUUID();
    const path = buildManuscriptPath(userId, data.projectId, sourceId, data.fileName);
    const upload = await createAudiobookSignedUpload(supabase, AUDIOBOOK_MANUSCRIPT_BUCKET, path, userId);
    return { sourceId, bucket: AUDIOBOOK_MANUSCRIPT_BUCKET, storagePath: path, upload };
  });

const registerSourceSchema = beginSourceUploadSchema.extend({ sourceId: uuid, storagePath: z.string().trim().min(1).max(500) });

export const registerAudiobookSource = createServerFn({ method: "POST" })
  .middleware([requireAudiobookStudioEnabled, requireSupabaseAuth, requireAudiobookBetaCohort])
  .inputValidator((input: unknown) => registerSourceSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: Db; userId: string };
    await assertOwnsProject(supabase, userId, data.projectId);
    assertOwnedAudiobookPath(AUDIOBOOK_MANUSCRIPT_BUCKET, data.storagePath, userId);
    if (data.storagePath !== buildManuscriptPath(userId, data.projectId, data.sourceId, data.fileName)) throw new Error("Storage path does not match this source.");
    await createAudiobookSignedUrl(supabase, AUDIOBOOK_MANUSCRIPT_BUCKET, data.storagePath, userId, 60);
    const { data: created, error } = await supabase.from("audiobook_sources").insert({ id: data.sourceId, owner_id: userId, project_id: data.projectId, file_name: data.fileName, file_size_bytes: data.fileSizeBytes, mime_type: data.mimeType ?? null, storage_bucket: AUDIOBOOK_MANUSCRIPT_BUCKET, storage_path: data.storagePath, validation_status: "PENDING" }).select("id, file_name, file_size_bytes, validation_status").single();
    if (error) throw new Error(error.message);
    await logEvent(supabase, userId, "SOURCE_REGISTERED", data.projectId, { source_id: created.id });
    return { source: created };
  });

export const parseAudiobookSource = createServerFn({ method: "POST" })
  .middleware([requireAudiobookStudioEnabled, requireSupabaseAuth, requireAudiobookBetaCohort])
  .inputValidator((input: unknown) => z.object({ sourceId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: Db; userId: string };
    const { data: source } = await supabase.from("audiobook_sources").select("id, project_id, owner_id, file_name, storage_bucket, storage_path").eq("id", data.sourceId).eq("owner_id", userId).maybeSingle();
    if (!source) throw new Error("Manuscript source not found");
    await assertOwnsProject(supabase, userId, source.project_id);
    const bytes = await downloadAudiobookBytes(supabase, AUDIOBOOK_MANUSCRIPT_BUCKET, source.storage_path, userId);
    const { parseManuscriptSource } = await import("@/lib/audiobook-parse.server");
    const parsed = await parseManuscriptSource(source.file_name, bytes);
    if (!parsed.ok) {
      await supabase.from("audiobook_sources").update({ validation_status: "FAILED", validation_notes: parsed.message }).eq("id", source.id).eq("owner_id", userId);
      throw new Error(parsed.message);
    }
    const chapters = parsed.chapters.ok ? parsed.chapters.chapters : [];
    const { data: existing } = await supabase.from("audiobook_chapters").select("id").eq("project_id", source.project_id).eq("owner_id", userId).limit(1);
    if ((existing ?? []).length > 0) throw new Error("This project already has chapters. Chapter text is immutable — create a new project to re-parse a manuscript.");
    const rows = chapters.map((c) => ({ owner_id: userId, project_id: source.project_id, source_id: source.id, chapter_index: c.index, title: c.title, original_text: c.text, char_count: c.charCount }));
    const { data: inserted, error } = await supabase.from("audiobook_chapters").insert(rows).select("id, chapter_index, title, char_count, original_text");
    if (error) throw new Error(error.message);
    const versionRows = (inserted ?? []).map((c: any) => ({ owner_id: userId, project_id: source.project_id, chapter_id: c.id, version: 1, is_current: true, edited_text: c.original_text, change_note: "Initial version from parsed manuscript" }));
    if (versionRows.length > 0) { const { error: vErr } = await supabase.from("audiobook_chapter_versions").insert(versionRows); if (vErr) throw new Error(vErr.message); }
    await supabase.from("audiobook_sources").update({ validation_status: "PARSED", validation_notes: null, page_count: parsed.pageCount, word_count: parsed.chapters.ok ? parsed.chapters.wordCount : null }).eq("id", source.id).eq("owner_id", userId);
    await logEvent(supabase, userId, "SOURCE_PARSED", source.project_id, { source_id: source.id, chapters: rows.length });
    return { chapters: (inserted ?? []).map((c: any) => ({ id: c.id, chapter_index: c.chapter_index, title: c.title, char_count: c.char_count })) };
  });

export const listChapterVersions = createServerFn({ method: "GET" }).middleware([requireAudiobookStudioEnabled, requireSupabaseAuth, requireAudiobookBetaCohort]).inputValidator((input: unknown) => z.object({ chapterId: uuid }).parse(input)).handler(async ({ data, context }) => { const { supabase, userId } = context as { supabase: Db; userId: string }; await assertOwnsChapter(supabase, userId, data.chapterId); const { data: versions, error } = await supabase.from("audiobook_chapter_versions").select("id, version, is_current, change_note, created_at").eq("chapter_id", data.chapterId).eq("owner_id", userId).order("version", { ascending: false }); if (error) throw new Error(error.message); return { versions: versions ?? [] }; });
export const getChapterVersionText = createServerFn({ method: "GET" }).middleware([requireAudiobookStudioEnabled, requireSupabaseAuth, requireAudiobookBetaCohort]).inputValidator((input: unknown) => z.object({ versionId: uuid }).parse(input)).handler(async ({ data, context }) => { const { supabase, userId } = context as { supabase: Db; userId: string }; const { data: version, error } = await supabase.from("audiobook_chapter_versions").select("id, chapter_id, version, is_current, edited_text").eq("id", data.versionId).eq("owner_id", userId).maybeSingle(); if (error) throw new Error(error.message); if (!version) throw new Error("Chapter version not found"); return { version }; });

const createVersionSchema = z.object({ chapterId: uuid, editedText: z.string().min(1).max(500_000), changeNote: z.string().trim().max(500).optional().nullable(), makeCurrent: z.boolean().default(true) });
export const createChapterVersion = createServerFn({ method: "POST" }).middleware([requireAudiobookStudioEnabled, requireSupabaseAuth, requireAudiobookBetaCohort]).inputValidator((input: unknown) => createVersionSchema.parse(input)).handler(async ({ data, context }) => { const { supabase, userId } = context as { supabase: Db; userId: string }; const chapter = await assertOwnsChapter(supabase, userId, data.chapterId); const { data: latest } = await supabase.from("audiobook_chapter_versions").select("version").eq("chapter_id", data.chapterId).eq("owner_id", userId).order("version", { ascending: false }).limit(1).maybeSingle(); const nextVersion = ((latest?.version as number | undefined) ?? 0) + 1; if (data.makeCurrent) await supabase.from("audiobook_chapter_versions").update({ is_current: false }).eq("chapter_id", data.chapterId).eq("owner_id", userId); const { data: created, error } = await supabase.from("audiobook_chapter_versions").insert({ owner_id: userId, project_id: chapter.project_id, chapter_id: data.chapterId, version: nextVersion, is_current: data.makeCurrent, edited_text: data.editedText, change_note: data.changeNote ?? null }).select("id, version, is_current").single(); if (error) throw new Error(error.message); await logEvent(supabase, userId, "CHAPTER_VERSION_CREATED", chapter.project_id, { chapter_id: data.chapterId, version: nextVersion }); return { version: created }; });
export const setCurrentChapterVersion = createServerFn({ method: "POST" }).middleware([requireAudiobookStudioEnabled, requireSupabaseAuth, requireAudiobookBetaCohort]).inputValidator((input: unknown) => z.object({ versionId: uuid }).parse(input)).handler(async ({ data, context }) => { const { supabase, userId } = context as { supabase: Db; userId: string }; const { data: version } = await supabase.from("audiobook_chapter_versions").select("id, chapter_id").eq("id", data.versionId).eq("owner_id", userId).maybeSingle(); if (!version) throw new Error("Chapter version not found"); await supabase.from("audiobook_chapter_versions").update({ is_current: false }).eq("chapter_id", version.chapter_id).eq("owner_id", userId); const { error } = await supabase.from("audiobook_chapter_versions").update({ is_current: true }).eq("id", data.versionId).eq("owner_id", userId); if (error) throw new Error(error.message); return { updated: true }; });

export const listPronunciations = createServerFn({ method: "GET" }).middleware([requireAudiobookStudioEnabled, requireSupabaseAuth, requireAudiobookBetaCohort]).inputValidator((input: unknown) => z.object({ projectId: uuid }).parse(input)).handler(async ({ data, context }) => { const { supabase, userId } = context as { supabase: Db; userId: string }; await assertOwnsProject(supabase, userId, data.projectId); const { data: rows, error } = await supabase.from("audiobook_pronunciations").select("id, term, ipa, replacement, notes, created_at").eq("project_id", data.projectId).eq("owner_id", userId).order("term", { ascending: true }); if (error) throw new Error(error.message); return { pronunciations: rows ?? [] }; });
const upsertPronunciationSchema = z.object({ projectId: uuid, id: uuid.optional(), term: z.string().trim().min(1).max(200), ipa: z.string().trim().max(200).nullable().optional(), replacement: z.string().trim().max(200).nullable().optional(), notes: z.string().trim().max(1000).nullable().optional() });
export const upsertPronunciation = createServerFn({ method: "POST" }).middleware([requireAudiobookStudioEnabled, requireSupabaseAuth, requireAudiobookBetaCohort]).inputValidator((input: unknown) => upsertPronunciationSchema.parse(input)).handler(async ({ data, context }) => { const { supabase, userId } = context as { supabase: Db; userId: string }; await assertOwnsProject(supabase, userId, data.projectId); const payload = { owner_id: userId, project_id: data.projectId, term: data.term, ipa: data.ipa ?? null, replacement: data.replacement ?? null, notes: data.notes ?? null }; if (data.id) { const { data: updated, error } = await supabase.from("audiobook_pronunciations").update(payload).eq("id", data.id).eq("owner_id", userId).select("id, term").maybeSingle(); if (error) throw new Error(error.message); if (!updated) throw new Error("Pronunciation not found"); return { pronunciation: updated }; } const { data: created, error } = await supabase.from("audiobook_pronunciations").insert(payload).select("id, term").single(); if (error) throw new Error(error.message); return { pronunciation: created }; });
export const deletePronunciation = createServerFn({ method: "POST" }).middleware([requireAudiobookStudioEnabled, requireSupabaseAuth, requireAudiobookBetaCohort]).inputValidator((input: unknown) => z.object({ id: uuid }).parse(input)).handler(async ({ data, context }) => { const { supabase, userId } = context as { supabase: Db; userId: string }; const { error } = await supabase.from("audiobook_pronunciations").delete().eq("id", data.id).eq("owner_id", userId); if (error) throw new Error(error.message); return { deleted: true }; });

const attestSchema = z.object({ projectId: uuid, statementText: z.string().trim().min(1).max(5000) });
export const attestAudiobookRights = createServerFn({ method: "POST" }).middleware([requireAudiobookStudioEnabled, requireSupabaseAuth, requireAudiobookBetaCohort]).inputValidator((input: unknown) => attestSchema.parse(input)).handler(async ({ data, context }) => { const { supabase, userId } = context as { supabase: Db; userId: string }; await assertOwnsProject(supabase, userId, data.projectId); const { data: latest } = await supabase.from("audiobook_rights_attestations").select("version").eq("project_id", data.projectId).eq("owner_id", userId).order("version", { ascending: false }).limit(1).maybeSingle(); const version = ((latest?.version as number | undefined) ?? 0) + 1; const { data: created, error } = await supabase.from("audiobook_rights_attestations").insert({ owner_id: userId, project_id: data.projectId, version, status: "ATTESTED", statement_text: data.statementText, attested_at: new Date().toISOString() }).select("id, status, version, attested_at").single(); if (error) throw new Error(error.message); await logEvent(supabase, userId, "RIGHTS_ATTESTED", data.projectId, { version }); return { attestation: created }; });
export const revokeAudiobookRights = createServerFn({ method: "POST" }).middleware([requireAudiobookStudioEnabled, requireSupabaseAuth, requireAudiobookBetaCohort]).inputValidator((input: unknown) => z.object({ attestationId: uuid }).parse(input)).handler(async ({ data, context }) => { const { supabase, userId } = context as { supabase: Db; userId: string }; const { data: updated, error } = await supabase.from("audiobook_rights_attestations").update({ status: "REVOKED", revoked_at: new Date().toISOString() }).eq("id", data.attestationId).eq("owner_id", userId).select("id, status, project_id").maybeSingle(); if (error) throw new Error(error.message); if (!updated) throw new Error("Attestation not found"); await logEvent(supabase, userId, "RIGHTS_REVOKED", updated.project_id, { attestation_id: updated.id }); return { attestation: { id: updated.id, status: updated.status } }; });

const metadataSchema = z.object({ projectId: uuid, title: z.string().trim().max(300).nullable().optional(), subtitle: z.string().trim().max(300).nullable().optional(), authorName: z.string().trim().max(200).nullable().optional(), narratorName: z.string().trim().max(200).nullable().optional(), publisher: z.string().trim().max(200).nullable().optional(), description: z.string().trim().max(10_000).nullable().optional(), language: z.string().trim().min(2).max(20).optional(), isbn: z.string().trim().max(40).nullable().optional(), genre: z.string().trim().max(120).nullable().optional(), keywords: z.array(z.string().trim().min(1).max(60)).max(30).optional(), coverPath: z.string().trim().max(500).nullable().optional(), copyrightYear: z.number().int().min(1400).max(3000).nullable().optional() });
export const upsertAudiobookMetadata = createServerFn({ method: "POST" }).middleware([requireAudiobookStudioEnabled, requireSupabaseAuth, requireAudiobookBetaCohort]).inputValidator((input: unknown) => metadataSchema.parse(input)).handler(async ({ data, context }) => { const { supabase, userId } = context as { supabase: Db; userId: string }; await assertOwnsProject(supabase, userId, data.projectId); const { evaluateAudiobookMetadata } = await import("@/lib/audiobook-metadata"); const { data: existing } = await supabase.from("audiobook_metadata").select("*").eq("project_id", data.projectId).eq("owner_id", userId).maybeSingle(); const merged = { title: data.title ?? existing?.title ?? null, subtitle: data.subtitle ?? existing?.subtitle ?? null, author_name: data.authorName ?? existing?.author_name ?? null, narrator_name: data.narratorName ?? existing?.narrator_name ?? null, publisher: data.publisher ?? existing?.publisher ?? null, description: data.description ?? existing?.description ?? null, language: data.language ?? existing?.language ?? "en", isbn: data.isbn ?? existing?.isbn ?? null, genre: data.genre ?? existing?.genre ?? null, keywords: data.keywords ?? existing?.keywords ?? [], cover_path: data.coverPath ?? existing?.cover_path ?? null, copyright_year: data.copyrightYear ?? existing?.copyright_year ?? null }; const evaluation = evaluateAudiobookMetadata({ title: merged.title, subtitle: merged.subtitle, authorName: merged.author_name, narratorName: merged.narrator_name, publisher: merged.publisher, description: merged.description, language: merged.language, isbn: merged.isbn, genre: merged.genre, keywords: merged.keywords, coverPath: merged.cover_path, copyrightYear: merged.copyright_year }); const row = { ...merged, owner_id: userId, project_id: data.projectId, completeness_score: evaluation.score, is_complete: evaluation.isComplete }; if (existing) { const { error } = await supabase.from("audiobook_metadata").update(row).eq("id", existing.id).eq("owner_id", userId); if (error) throw new Error(error.message); } else { const { error } = await supabase.from("audiobook_metadata").insert(row); if (error) throw new Error(error.message); } return { evaluation }; });

export const suggestMetadataFromProduct = createServerFn({ method: "GET" }).middleware([requireAudiobookStudioEnabled, requireSupabaseAuth, requireAudiobookBetaCohort]).inputValidator((input: unknown) => z.object({ projectId: uuid, productId: uuid }).parse(input)).handler(async ({ data, context }) => { const { supabase, userId } = context as { supabase: Db; userId: string }; await assertOwnsProject(supabase, userId, data.projectId); const { data: product } = await supabase.from("marketplace_products").select("id, title, subtitle, description, cover_url, language, seller_id").eq("id", data.productId).eq("seller_id", userId).maybeSingle(); if (!product) throw new Error("Product not found"); return { suggestion: { productId: product.id, title: product.title ?? null, description: product.description ?? null, subtitle: product.subtitle ?? null, language: product.language ?? null, coverImageUrl: product.cover_url ?? null }, note: "Suggestion only — nothing was saved. Apply the fields you want explicitly." }; });
export const listOwnedProductsForAudiobook = createServerFn({ method: "GET" }).middleware([requireAudiobookStudioEnabled, requireSupabaseAuth, requireAudiobookBetaCohort]).handler(async ({ context }) => { const { supabase, userId } = context as { supabase: Db; userId: string }; const { data: rows } = await supabase.from("marketplace_products").select("id, title").eq("seller_id", userId).order("created_at", { ascending: false }).limit(50); return { products: (rows ?? []).map((r: any) => ({ id: r.id as string, title: (r.title as string | null) ?? "Untitled" })) }; });
