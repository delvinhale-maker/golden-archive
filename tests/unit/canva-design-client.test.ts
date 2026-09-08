/**
 * Executable (bun:test) coverage for the Canva design-discovery/export client
 * and the token-refresh helper in src/lib/canva-oauth.ts.
 *
 * canva-oauth.ts has no runtime dependency on any unresolvable package in
 * this sandbox (its only Supabase import is `import type`, erased at
 * transpile time, and oauth-token-crypto.server.ts has zero imports), so —
 * unlike canva-designs.functions.ts (zod, @tanstack/react-start) and the
 * vitest-based tests/unit/canva-oauth.test.ts (blocked here because
 * vite.config.ts can't load @lovable.dev/vite-tanstack-config from the
 * sandbox's unreachable private registry) — this file actually runs.
 *
 * Run with: bun test tests/unit/canva-design-client.test.ts
 */
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import {
  CANVA_SCOPES,
  CanvaApiError,
  listCanvaDesigns,
  createCanvaExportJob,
  getCanvaExportJob,
  exportCanvaDesign,
  getCanvaDesign,
  getCanvaProfile,
  downloadValidatedExportAsset,
  MAX_EXPORT_ASSET_BYTES,
} from "@/lib/canva-oauth";
import { encryptOAuthSecret, decryptOAuthSecret } from "@/lib/oauth-token-crypto.server";

process.env["INTEGRATION_TOKEN_ENCRYPTION_KEY"] ??= "canva-design-client-test-key";
// refreshCanvaToken() calls canvaConfig(), which throws "not configured" if
// these are unset — set them so the refresh-path tests exercise the real
// refresh logic instead of failing before ever reaching fetch().
process.env["CANVA_CLIENT_ID"] ??= "test-client-id";
process.env["CANVA_CLIENT_SECRET"] ??= "test-client-secret";
process.env["CANVA_REDIRECT_URI"] ??=
  "https://www.aurumvault.store/api/public/integrations/canva/callback";

describe("Canva scope set (least privilege)", () => {
  it("requests exactly the three scopes this workflow needs", () => {
    expect([...CANVA_SCOPES].sort()).toEqual(
      ["design:content:read", "design:meta:read", "profile:read"].sort(),
    );
  });

  it("never requests asset:read, asset:write, or design:content:write", () => {
    for (const scope of ["asset:read", "asset:write", "design:content:write"]) {
      expect(CANVA_SCOPES as readonly string[]).not.toContain(scope);
    }
  });
});

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers });
}

