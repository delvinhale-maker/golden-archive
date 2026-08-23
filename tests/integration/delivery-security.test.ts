/**
 * Automated security tests for the digital bundle delivery system.
 *
 * Covers three attack surfaces:
 *   1. RLS — anonymous visitors may read a bundle *manifest* only for live
 *      products, and may never write to it or read download tokens.
 *   2. Purchase / order validation — the delivery server function must verify
 *      buyer email, link expiry, file↔product ownership and pre-order gating.
 *   3. Signed URL expiry — private storage objects are unreachable without a
 *      signature and stop working once the signature expires.
 *
 * Run with: bunx vitest run tests/integration/delivery-security.test.ts
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const URL = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"] ?? "";
const ANON =
  process.env["SUPABASE_PUBLISHABLE_KEY"] ??
  process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ??
  "";
const SERVICE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";

const live = Boolean(URL && ANON && SERVICE);
const anon = live ? createClient(URL, ANON, { auth: { persistSession: false } }) : null;
const admin = live ? createClient(URL, SERVICE, { auth: { persistSession: false } }) : null;

const BUCKET = "product-files";
const TMP_PATH = `security-tests/expiry-probe-${Date.now()}.txt`;

describe("delivery security · source invariants", () => {
  const src = readFileSync("src/lib/product-delivery.functions.ts", "utf8");

  it("requires an authenticated caller", () => {
    expect(src).toContain("requireSupabaseAuth");
  });

  it("validates the download token and file id shapes", () => {
    expect(src).toMatch(/a-f0-9\]\{32,128\}/);
    expect(src).toContain("Invalid file id");
  });

  it("verifies the link belongs to the signed-in buyer", () => {
    expect(src).toContain("orderBuyerEmail.toLowerCase() !== buyerEmail");
  });

  it("rejects expired download links", () => {
    expect(src).toContain("new Date(dl.expires_at).getTime() < Date.now()");
  });

  it("only serves files that belong to the purchased product", () => {
    expect(src).toContain("f.product_id !== orderItem?.product_id");
  });

  it("keeps unreleased pre-orders gated", () => {
    expect(src).toContain("is_preorder_at_purchase");
    expect(src).toContain("hasn't been released yet");
  });

  it("mints short-lived signed URLs (10 minutes)", () => {
    expect(src).toContain("createSignedUrl(f.file_path, 60 * 10");
  });
});

describe.skipIf(!live)("delivery security · RLS", () => {
  it("anonymous manifest reads only expose live products", async () => {
    const { data, error } = await anon!
      .from("product_download_files")
      .select("id,product_id")
      .limit(200);
    expect(error).toBeNull();

    const ids = [...new Set((data ?? []).map((r) => r.product_id))];
    if (ids.length === 0) return;

    const { data: products } = await admin!
      .from("marketplace_products")
      .select("id,published,status")
      .in("id", ids);

    for (const p of products ?? []) {
      expect(p.published, `product ${p.id} manifest is public`).toBe(true);
      expect(p.status).toBe("approved");
    }
  });

  it("anonymous callers cannot write to the manifest", async () => {
    const ins = await anon!.from("product_download_files").insert({
      product_id: "00000000-0000-0000-0000-000000000000",
      seller_id: "00000000-0000-0000-0000-000000000000",
      label: "attack",
      file_path: "attack.zip",
    } as never);
    expect(ins.error).not.toBeNull();

    const upd = await anon!
      .from("product_download_files")
      .update({ file_path: "attack.zip" } as never)
      .neq("id", "00000000-0000-0000-0000-000000000000");
    expect(upd.error ?? upd.data).not.toBeNull();

    const del = await anon!
      .from("product_download_files")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    expect(del.error ?? del.data).not.toBeNull();
  });

  it("anonymous callers cannot read download tokens or orders", async () => {
    const dl = await anon!.from("order_downloads").select("token").limit(1);
    expect(dl.error ?? dl.data ?? []).not.toEqual([{ token: expect.anything() }]);
    expect((dl.data ?? []).length).toBe(0);

    const orders = await anon!.from("orders").select("buyer_email").limit(1);
    expect((orders.data ?? []).length).toBe(0);
  });
});

describe.skipIf(!live)("delivery security · signed URL expiry", () => {
  beforeAll(async () => {
    await admin!.storage
      .from(BUCKET)
      .upload(TMP_PATH, new Blob(["expiry probe"], { type: "text/plain" }), {
        upsert: true,
      });
  });

  afterAll(async () => {
    await admin!.storage.from(BUCKET).remove([TMP_PATH]);
  });

  it("private objects are unreachable without a signature", async () => {
    const res = await fetch(`${URL}/storage/v1/object/public/${BUCKET}/${TMP_PATH}`);
    expect(res.ok).toBe(false);

    const anonDl = await anon!.storage.from(BUCKET).download(TMP_PATH);
    expect(anonDl.error).not.toBeNull();
  });

  it("a valid signature works and an expired one does not", async () => {
    const fresh = await admin!.storage.from(BUCKET).createSignedUrl(TMP_PATH, 600, {
      download: true,
    });
    expect(fresh.error).toBeNull();
    const okRes = await fetch(fresh.data!.signedUrl);
    expect(okRes.status).toBe(200);

    const short = await admin!.storage.from(BUCKET).createSignedUrl(TMP_PATH, 1);
    expect(short.error).toBeNull();
    await new Promise((r) => setTimeout(r, 2500));
    const expiredRes = await fetch(short.data!.signedUrl);
    expect(expiredRes.ok).toBe(false);
  }, 20_000);
});
