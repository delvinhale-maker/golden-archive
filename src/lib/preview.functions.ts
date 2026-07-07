import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Public, unauthenticated preview endpoint. Given a product id, returns a
 * PDF that contains ONLY the creator-selected preview pages, with a layered
 * watermark burned onto each page (tiled AURUMVAULT monogram at ~15%
 * opacity + a diagonal "AURUMVAULT PREVIEW — NOT FOR DISTRIBUTION" stripe
 * at ~40% opacity). The original manuscript is never handed to the browser.
 *
 * Only published PDF products with a non-empty `preview_pages` array are
 * eligible. Any other request returns `{ ok: false }`.
 */
export const getPublicPreview = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ productId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("marketplace_products")
      .select("id,title,cover_url,file_path,status,published,preview_pages")
      .eq("id", data.productId)
      .maybeSingle();
    if (error || !row) return { ok: false as const, reason: "notFound" };
    if (row.status !== "approved" || !row.published) {
      return { ok: false as const, reason: "unpublished" };
    }
    const pages = (row.preview_pages ?? []) as number[];
    if (!Array.isArray(pages) || pages.length === 0) {
      return { ok: false as const, reason: "noPreview" };
    }
    const filePath = (row.file_path ?? "") as string;
    const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
    if (ext !== "pdf") {
      return { ok: false as const, reason: "unsupportedFormat" };
    }

    // Download the original manuscript from private storage.
    const dl = await supabaseAdmin.storage.from("product-files").download(filePath);
    if (dl.error || !dl.data) {
      return { ok: false as const, reason: "sourceUnavailable" };
    }
    const srcBytes = new Uint8Array(await dl.data.arrayBuffer());

    // pdf-lib works in the Worker runtime.
    const { PDFDocument, StandardFonts, rgb, degrees } = await import("pdf-lib");
    let srcDoc;
    try {
      srcDoc = await PDFDocument.load(srcBytes, { ignoreEncryption: true });
    } catch {
      return { ok: false as const, reason: "sourceInvalid" };
    }
    const total = srcDoc.getPageCount();

    // Validate & clamp requested pages (1-indexed) to what actually exists.
    const wanted = Array.from(new Set(pages.filter((p) => Number.isInteger(p) && p >= 1 && p <= total)));
    if (wanted.length === 0) {
      return { ok: false as const, reason: "pagesOutOfRange" };
    }
    // pdf-lib copyPages takes 0-indexed indices.
    const outDoc = await PDFDocument.create();
    outDoc.setTitle(`${row.title ?? "Preview"} — Preview`);
    outDoc.setSubject("AurumVault preview");
    outDoc.setProducer("AurumVault");
    outDoc.setCreator("AurumVault");
    const copied = await outDoc.copyPages(srcDoc, wanted.map((p) => p - 1));

    // Fonts + watermark colors.
    const font = await outDoc.embedFont(StandardFonts.HelveticaBold);
    const gold = rgb(0.79, 0.66, 0.30); // approx #C9A84C
    const tileText = "AURUMVAULT";
    const diagonalText = "AURUMVAULT PREVIEW — NOT FOR DISTRIBUTION";

    for (const page of copied) {
      outDoc.addPage(page);
      const { width, height } = page.getSize();

      // Layer 1: tiled monogram (crest substitute). Small gold text
      // repeated on a diagonal grid at ~15% opacity so screenshots carry
      // the mark without obscuring content.
      const tileSize = 12;
      const stepX = 140;
      const stepY = 90;
      const rows = Math.ceil((height + stepY) / stepY) + 1;
      const cols = Math.ceil((width + stepX) / stepX) + 1;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * stepX - ((r % 2) * stepX) / 2;
          const y = height - r * stepY;
          page.drawText(tileText, {
            x,
            y,
            size: tileSize,
            font,
            color: gold,
            opacity: 0.15,
            rotate: degrees(-30),
          });
        }
      }

      // Layer 2: single diagonal stripe, sized so the rotated text spans
      // ~85% of the page diagonal. Rotated in pdf-lib around the text's
      // (x, y) origin — compute that origin so the rotated glyph box is
      // centered on the page.
      const angleDeg = -30;
      const angleRad = (angleDeg * Math.PI) / 180;
      const diag = Math.sqrt(width * width + height * height);
      // Leave ~15% margin on each end so the stripe never clips the edge.
      const targetWidth = diag * 0.70;
      const baseSize = Math.min(width, height) * 0.055;
      let stripeSize = baseSize;
      let stripeWidth = font.widthOfTextAtSize(diagonalText, stripeSize);
      if (stripeWidth > targetWidth) {
        stripeSize = (baseSize * targetWidth) / stripeWidth;
        stripeWidth = font.widthOfTextAtSize(diagonalText, stripeSize);
      }
      if (stripeWidth > targetWidth) {
        stripeSize = (baseSize * targetWidth) / stripeWidth;
        stripeWidth = font.widthOfTextAtSize(diagonalText, stripeSize);
      }
      const cx = width / 2;
      const cy = height / 2;
      const cosA = Math.cos(angleRad);
      const sinA = Math.sin(angleRad);
      // Rotate the vector (W/2, S/2) — the offset from origin to glyph
      // box center — then subtract from the target center to get origin.
      const rx = cosA * (stripeWidth / 2) - sinA * (stripeSize / 2);
      const ry = sinA * (stripeWidth / 2) + cosA * (stripeSize / 2);
      page.drawText(diagonalText, {
        x: cx - rx,
        y: cy - ry,
        size: stripeSize,
        font,
        color: gold,
        opacity: 0.4,
        rotate: degrees(angleDeg),
      });
    }

    const outBytes = await outDoc.save();
    // Base64-encode for JSON transport.
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < outBytes.length; i += chunk) {
      binary += String.fromCharCode(...outBytes.subarray(i, i + chunk));
    }
    const base64 = btoa(binary);

    return {
      ok: true as const,
      title: row.title as string,
      coverUrl: (row.cover_url as string | null) ?? null,
      pageCount: wanted.length,
      pdfBase64: base64,
    };
  });


