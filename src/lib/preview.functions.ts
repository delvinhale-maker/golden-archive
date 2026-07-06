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

      // Layer 2: single diagonal stripe, large, ~40% opacity, centered.
      const stripeSize = Math.min(width, height) * 0.06;
      const stripeWidth = font.widthOfTextAtSize(diagonalText, stripeSize);
      const cx = width / 2;
      const cy = height / 2;
      // Rotate -30deg around the center; compute the drawText origin
      // (bottom-left of the text box in user space).
      const angleRad = (-30 * Math.PI) / 180;
      const ox = cx - Math.cos(angleRad) * (stripeWidth / 2) - Math.sin(angleRad) * (stripeSize / 2);
      const oy = cy - Math.sin(angleRad) * (stripeWidth / 2) + Math.cos(angleRad) * (stripeSize / 2) - stripeSize;
      page.drawText(diagonalText, {
        x: ox,
        y: oy,
        size: stripeSize,
        font,
        color: gold,
        opacity: 0.4,
        rotate: degrees(-30),
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
