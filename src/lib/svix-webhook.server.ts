function decodeBase64(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function verifySvixWebhook(params: {
  payload: string;
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  secret: string;
  toleranceSeconds?: number;
}): Promise<void> {
  const { payload, id, timestamp, signature, secret } = params;
  if (!id || !timestamp || !signature) {
    throw new Error("Missing Svix signature headers");
  }

  const unixSeconds = Number(timestamp);
  if (!Number.isFinite(unixSeconds)) {
    throw new Error("Invalid Svix timestamp");
  }

  const tolerance = params.toleranceSeconds ?? 300;
  if (Math.abs(Date.now() / 1000 - unixSeconds) > tolerance) {
    throw new Error("Stale Svix webhook");
  }

  const encodedSecret = secret.startsWith("whsec_")
    ? secret.slice("whsec_".length)
    : secret;
  const key = await crypto.subtle.importKey(
    "raw",
    decodeBase64(encodedSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${id}.${timestamp}.${payload}`),
  );
  const expected = encodeBase64(new Uint8Array(signed));

  const candidates = signature
    .trim()
    .split(/\s+/)
    .map((part) => part.split(",", 2))
    .filter(([version, value]) => version === "v1" && Boolean(value))
    .map(([, value]) => value);

  if (!candidates.some((candidate) => candidate === expected)) {
    throw new Error("Invalid Svix signature");
  }
}