/**
 * Format-appropriate preview endpoint. Public, unauthenticated. Given a
 * product id, returns a discriminated payload the client can render based
 * on the manuscript's file format. Every format carries an AURUMVAULT
 * watermark (either burned into the file or overlaid in the reader).
 *
 * PDF: creator-selected watermarked pages (same as getPublicPreview).
 * EPUB: first spine chapter, sanitized HTML.
 * DOCX: extracted plain text, capped to ~1500 words.
 * Audio/Video: short-lived signed URL, capped to 60s of playback client-side.
 * Other formats (Notion export, ZIP templates, unknown): a cover-only fallback
 * so the "Preview" surface always exists.
 */
export const getFormatPreview = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ productId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("marketplace_products")
      .select("id,title,cover_url,file_path,status,published,preview_pages,description")
      .eq("id", data.productId)
      .maybeSingle();
    if (error || !row) return { ok: false as const, reason: "notFound" };
    if (row.status !== "approved" || !row.published) {
      return { ok: false as const, reason: "unpublished" };
    }
    const filePath = (row.file_path ?? "") as string;
    const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
    const title = (row.title as string) ?? "Preview";
    const coverUrl = (row.cover_url as string | null) ?? null;
    const description = (row.description as string | null) ?? null;

    // -------- PDF: delegate to the watermarked-pages generator ----------
    if (ext === "pdf") {
      const pdf = await buildWatermarkedPdfPreview({
        filePath,
        title,
        previewPages: (row.preview_pages ?? []) as number[],
      });
      if (!pdf.ok) {
        return {
          ok: true as const,
          kind: "cover" as const,
          title, coverUrl, description,
          reason: pdf.reason,
        };
      }
      return {
        ok: true as const,
        kind: "pdf" as const,
        title, coverUrl,
        pageCount: pdf.pageCount,
        pdfBase64: pdf.pdfBase64,
      };
    }

    // -------- EPUB: extract first spine chapter -------------------------
    if (ext === "epub") {
      const dl = await supabaseAdmin.storage.from("product-files").download(filePath);
      if (dl.error || !dl.data) return coverFallback(title, coverUrl, description, "sourceUnavailable");
      try {
        const bytes = new Uint8Array(await dl.data.arrayBuffer());
        const chapter = await extractEpubFirstChapter(bytes);
        if (!chapter) return coverFallback(title, coverUrl, description, "epubEmpty");
        return {
          ok: true as const,
          kind: "epub" as const,
          title, coverUrl,
          chapterTitle: chapter.chapterTitle,
          chapterHtml: chapter.html,
        };
      } catch {
        return coverFallback(title, coverUrl, description, "epubInvalid");
      }
    }

    // -------- DOCX: extract first ~1500 words of body text --------------
    if (ext === "docx") {
      const dl = await supabaseAdmin.storage.from("product-files").download(filePath);
      if (dl.error || !dl.data) return coverFallback(title, coverUrl, description, "sourceUnavailable");
      try {
        const bytes = new Uint8Array(await dl.data.arrayBuffer());
        const text = await extractDocxText(bytes, 1500);
        if (!text) return coverFallback(title, coverUrl, description, "docxEmpty");
        return {
          ok: true as const,
          kind: "text" as const,
          title, coverUrl,
          format: "docx" as const,
          text,
        };
      } catch {
        return coverFallback(title, coverUrl, description, "docxInvalid");
      }
    }

    // -------- Audio / Video: signed URL + client-side cap ---------------
    const audioExts = new Set(["mp3", "m4a", "wav", "ogg", "aac", "flac"]);
    const videoExts = new Set(["mp4", "webm", "mov", "m4v"]);
    if (audioExts.has(ext) || videoExts.has(ext)) {
      const signed = await supabaseAdmin.storage
        .from("product-files")
        .createSignedUrl(filePath, 60 * 15);
      if (signed.error || !signed.data?.signedUrl) {
        return coverFallback(title, coverUrl, description, "sourceUnavailable");
      }
      const kind = audioExts.has(ext) ? ("audio" as const) : ("video" as const);
      const mime = mimeFor(ext);
      return {
        ok: true as const,
        kind,
        title, coverUrl,
        url: signed.data.signedUrl,
        mime,
        capSeconds: 60,
      };
    }

    // -------- Everything else: cover + description fallback -------------
    return coverFallback(title, coverUrl, description, "unsupportedFormat");
  });