describe("Canva design client (fetch-level)", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("lists designs and maps id/title/thumbnail/timestamps", async () => {
    global.fetch = mock(async () =>
      jsonResponse(200, {
        items: [
          {
            id: "DAF-1",
            title: "Product Launch Flyer",
            thumbnail: { url: "https://canva.example/thumb.png", width: 400, height: 400 },
            created_at: 1_700_000_000,
            updated_at: 1_700_100_000,
          },
        ],
        continuation: "next-page-token",
      }),
    ) as unknown as typeof fetch;

    const result = await listCanvaDesigns("token-abc");
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.id).toBe("DAF-1");
    expect(result.items[0]!.title).toBe("Product Launch Flyer");
    expect(result.items[0]!.thumbnail?.url).toBe("https://canva.example/thumb.png");
    expect(result.items[0]!.updatedAt).toBe(new Date(1_700_100_000 * 1000).toISOString());
    expect(result.continuation).toBe("next-page-token");
  });

  it("falls back to 'Untitled design' when Canva omits a title, and null thumbnail", async () => {
    global.fetch = mock(async () =>
      jsonResponse(200, { items: [{ id: "DAF-2", thumbnail: null }] }),
    ) as unknown as typeof fetch;
    const result = await listCanvaDesigns("token-abc");
    expect(result.items[0]!.title).toBe("Untitled design");
    expect(result.items[0]!.thumbnail).toBeNull();
  });

  it("sends the continuation token as a query parameter", async () => {
    const fetchMock = mock(async (url: string) => {
      expect(String(url)).toContain("continuation=abc123");
      return jsonResponse(200, { items: [] });
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    await listCanvaDesigns("token-abc", "abc123");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("classifies 401 as reauth_required", async () => {
    global.fetch = mock(async () =>
      jsonResponse(401, { error: "unauthorized" }),
    ) as unknown as typeof fetch;
    const err: unknown = await listCanvaDesigns("stale-token").catch((e) => e);
    expect(err).toBeInstanceOf(CanvaApiError);
    expect((err as CanvaApiError).reason).toBe("reauth_required");
  });

  it("classifies 429 as rate_limited and carries retry-after seconds", async () => {
    global.fetch = mock(async () =>
      jsonResponse(429, { error: "rate limited" }, { "retry-after": "12" }),
    ) as unknown as typeof fetch;
    const err: unknown = await listCanvaDesigns("token-abc").catch((e) => e);
    expect(err).toBeInstanceOf(CanvaApiError);
    expect((err as CanvaApiError).reason).toBe("rate_limited");
    expect((err as CanvaApiError).retryAfterSeconds).toBe(12);
  });

  it("classifies 404 as design_unavailable", async () => {
    global.fetch = mock(async () =>
      jsonResponse(404, { error: "not found" }),
    ) as unknown as typeof fetch;
    const err: unknown = await getCanvaDesign("token-abc", "gone").catch((e) => e);
    expect((err as CanvaApiError).reason).toBe("design_unavailable");
  });

  it("classifies other non-OK statuses as api_error", async () => {
    global.fetch = mock(async () =>
      jsonResponse(500, { error: "boom" }),
    ) as unknown as typeof fetch;
    const err: unknown = await listCanvaDesigns("token-abc").catch((e) => e);
    expect((err as CanvaApiError).reason).toBe("api_error");
  });

  it("classifies a thrown network error as api_error, not an unclassified crash", async () => {
    global.fetch = mock(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const err: unknown = await listCanvaDesigns("token-abc").catch((e) => e);
    expect(err).toBeInstanceOf(CanvaApiError);
    expect((err as CanvaApiError).reason).toBe("api_error");
  });

  it("creates an export job with the requested design id and format, constrained to page 1", async () => {
    const fetchMock = mock(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body).toEqual({ design_id: "DAF-1", format: { type: "png", pages: [1] } });
      return jsonResponse(200, { job: { id: "export-1", status: "in_progress" } });
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const job = await createCanvaExportJob("token-abc", "DAF-1", "png");
    expect(job.status).toBe("in_progress");
  });

  it("exportCanvaDesign polls until success and returns the first URL", async () => {
    let calls = 0;
    global.fetch = mock(async (url: string) => {
      calls++;
      if (String(url).endsWith("/exports")) {
        return jsonResponse(200, { job: { id: "export-1", status: "in_progress" } });
      }
      // First poll still in progress, second poll succeeds.
      if (calls < 3) return jsonResponse(200, { job: { id: "export-1", status: "in_progress" } });
      return jsonResponse(200, {
        job: { id: "export-1", status: "success", urls: ["https://canva.example/out.png"] },
      });
    }) as unknown as typeof fetch;

    const result = await exportCanvaDesign("token-abc", "DAF-1", "png");
    expect(result.url).toBe("https://canva.example/out.png");
  });

  it("exportCanvaDesign surfaces export_failed when the job fails", async () => {
    global.fetch = mock(async (url: string) => {
      if (String(url).endsWith("/exports")) {
        return jsonResponse(200, { job: { id: "export-2", status: "in_progress" } });
      }
      return jsonResponse(200, {
        job: { id: "export-2", status: "failed", error: { message: "unsupported format" } },
      });
    }) as unknown as typeof fetch;

    const err: unknown = await exportCanvaDesign("token-abc", "DAF-2", "png").catch((e) => e);
    expect(err).toBeInstanceOf(CanvaApiError);
    expect((err as CanvaApiError).reason).toBe("export_failed");
  });

  it("getCanvaExportJob reflects success/failed/in_progress status verbatim", async () => {
    global.fetch = mock(async () =>
      jsonResponse(200, {
        job: { id: "export-3", status: "success", urls: ["https://canva.example/a.png"] },
      }),
    ) as unknown as typeof fetch;
    const job = await getCanvaExportJob("token-abc", "export-3");
    expect(job.status).toBe("success");
    expect(job.urls).toEqual(["https://canva.example/a.png"]);
  });

  it("getCanvaProfile returns the display name on success", async () => {
    global.fetch = mock(async () =>
      jsonResponse(200, { display_name: "Jordan Creator" }),
    ) as unknown as typeof fetch;
    const profile = await getCanvaProfile("token-abc");
    expect(profile.displayName).toBe("Jordan Creator");
  });

  it("getCanvaProfile fails soft to a null display name rather than throwing", async () => {
    global.fetch = mock(async () =>
      jsonResponse(500, { error: "boom" }),
    ) as unknown as typeof fetch;
    const profile = await getCanvaProfile("token-abc");
    expect(profile.displayName).toBeNull();
  });
});

const PNG_SIGNATURE_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function pngBytes(extra: number[] = [1, 2, 3, 4]): Uint8Array {
  return new Uint8Array([...PNG_SIGNATURE_BYTES, ...extra]);
}

describe("downloadValidatedExportAsset", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("accepts a valid PNG with an image/png content type", async () => {
    global.fetch = mock(
      async () =>
        new Response(pngBytes(), { status: 200, headers: { "content-type": "image/png" } }),
    ) as unknown as typeof fetch;
    const result = await downloadValidatedExportAsset("https://export.canva.example/file.png");
    expect(result.contentType).toBe("image/png");
    expect(Array.from(result.bytes.slice(0, 8))).toEqual(PNG_SIGNATURE_BYTES);
  });

  it("rejects a non-HTTPS export URL before ever fetching", async () => {
    const fetchMock = mock(async () => new Response(pngBytes(), { status: 200 }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const err: unknown = await downloadValidatedExportAsset(
      "http://export.canva.example/file.png",
    ).catch((e) => e);
    expect((err as CanvaApiError).reason).toBe("invalid_export_file");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a zero-byte response", async () => {
    global.fetch = mock(
      async () =>
        new Response(new Uint8Array(0), { status: 200, headers: { "content-type": "image/png" } }),
    ) as unknown as typeof fetch;
    const err: unknown = await downloadValidatedExportAsset(
      "https://export.canva.example/file.png",
    ).catch((e) => e);
    expect((err as CanvaApiError).reason).toBe("invalid_export_file");
    expect((err as CanvaApiError).message).toMatch(/empty/i);
  });

  it("rejects a response whose declared Content-Length exceeds the cap, without buffering it", async () => {
    global.fetch = mock(
      async () =>
        new Response(pngBytes(), {
          status: 200,
          headers: {
            "content-type": "image/png",
            "content-length": String(MAX_EXPORT_ASSET_BYTES + 1),
          },
        }),
    ) as unknown as typeof fetch;
    const err: unknown = await downloadValidatedExportAsset(
      "https://export.canva.example/file.png",
    ).catch((e) => e);
    expect((err as CanvaApiError).reason).toBe("invalid_export_file");
    expect((err as CanvaApiError).message).toMatch(/size/i);
  });

  it("rejects a response that actually streams more than the cap, even with no honest Content-Length", async () => {
    const chunkSize = 1024 * 1024; // 1 MiB
    const chunks = Math.ceil(MAX_EXPORT_ASSET_BYTES / chunkSize) + 2; // guaranteed to exceed the cap
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        const state = (this as unknown as { i?: number }).i ?? 0;
        if (state >= chunks) {
          controller.close();
          return;
        }
        controller.enqueue(new Uint8Array(chunkSize));
        (this as unknown as { i?: number }).i = state + 1;
      },
    });
    global.fetch = mock(async () => {
      const res = new Response(body, { status: 200, headers: { "content-type": "image/png" } });
      return res;
    }) as unknown as typeof fetch;

    const err: unknown = await downloadValidatedExportAsset(
      "https://export.canva.example/file.png",
    ).catch((e) => e);
    expect((err as CanvaApiError).reason).toBe("invalid_export_file");
    expect((err as CanvaApiError).message).toMatch(/size/i);
  });

  it("rejects HTML returned with a 200 status", async () => {
    global.fetch = mock(
      async () =>
        new Response("<html><body>Not found</body></html>", {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
    ) as unknown as typeof fetch;
    const err: unknown = await downloadValidatedExportAsset(
      "https://export.canva.example/file.png",
    ).catch((e) => e);
    expect((err as CanvaApiError).reason).toBe("invalid_export_file");
    expect((err as CanvaApiError).message).toMatch(/content type/i);
  });

  it("rejects a spoofed image/png header whose body is not actually a PNG", async () => {
    const notPng = new TextEncoder().encode("this is definitely not a png file");
    global.fetch = mock(
      async () => new Response(notPng, { status: 200, headers: { "content-type": "image/png" } }),
    ) as unknown as typeof fetch;
    const err: unknown = await downloadValidatedExportAsset(
      "https://export.canva.example/file.png",
    ).catch((e) => e);
    expect((err as CanvaApiError).reason).toBe("invalid_export_file");
    expect((err as CanvaApiError).message).toMatch(/PNG/);
  });

  it("rejects a non-2xx download response", async () => {
    global.fetch = mock(
      async () => new Response("gone", { status: 410 }),
    ) as unknown as typeof fetch;
    const err: unknown = await downloadValidatedExportAsset(
      "https://export.canva.example/file.png",
    ).catch((e) => e);
    expect((err as CanvaApiError).reason).toBe("invalid_export_file");
  });
});

/**
 * getValidCanvaAccessToken reads/writes integration_connections through the
 * admin-client seam. Mocked at the module boundary with bun:test's
 * mock.module so the real DB/network are never touched.
 *
 * The mock's update() implements a real compare-and-swap: a call that adds
 * an `.eq("updated_at", X)` filter only applies if the row's CURRENT
 * updated_at still equals X, exactly like the real conditional UPDATE this
 * code issues against Postgres. Every successful update (conditional or
 * not) bumps `updated_at` to a new value, mirroring the DB's
 * touch_updated_at() trigger — this is what lets the concurrency tests
 * below simulate a second request's claim landing on a stale version.
 */
const state: {
  row: Record<string, unknown> | null;
  updates: Record<string, unknown>[];
  generation: number;
} = { row: null, updates: [], generation: 0 };

function mockUpdate(patch: Record<string, unknown>) {
  const filters: [string, unknown][] = [];
  let selectCols: string | null = null;
  let executed = false;
  let result: { data: unknown; error: null } = { data: null, error: null };

  async function execute() {
    if (executed) return result;
    executed = true;
    const row = state.row;
    const matches =
      !!row &&
      filters.every(([col, val]) => String((row as Record<string, unknown>)[col]) === String(val));
    if (!matches) {
      result = { data: null, error: null };
      return result;
    }
    state.updates.push(patch);
    state.generation++;
    Object.assign(row as Record<string, unknown>, patch, { updated_at: `v${state.generation}` });
    result = { data: selectCols ? { ...row } : null, error: null };
    return result;
  }

  const api = {
    eq(col: string, val: unknown) {
      filters.push([col, val]);
      return api;
    },
    select(cols: string) {
      selectCols = cols;
      return api;
    },
    async maybeSingle() {
      return execute();
    },
    then(resolve: (v: { data: unknown; error: null }) => void) {
      execute().then(resolve);
    },
  };
  return api;
}

mock.module("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from(table: string) {
      if (table !== "integration_connections") throw new Error(`unexpected table: ${table}`);
      return {
        select() {
          return {
            eq() {
              return this;
            },
            async maybeSingle() {
              return { data: state.row ? { ...state.row } : null, error: null };
            },
          };
        },
        update: mockUpdate,
      };
    },
  },
}));

