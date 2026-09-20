/**
 * AurumVault Digital Rights Passport Generator — Round 4 PDF generation.
 *
 * Server-only module (never bundled to the client — same *.server.ts
 * naming convention as client.server.ts). Uses pdf-lib the same way
 * preview.functions.ts already does in this codebase: dynamic import
 * (Worker-runtime compatible), PDFDocument.create(), embedFont, rgb,
 * page.drawText — reused patterns, not a new PDF pipeline.
 *
 * SAFETY: this module only ever draws fields already present on the
 * PublicPassportPayload / PrivatePassportPayload types
 * (rights-passport-serialize.ts) — those types are themselves the privacy
 * boundary (tested there). This file adds no new field sourcing of its
 * own, so it cannot introduce a new privacy leak independent of the
 * serializer.
 */
import type {
  PublicPassportPayload,
  PrivatePassportPayload,
} from "@/lib/rights-passport-serialize";

const PAGE_WIDTH = 612; // US Letter, points
const PAGE_HEIGHT = 792;
const MARGIN = 56;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const NAVY = { r: 0.06, g: 0.09, b: 0.18 };
const IVORY = { r: 0.98, g: 0.965, b: 0.93 };
const GOLD = { r: 0.79, g: 0.66, b: 0.3 };
const INK = { r: 0.15, g: 0.16, b: 0.2 };
const MUTE = { r: 0.45, g: 0.46, b: 0.5 };

export type GeneratePdfOptions = {
  mode: "public" | "private";
  qrPngDataUrl?: string | null;
};