function coverFallback(
  title: string,
  coverUrl: string | null,
  description: string | null,
  reason: string,
) {
  return {
    ok: true as const,
    kind: "cover" as const,
    title, coverUrl, description,
    reason,
  };
}

function mimeFor(ext: string): string {
  switch (ext) {
    case "mp3": return "audio/mpeg";
    case "m4a": return "audio/mp4";
    case "wav": return "audio/wav";
    case "ogg": return "audio/ogg";
    case "aac": return "audio/aac";
    case "flac": return "audio/flac";
    case "mp4": return "video/mp4";
    case "m4v": return "video/mp4";
    case "webm": return "video/webm";
    case "mov": return "video/quicktime";
    default: return "application/octet-stream";
  }
}

/** Build the watermarked PDF preview and return the raw pieces. Extracted
 * so the format dispatcher and the legacy `getPublicPreview` can share it. */
async function buildWatermarkedPdfPreview({
  filePath,
  title,
  previewPages,
}: { filePath: string; title: string; previewPages: number[] }) {
  const pages = Array.isArray(previewPages) ? previewPages : [];
  if (pages.length === 0) return { ok: false as const, reason: "noPreview" };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const dl = await supabaseAdmin.storage.from("product-files").download(filePath);
  if (dl.error || !dl.data) return { ok: false as const, reason: "sourceUnavailable" };
  const srcBytes = new Uint8Array(await dl.data.arrayBuffer());
  const { PDFDocument, StandardFonts, rgb, degrees } = await import("pdf-lib");
  let srcDoc;
  try {
    srcDoc = await PDFDocument.load(srcBytes, { ignoreEncryption: true });
  } catch {
    return { ok: false as const, reason: "sourceInvalid" };
  }
  const total = srcDoc.getPageCount();
  const wanted = Array.from(new Set(pages.filter((p) => Number.isInteger(p) && p >= 1 && p <= total)));
  if (wanted.length === 0) return { ok: false as const, reason: "pagesOutOfRange" };
  const outDoc = await PDFDocument.create();
  outDoc.setTitle(`${title} — Preview`);
  outDoc.setSubject("AurumVault preview");
  outDoc.setProducer("AurumVault");
  outDoc.setCreator("AurumVault");
  const copied = await outDoc.copyPages(srcDoc, wanted.map((p) => p - 1));
  const font = await outDoc.embedFont(StandardFonts.HelveticaBold);
  const gold = rgb(0.79, 0.66, 0.30);
  const tileText = "AURUMVAULT";
  const diagonalText = "AURUMVAULT PREVIEW — NOT FOR DISTRIBUTION";
  for (const page of copied) {
    outDoc.addPage(page);
    const { width, height } = page.getSize();
    const stepX = 140, stepY = 90;
    const rows = Math.ceil((height + stepY) / stepY) + 1;
    const cols = Math.ceil((width + stepX) / stepX) + 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * stepX - ((r % 2) * stepX) / 2;
        const y = height - r * stepY;
        page.drawText(tileText, { x, y, size: 12, font, color: gold, opacity: 0.15, rotate: degrees(-30) });
      }
    }
    const angleDeg = -30;
    const angleRad = (angleDeg * Math.PI) / 180;
    const diag = Math.sqrt(width * width + height * height);
    const targetWidth = diag * 0.70;
    const baseSize = Math.min(width, height) * 0.055;
    let stripeSize = baseSize;
    let stripeWidth = font.widthOfTextAtSize(diagonalText, stripeSize);
    if (stripeWidth > targetWidth) {
      stripeSize = (baseSize * targetWidth) / stripeWidth;
      stripeWidth = font.widthOfTextAtSize(diagonalText, stripeSize);
    }
    const cx = width / 2, cy = height / 2;
    const cosA = Math.cos(angleRad), sinA = Math.sin(angleRad);
    const rx = cosA * (stripeWidth / 2) - sinA * (stripeSize / 2);
    const ry = sinA * (stripeWidth / 2) + cosA * (stripeSize / 2);
    page.drawText(diagonalText, {
      x: cx - rx, y: cy - ry, size: stripeSize,
      font, color: gold, opacity: 0.4, rotate: degrees(angleDeg),
    });
  }
  const outBytes = await outDoc.save();
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < outBytes.length; i += chunk) {
    binary += String.fromCharCode(...outBytes.subarray(i, i + chunk));
  }
  return {
    ok: true as const,
    pdfBase64: btoa(binary),
    pageCount: wanted.length,
  };
}

