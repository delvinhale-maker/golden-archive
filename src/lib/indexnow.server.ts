/**
 * IndexNow submission helper (Bing, Yandex, Seznam, Naver).
 *
 * The IndexNow key is *public by design*: search engines fetch
 * `https://www.aurumvault.store/<key>.txt` to prove ownership of the host.
 * It is therefore safe to keep in source, but it can be overridden with the
 * `INDEXNOW_KEY` environment variable (read inside the function, never at
 * module scope) plus a matching key file in `public/`.
 *
 * Failures are swallowed by callers — IndexNow must never block a publish.
 */

export const INDEXNOW_DEFAULT_KEY = "a7f3c19d4b8e42f6905c1d7be32a48cd";
const SITE_ORIGIN = "https://www.aurumvault.store";
const ENDPOINT = "https://api.indexnow.org/IndexNow";

export type IndexNowResult = {
  submitted: number;
  status: number | null;
  error?: string;
};

function toAbsolute(pathOrUrl: string): string | null {
  const value = pathOrUrl.trim();
  if (!value) return null;
  try {
    const url = value.startsWith("http")
      ? new URL(value)
      : new URL(value.startsWith("/") ? value : `/${value}`, SITE_ORIGIN);
    // Only ever submit URLs on the canonical production host.
    if (url.hostname !== "www.aurumvault.store") return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Submit up to 100 URLs (paths or absolute URLs) to IndexNow.
 * Called only on meaningful publish/update/removal events.
 */
export async function submitToIndexNow(
  pathsOrUrls: string[],
): Promise<IndexNowResult> {
  const key = process.env["INDEXNOW_KEY"] || INDEXNOW_DEFAULT_KEY;
  const urlList = Array.from(
    new Set(
      pathsOrUrls
        .map(toAbsolute)
        .filter((u): u is string => Boolean(u)),
    ),
  ).slice(0, 100);

  if (urlList.length === 0) return { submitted: 0, status: null };

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: "www.aurumvault.store",
        key,
        keyLocation: `${SITE_ORIGIN}/${key}.txt`,
        urlList,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        `[indexnow] submission failed [${res.status}]: ${body.slice(0, 300)}`,
      );
      return { submitted: 0, status: res.status, error: body.slice(0, 300) };
    }
    console.info(`[indexnow] submitted ${urlList.length} url(s) — ${res.status}`);
    return { submitted: urlList.length, status: res.status };
  } catch (err) {
    console.error("[indexnow] submission threw:", err);
    return {
      submitted: 0,
      status: null,
      error: err instanceof Error ? err.message : "unknown error",
    };
  }
}