function wrapText(text: string, font: any, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function generatePassportPdfBytes(
  payload: PublicPassportPayload | PrivatePassportPayload,
  opts: GeneratePdfOptions,
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");

  const doc = await PDFDocument.create();
  doc.setTitle(
    `${payload.passport.schema_name} — ${opts.mode === "public" ? "Public" : "Private Owner"} Edition`,
  );
  doc.setSubject("AurumVault Digital Rights Passport");
  doc.setProducer("AurumVault");

  const bodyFont = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(NAVY.r, NAVY.g, NAVY.b);
  const ivory = rgb(IVORY.r, IVORY.g, IVORY.b);
  const gold = rgb(GOLD.r, GOLD.g, GOLD.b);
  const ink = rgb(INK.r, INK.g, INK.b);
  const mute = rgb(MUTE.r, MUTE.g, MUTE.b);

  // ---- Cover page ----
  const cover = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  cover.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: navy });
  cover.drawText("AURUMVAULT", {
    x: MARGIN,
    y: PAGE_HEIGHT - 200,
    size: 14,
    font: boldFont,
    color: gold,
  });
  cover.drawText("DIGITAL RIGHTS PASSPORT", {
    x: MARGIN,
    y: PAGE_HEIGHT - 240,
    size: 28,
    font: boldFont,
    color: ivory,
  });
  cover.drawText("Your Identity. Your Work. Your Rules.", {
    x: MARGIN,
    y: PAGE_HEIGHT - 270,
    size: 12,
    font: bodyFont,
    color: gold,
  });
  cover.drawText(opts.mode === "public" ? "PUBLIC EDITION" : "PRIVATE OWNER EDITION", {
    x: MARGIN,
    y: 80,
    size: 10,
    font: boldFont,
    color: gold,
  });
  cover.drawText(payload.passport.passport_id, {
    x: MARGIN,
    y: 62,
    size: 9,
    font: bodyFont,
    color: ivory,
  });

  // ---- Content pages (paginated cursor) ----
  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: ivory });
  let y = PAGE_HEIGHT - MARGIN;

  function newPage() {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: ivory });
    y = PAGE_HEIGHT - MARGIN;
  }

  function ensureSpace(height: number) {
    if (y - height < MARGIN) newPage();
  }

  function heading(text: string) {
    ensureSpace(30);
    y -= 6;
    page.drawText(text.toUpperCase(), { x: MARGIN, y, size: 13, font: boldFont, color: gold });
    y -= 6;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.75,
      color: gold,
    });
    y -= 18;
  }

  function field(label: string, value: string | null | undefined) {
    ensureSpace(16);
    page.drawText(`${label}:`, { x: MARGIN, y, size: 9.5, font: boldFont, color: ink });
    const labelWidth = boldFont.widthOfTextAtSize(`${label}: `, 9.5);
    const text = value?.trim() ? value : "Not stated";
    const lines = wrapText(text, bodyFont, 9.5, CONTENT_WIDTH - labelWidth);
    page.drawText(lines[0] ?? "", {
      x: MARGIN + labelWidth,
      y,
      size: 9.5,
      font: bodyFont,
      color: ink,
    });
    y -= 14;
    for (const extra of lines.slice(1)) {
      ensureSpace(14);
      page.drawText(extra, { x: MARGIN + labelWidth, y, size: 9.5, font: bodyFont, color: ink });
      y -= 14;
    }
  }

  function paragraph(text: string, size = 9, color = mute) {
    for (const line of wrapText(text, bodyFont, size, CONTENT_WIDTH)) {
      ensureSpace(size + 4);
      page.drawText(line, { x: MARGIN, y, size, font: bodyFont, color });
      y -= size + 4;
    }
  }

  // 2. PASSPORT IDENTITY
  heading("Passport Identity");
  field("Passport ID", payload.passport.passport_id);
  field("Version", String(payload.passport.passport_version));
  field("Public Name", payload.subject.public_name);
  field("Professional Name", payload.subject.professional_name);
  field("Rights Entity", payload.subject.rights_entity);
  field("Primary Role", payload.subject.primary_role);
  field("Jurisdiction", payload.subject.jurisdiction);
  field("Verification Level", payload.subject.verification_level);
  field("Rights Contact", payload.subject.rights_contact.email);
  field("Published Date", payload.passport.published_at);
  field("Effective Date", payload.passport.effective_at);
  y -= 8;

  // 3. RIGHTS ASSET SUMMARY
  heading("Rights Asset Summary");
  if (payload.assets.length === 0) {
    paragraph("No public assets on record.");
  } else {
    for (const a of payload.assets) {
      ensureSpace(14);
      page.drawText(`• ${a.name} — ${a.asset_type}${a.territory ? ` (${a.territory})` : ""}`, {
        x: MARGIN,
        y,
        size: 9.5,
        font: bodyFont,
        color: ink,
      });
      y -= 14;
    }
  }
  y -= 8;

  // 4. AI & SYNTHETIC RIGHTS
  heading("AI & Synthetic Rights");
  if (payload.ai_permissions.length === 0) {
    paragraph("No AI use permissions declared.");
  } else {
    for (const p of payload.ai_permissions) {
      ensureSpace(14);
      page.drawText(`• ${p.use_case.replace(/_/g, " ")}: ${p.permission}`, {
        x: MARGIN,
        y,
        size: 9.5,
        font: bodyFont,
        color: ink,
      });
      y -= 14;
    }
  }
  y -= 8;

  // 5. LICENSE SUMMARY
  heading("License Summary");
  paragraph(payload.license_notice ?? "No existing licensing agreements on record.");
  y -= 8;

  // 6. PROVENANCE / EVIDENCE SUMMARY
  heading("Provenance / Evidence Summary");
  if (payload.provenance.length === 0) {
    paragraph("No evidence records on file.");
  } else {
    for (const p of payload.provenance) {
      ensureSpace(14);
      page.drawText(`• ${p.evidence_type.replace(/_/g, " ")}: ${p.status.replace(/_/g, " ")}`, {
        x: MARGIN,
        y,
        size: 9.5,
        font: bodyFont,
        color: ink,
      });
      y -= 14;
    }
  }
  y -= 8;

  // Private-only section
  if (opts.mode === "private" && "private" in payload) {
    const priv = (payload as PrivatePassportPayload).private;
    heading("Owner-Private Details");
    field("Legal Name", priv.legal_name);
    field("Representative", priv.representative.name);
    field("Agent / Manager", priv.agent_manager.name);
    field("Successor / Estate Contact", priv.successor_estate_contact);
    y -= 8;
  }

  // 8. DIGITAL LEGACY SUMMARY
  heading("Digital Legacy Summary");
  field("Successor planning on file", payload.legacy.successor_planning_on_file ? "Yes" : "No");
  field("Posthumous / estate AI use", payload.legacy.posthumous_ai_use);
  y -= 8;

  // 9. RIGHTS CONTACT
  heading("Rights Contact");
  field("Email", payload.subject.rights_contact.email);
  field("Public Rights URL", payload.subject.rights_contact.url);
  y -= 8;

  // 10. QR CODE
  heading("Public Rights Card");
  field("URL", payload.passport.human_readable_url);
  if (opts.qrPngDataUrl) {
    ensureSpace(140);
    try {
      const base64 = opts.qrPngDataUrl.split(",")[1] ?? "";
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const qrImage = await doc.embedPng(bytes);
      const qrSize = 120;
      ensureSpace(qrSize + 10);
      page.drawImage(qrImage, { x: MARGIN, y: y - qrSize, width: qrSize, height: qrSize });
      y -= qrSize + 12;
    } catch {
      // QR embedding is best-effort — the URL text above is always present regardless.
    }
  }

  // 11. DISCLAIMER
  heading("Disclaimer");
  paragraph(payload.notices.legal_effect, 8.5);
  y -= 6;
  paragraph(payload.notices.standards, 8, mute);

  return doc.save();
}