/** Extract the first chapter of an EPUB. Parses container.xml → OPF →
 * spine[0], then reads and lightly sanitizes the referenced XHTML file. */
async function extractEpubFirstChapter(bytes: Uint8Array): Promise<{ chapterTitle: string | null; html: string } | null> {
  const { unzipSync, strFromU8 } = await import("fflate");
  const files = unzipSync(bytes);
  const containerRaw = files["META-INF/container.xml"];
  if (!containerRaw) return null;
  const container = strFromU8(containerRaw);
  const opfPath = container.match(/full-path="([^"]+)"/)?.[1];
  if (!opfPath) return null;
  const opfRaw = files[opfPath];
  if (!opfRaw) return null;
  const opf = strFromU8(opfRaw);
  const spineMatch = opf.match(/<spine\b[^>]*>([\s\S]*?)<\/spine>/i);
  if (!spineMatch) return null;
  const firstIdref = spineMatch[1].match(/idref="([^"]+)"/)?.[1];
  if (!firstIdref) return null;
  const itemRe = new RegExp(`<item\\b[^>]*id="${firstIdref.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}"[^>]*href="([^"]+)"`, "i");
  const href = opf.match(itemRe)?.[1];
  if (!href) return null;
  const opfDir = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1) : "";
  const chapterPath = normalizeZipPath(opfDir + href);
  const chapterRaw = files[chapterPath];
  if (!chapterRaw) return null;
  const chapterXhtml = strFromU8(chapterRaw);
  const bodyMatch = chapterXhtml.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  const inner = bodyMatch ? bodyMatch[1] : chapterXhtml;
  const titleMatch = chapterXhtml.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const chapterTitle = titleMatch ? stripTags(titleMatch[1]).trim() || null : null;
  return { chapterTitle, html: sanitizeChapterHtml(inner) };
}

