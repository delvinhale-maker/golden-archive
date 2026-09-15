/**
 * AurumVault Digital Rights Passport Generator — Round 4 Export Center
 * server functions: QR rendering and PDF downloads.
 *
 * QR generation reuses this codebase's ONE existing QR-encoding pipeline
 * (the `qrcode` package plus @/lib/qr's validateQrColors/resolveQrSizePx —
 * the exact same helpers qr.functions.ts's renderQrImage uses) rather than
 * building a second QR system, per Round 4 spec §F's explicit instruction.
 * The QR always encodes the public rights-card URL — never a signed
 * storage URL, never raw JSON — and the destination is fixed server-side
 * from the owner's own published (or about-to-be-published) public_id,
 * never accepted as client input.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import QRCode from "qrcode";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRightsPassportEnabled } from "@/lib/rights-passport-feature-flags.middleware";
import { validateQrColors, resolveQrSizePx } from "@/lib/qr";
import {
  gatherWorkspaceForVerification,
  buildSerializeInput,
  publicUrlFor,
} from "@/lib/rights-passport-publish.functions";
import { serializePublicPassport, serializePrivatePassport } from "@/lib/rights-passport-serialize";
import { generatePassportPdfBytes } from "@/lib/rights-passport-pdf.server";

async function resolveOwnedPublicId(
  supabase: any,
  userId: string,
  passportKey: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("rights_passport_public_identities" as never)
    .select("public_id" as never)
    .eq("passport_key" as never, passportKey)
    .eq("owner_user_id" as never, userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as unknown as { public_id: string } | null;
  if (!row)
    throw new Error("Publish this passport at least once to generate its QR code and public URL.");
  return row.public_id;
}

async function renderQrPng(
  url: string,
  foreground?: string,
  background?: string,
  size?: string,
): Promise<string> {
  const colors = validateQrColors(foreground, background);
  if (!colors.ok) throw new Error(colors.reason);
  const width = resolveQrSizePx(size);
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    margin: 4,
    width,
    color: { dark: colors.foreground, light: colors.background },
  });
}

const passportKeySchema = z.object({ passportKey: z.string().uuid() });

export type QrRenderResult = { format: "png"; data: string } | { format: "svg"; data: string };

export const renderPassportQr = createServerFn({ method: "POST" })
  .middleware([requireRightsPassportEnabled, requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        passportKey: z.string().uuid(),
        format: z.enum(["png", "svg"]).optional(),
        size: z.enum(["small", "standard", "print"]).optional(),
        foreground: z.string().optional(),
        background: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<QrRenderResult> => {
    const { supabase, userId } = context;
    const publicId = await resolveOwnedPublicId(supabase, userId, data.passportKey);
    const url = publicUrlFor(publicId);

    const colors = validateQrColors(data.foreground, data.background);
    if (!colors.ok) throw new Error(colors.reason);
    const width = resolveQrSizePx(data.size);
    const opts = {
      errorCorrectionLevel: "M" as const,
      margin: 4,
      width,
      color: { dark: colors.foreground, light: colors.background },
    };

    if (data.format === "svg") {
      const svg = await QRCode.toString(url, { ...opts, type: "svg" });
      return { format: "svg", data: svg };
    }
    const png = await QRCode.toDataURL(url, opts);
    return { format: "png", data: png };
  });

async function resolvePayloadForPdf(
  supabase: any,
  userId: string,
  passportKey: string,
  mode: "public" | "private",
) {
  const { data: snapshot } = await supabase
    .from("rights_passport_snapshots" as never)
    .select("public_id,passport_version,status,published_at" as never)
    .eq("passport_key" as never, passportKey)
    .eq("owner_user_id" as never, userId)
    .eq("status" as never, "ACTIVE")
    .maybeSingle();
  const s = snapshot as unknown as {
    public_id: string;
    passport_version: number;
    status: "ACTIVE";
    published_at: string;
  } | null;

  const workspace = await gatherWorkspaceForVerification(supabase, userId, passportKey);
  const serializeInput = buildSerializeInput(
    workspace,
    s?.public_id ?? "UNPUBLISHED",
    s?.status ?? "ACTIVE",
    s?.published_at ?? new Date().toISOString(),
  );
  const payload =
    mode === "public"
      ? serializePublicPassport(serializeInput)
      : serializePrivatePassport(serializeInput);
  return { payload, publicId: s?.public_id ?? null };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export const downloadPublicPassportPdf = createServerFn({ method: "POST" })
  .middleware([requireRightsPassportEnabled, requireSupabaseAuth])
  .inputValidator((input: unknown) => passportKeySchema.parse(input))
  .handler(async ({ data, context }): Promise<{ pdfBase64: string }> => {
    const { supabase, userId } = context;
    const { payload, publicId } = await resolvePayloadForPdf(
      supabase,
      userId,
      data.passportKey,
      "public",
    );
    const qrPngDataUrl = publicId ? await renderQrPng(publicUrlFor(publicId)) : null;
    const bytes = await generatePassportPdfBytes(payload, { mode: "public", qrPngDataUrl });
    return { pdfBase64: bytesToBase64(bytes) };
  });

export const downloadPrivatePassportPdf = createServerFn({ method: "POST" })
  .middleware([requireRightsPassportEnabled, requireSupabaseAuth])
  .inputValidator((input: unknown) => passportKeySchema.parse(input))
  .handler(async ({ data, context }): Promise<{ pdfBase64: string }> => {
    const { supabase, userId } = context;
    const { payload, publicId } = await resolvePayloadForPdf(
      supabase,
      userId,
      data.passportKey,
      "private",
    );
    const qrPngDataUrl = publicId ? await renderQrPng(publicUrlFor(publicId)) : null;
    const bytes = await generatePassportPdfBytes(payload, { mode: "private", qrPngDataUrl });
    return { pdfBase64: bytesToBase64(bytes) };
  });