// Re-import after mock.module registration so getValidCanvaAccessToken picks
// up the mocked admin client on its dynamic import.
const { getValidCanvaAccessToken } = await import("@/lib/canva-oauth");

describe("getValidCanvaAccessToken", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    state.row = null;
    state.updates = [];
    state.generation = 0;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("throws not_connected when there is no connection row", async () => {
    const err: unknown = await getValidCanvaAccessToken("user-1").catch((e) => e);
    expect((err as CanvaApiError).reason).toBe("not_connected");
  });

  it("throws not_connected when status isn't 'connected'", async () => {
    state.row = { id: "row-1", status: "pending", access_token_enc: null, updated_at: "v0" };
    const err: unknown = await getValidCanvaAccessToken("user-1").catch((e) => e);
    expect((err as CanvaApiError).reason).toBe("not_connected");
  });

  it("returns the decrypted token directly when far from expiry", async () => {
    state.row = {
      id: "row-1",
      user_id: "user-1",
      status: "connected",
      access_token_enc: await encryptOAuthSecret("live-access-token"),
      refresh_token_enc: null,
      access_token_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      updated_at: "v0",
    };
    const token = await getValidCanvaAccessToken("user-1");
    expect(token).toBe("live-access-token");
    expect(state.updates).toHaveLength(0);
  });

  it("refreshes an expired token and persists the new one", async () => {
    state.row = {
      id: "row-1",
      user_id: "user-1",
      status: "connected",
      access_token_enc: await encryptOAuthSecret("stale-token"),
      refresh_token_enc: await encryptOAuthSecret("refresh-token-value"),
      access_token_expires_at: new Date(Date.now() - 1000).toISOString(),
      updated_at: "v0",
    };
    global.fetch = mock(
      async () =>
        new Response(
          JSON.stringify({
            access_token: "fresh-token",
            refresh_token: "new-refresh",
            expires_in: 3600,
          }),
          { status: 200 },
        ),
    ) as unknown as typeof fetch;

    const token = await getValidCanvaAccessToken("user-1");
    expect(token).toBe("fresh-token");
    expect(state.row!["status"]).toBe("connected");
    expect(await decryptOAuthSecret(state.row!["refresh_token_enc"])).toBe("new-refresh");
  });

  it("throws reauth_required and marks the connection errored when refresh fails", async () => {
    state.row = {
      id: "row-1",
      user_id: "user-1",
      status: "connected",
      access_token_enc: await encryptOAuthSecret("stale-token"),
      refresh_token_enc: await encryptOAuthSecret("bad-refresh-token"),
      access_token_expires_at: new Date(Date.now() - 1000).toISOString(),
      updated_at: "v0",
    };
    global.fetch = mock(
      async () => new Response("invalid_grant", { status: 400 }),
    ) as unknown as typeof fetch;

    const err: unknown = await getValidCanvaAccessToken("user-1").catch((e) => e);
    expect((err as CanvaApiError).reason).toBe("reauth_required");
    expect(state.row!["status"]).toBe("error");
  });

  it("throws reauth_required when expired with no refresh token (revoked)", async () => {
    state.row = {
      id: "row-1",
      user_id: "user-1",
      status: "connected",
      access_token_enc: await encryptOAuthSecret("stale-token"),
      refresh_token_enc: null,
      access_token_expires_at: new Date(Date.now() - 1000).toISOString(),
      updated_at: "v0",
    };
    const err: unknown = await getValidCanvaAccessToken("user-1").catch((e) => e);
    expect((err as CanvaApiError).reason).toBe("reauth_required");
  });

  describe("concurrent refresh (compare-and-swap on updated_at)", () => {
    it("only one of two concurrent refreshes calls Canva; the loser reuses the winner's token", async () => {
      state.row = {
        id: "row-1",
        user_id: "user-1",
        status: "connected",
        access_token_enc: await encryptOAuthSecret("stale-token"),
        refresh_token_enc: await encryptOAuthSecret("refresh-token-value"),
        access_token_expires_at: new Date(Date.now() - 1000).toISOString(),
        updated_at: "v0",
      };
      let canvaRefreshCalls = 0;
      global.fetch = mock(async () => {
        canvaRefreshCalls++;
        return new Response(
          JSON.stringify({
            access_token: "fresh-token",
            refresh_token: "new-refresh",
            expires_in: 3600,
          }),
          { status: 200 },
        );
      }) as unknown as typeof fetch;

      const [tokenA, tokenB] = await Promise.all([
        getValidCanvaAccessToken("user-1"),
        getValidCanvaAccessToken("user-1"),
      ]);

      // Requirement: only one request may consume the stored refresh-token
      // generation — Canva revokes the whole grant if the same refresh
      // token is sent twice, so this must never be 2.
      expect(canvaRefreshCalls).toBe(1);
      // Requirement: the losing request re-reads and uses the winner's token.
      expect(tokenA).toBe("fresh-token");
      expect(tokenB).toBe("fresh-token");
      // Requirement: final status remains connected, and the newest
      // rotated refresh token is what's actually stored.
      expect(state.row!["status"]).toBe("connected");
      expect(await decryptOAuthSecret(state.row!["refresh_token_enc"])).toBe("new-refresh");
    });

    it("a stale failed refresh does not clobber a newer state that changed after the claim", async () => {
      state.row = {
        id: "row-1",
        user_id: "user-1",
        status: "connected",
        access_token_enc: await encryptOAuthSecret("stale-token"),
        refresh_token_enc: await encryptOAuthSecret("refresh-token-value"),
        access_token_expires_at: new Date(Date.now() - 1000).toISOString(),
        updated_at: "v0",
      };

      let releaseFetch: (() => void) | null = null;
      const fetchGate = new Promise<void>((resolve) => {
        releaseFetch = resolve;
      });
      global.fetch = mock(async () => {
        await fetchGate;
        return new Response("invalid_grant", { status: 400 });
      }) as unknown as typeof fetch;

      const refreshPromise = getValidCanvaAccessToken("user-1");

      // Let the claim (a microtask-only chain) land before we mutate state —
      // the refresh call is blocked on fetchGate, so this is deterministic:
      // the claim has already captured "v1" by the time this timer fires.
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(state.row!["updated_at"]).toBe("v1"); // confirms the claim landed first
      state.row!["status"] = "revoked";
      state.row!["updated_at"] = "v2"; // simulate a concurrent disconnect's own update

      releaseFetch!();

      const err: unknown = await refreshPromise.catch((e) => e);
      expect((err as CanvaApiError).reason).toBe("reauth_required");
      // The stale failure must NOT overwrite the newer "revoked" state.
      expect(state.row!["status"]).toBe("revoked");
    });
  });
});