function normalizeZipPath(p: string): string {
  const parts = p.split("/");
  const out: string[] = [];
  for (const part of parts) {
    if (part === "" || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return out.join("/");
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}

/** Very small allowlist sanitizer. Removes scripts, styles, iframes,
 * event-handler attributes, external URLs on links, and img src (chapter
 * assets aren't shipped alongside the HTML). Keeps basic formatting tags. */
function sanitizeChapterHtml(html: string): string {
  let s = html;
  s = s.replace(/<script\b[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<style\b[\s\S]*?<\/style>/gi, "");
  s = s.replace(/<iframe\b[\s\S]*?<\/iframe>/gi, "");
  s = s.replace(/<link\b[^>]*>/gi, "");
  s = s.replace(/<meta\b[^>]*>/gi, "");
  s = s.replace(/\son[a-z]+="[^"]*"/gi, "");
  s = s.replace(/\son[a-z]+='[^']*'/gi, "");
  s = s.replace(/<a\b([^>]*)>/gi, (_m, attrs: string) => {
    const cleaned = attrs.replace(/\shref="[^"]*"/gi, "").replace(/\shref='[^']*'/gi, "");
    return `<a${cleaned} rel="noopener noreferrer nofollow">`;
  });
  s = s.replace(/<img\b([^>]*)>/gi, (_m, attrs: string) => {
    const alt = attrs.match(/alt="([^"]*)"/i)?.[1] ?? "";
    return `<span class="epub-img-placeholder">[image${alt ? `: ${alt}` : ""}]</span>`;
  });
  return s;
}

/** Extract plain body text from a DOCX by reading word/document.xml and
 * pulling every `<w:t>` node. Groups by paragraph so we can preserve line
 * breaks. Caps at `maxWords`. */
async function extractDocxText(bytes: Uint8Array, maxWords: number): Promise<string | null> {
  const { unzipSync, strFromU8 } = await import("fflate");
  const files = unzipSync(bytes);
  const raw = files["word/document.xml"];
  if (!raw) return null;
  const xml = strFromU8(raw);
  const paragraphs: string[] = [];
  const pRe = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  const tRe = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
  let m: RegExpExecArray | null;
  let wordCount = 0;
  while ((m = pRe.exec(xml)) !== null) {
    const inner = m[1];
    const parts: string[] = [];
    let tm: RegExpExecArray | null;
    while ((tm = tRe.exec(inner)) !== null) parts.push(decodeXmlEntities(tm[1]));
    const line = parts.join("").trim();
    if (line) {
      paragraphs.push(line);
      wordCount += line.split(/\s+/).length;
      if (wordCount >= maxWords) break;
    }
  }
  if (paragraphs.length === 0) return null;
  return paragraphs.join("\n\n");
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
}
