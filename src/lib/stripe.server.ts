import Stripe from "stripe";

const getEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not configured`);
  return value;
};

export type StripeEnv = "sandbox" | "live";

const GATEWAY_STRIPE_BASE = "https://connector-gateway.lovable.dev/stripe";

export function getConnectionApiKey(env: StripeEnv): string {
  return env === "sandbox"
    ? getEnv("STRIPE_SANDBOX_API_KEY")
    : getEnv("STRIPE_LIVE_API_KEY");
}

export function createStripeClient(env: StripeEnv): Stripe {
  const connectionApiKey = getConnectionApiKey(env);
  const lovableApiKey = getEnv("LOVABLE_API_KEY");

  return new Stripe(connectionApiKey, {
    apiVersion: "2026-03-25.dahlia",
    httpClient: Stripe.createFetchHttpClient((input, init) => {
      const stripeUrl = input instanceof Request ? input.url : input.toString();
      const gatewayUrl = stripeUrl.replace("https://api.stripe.com", GATEWAY_STRIPE_BASE);
      return fetch(gatewayUrl, {
        ...init,
        headers: {
          ...Object.fromEntries(
            new Headers(
              init?.headers ?? (input instanceof Request ? input.headers : undefined),
            ).entries(),
          ),
          "X-Connection-Api-Key": connectionApiKey,
          "Lovable-API-Key": lovableApiKey,
        },
      });
    }),
  });
}

// ---------------------------------------------------------------------------
// Managed Payments capability detection
// ---------------------------------------------------------------------------
// Cache the account's managed_payments capability per environment so we don't
// hit `accounts.retrieve` on every checkout. TTL keeps it fresh if the user
// toggles capabilities in the Stripe dashboard.
type TaxMode = "managed" | "automatic";
type CachedMode = { mode: TaxMode; at: number };
const TAX_MODE_TTL_MS = 5 * 60_000;
const taxModeCache = new Map<StripeEnv, CachedMode>();

export async function detectTaxMode(
  stripe: Stripe,
  env: StripeEnv,
): Promise<TaxMode> {
  const cached = taxModeCache.get(env);
  if (cached && Date.now() - cached.at < TAX_MODE_TTL_MS) return cached.mode;
  let mode: TaxMode = "automatic";
  try {
    const account = (await (stripe.accounts.retrieve as any)()) as {
      capabilities?: Record<string, string | undefined>;
      controller?: { managed_payments?: { enabled?: boolean } };
    };
    const cap = account.capabilities?.managed_payments;
    const controllerEnabled = account.controller?.managed_payments?.enabled;
    if (cap === "active" || controllerEnabled === true) mode = "managed";
  } catch {
    // Fall back to automatic_tax if capability lookup fails — never both.
    mode = "automatic";
  }
  taxModeCache.set(env, { mode, at: Date.now() });
  return mode;
}

/**
 * Thrown when the caller hands `applyTaxMode` (or `assertTaxModeInvariant`)
 * a params object whose existing tax fields contradict the resolved tax mode.
 * Surfacing this as a typed, server-side error lets us catch
 * misconfigurations in our own checkout builders BEFORE Stripe rejects the
 * session with an opaque 400.
 */
export class TaxModeConflictError extends Error {
  constructor(
    public readonly mode: TaxMode,
    public readonly offendingFields: string[],
    public readonly details: Record<string, unknown>,
  ) {
    super(
      `Tax mode conflict: resolved mode is "${mode}" but session params already set ` +
        `${offendingFields.join(", ")}. Stripe rejects sessions that mix managed_payments ` +
        `with automatic_tax. Fix the checkout builder so it does not set these fields manually.`,
    );
    this.name = "TaxModeConflictError";
  }
}

/**
 * Mutates a Checkout Session params object to apply exactly one tax mode.
 * Guarantees `managed_payments` and `automatic_tax` are never set together,
 * which the Stripe API rejects.
 *
 * If the incoming params already set a tax field that conflicts with the
 * resolved mode, throws `TaxModeConflictError` and logs the offending input
 * instead of silently deleting it — silent deletion has historically hidden
 * real bugs where one code path set `automatic_tax` and another set
 * `managed_payments` on the same session.
 */
export function applyTaxMode<T extends Record<string, any>>(
  params: T,
  mode: TaxMode,
): T {
  const hasManaged = params.managed_payments !== undefined;
  const hasAutomatic = params.automatic_tax !== undefined;

  // Loud conflict: both fields set on input.
  if (hasManaged && hasAutomatic) {
    const err = new TaxModeConflictError(mode, ["managed_payments", "automatic_tax"], {
      managed_payments: params.managed_payments,
      automatic_tax: params.automatic_tax,
    });
    console.error("[stripe] applyTaxMode received conflicting tax fields", {
      mode,
      managed_payments: params.managed_payments,
      automatic_tax: params.automatic_tax,
    });
    throw err;
  }

  // Loud conflict: caller pre-set the OPPOSITE field from the resolved mode.
  if (mode === "managed" && hasAutomatic) {
    console.error(
      "[stripe] applyTaxMode: resolved mode=managed but caller set automatic_tax",
      { automatic_tax: params.automatic_tax },
    );
    throw new TaxModeConflictError(mode, ["automatic_tax"], {
      automatic_tax: params.automatic_tax,
    });
  }
  if (mode === "automatic" && hasManaged) {
    console.error(
      "[stripe] applyTaxMode: resolved mode=automatic but caller set managed_payments",
      { managed_payments: params.managed_payments },
    );
    throw new TaxModeConflictError(mode, ["managed_payments"], {
      managed_payments: params.managed_payments,
    });
  }

  if (mode === "managed") {
    (params as any).managed_payments = { enabled: true };
  } else {
    (params as any).automatic_tax = { enabled: true };
  }

  assertTaxModeInvariant(params, mode);
  return params;
}

/**
 * Final pre-flight check: a fully-built session params object must carry
 * exactly one of `managed_payments` / `automatic_tax`, matching `mode`.
 * Call this immediately before `stripe.checkout.sessions.create(...)` in
 * every checkout flow so we fail fast with a clear stack trace instead of
 * relying on Stripe's opaque rejection.
 */
export function assertTaxModeInvariant(
  params: Record<string, any>,
  mode: TaxMode,
): void {
  const hasManaged = params.managed_payments !== undefined;
  const hasAutomatic = params.automatic_tax !== undefined;

  if (hasManaged && hasAutomatic) {
    console.error("[stripe] tax-mode invariant violated: both fields present", {
      mode,
      managed_payments: params.managed_payments,
      automatic_tax: params.automatic_tax,
    });
    throw new TaxModeConflictError(mode, ["managed_payments", "automatic_tax"], {
      managed_payments: params.managed_payments,
      automatic_tax: params.automatic_tax,
    });
  }
  if (mode === "managed" && !hasManaged) {
    throw new TaxModeConflictError(mode, ["managed_payments(missing)"], {});
  }
  if (mode === "automatic" && !hasAutomatic) {
    throw new TaxModeConflictError(mode, ["automatic_tax(missing)"], {});
  }
}

export function getStripeErrorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const e = error as { message?: string; raw?: { message?: string } };
    const message = e.raw?.message ?? e.message;
    if (message) return message;
  }
  return "Stripe request failed";
}

export async function verifyWebhook(
  req: Request,
  env: StripeEnv,
): Promise<{ type: string; data: { object: any }; id: string }> {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();
  const secret =
    env === "sandbox"
      ? getEnv("PAYMENTS_SANDBOX_WEBHOOK_SECRET")
      : getEnv("PAYMENTS_LIVE_WEBHOOK_SECRET");

  if (!signature || !body) throw new Error("Missing signature or body");

  let timestamp: string | undefined;
  const v1Signatures: string[] = [];
  for (const part of signature.split(",")) {
    const [key, value] = part.split("=", 2);
    if (key === "t") timestamp = value;
    if (key === "v1") v1Signatures.push(value);
  }
  if (!timestamp || v1Signatures.length === 0) throw new Error("Invalid signature format");

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) throw new Error("Webhook timestamp too old");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  const expected = Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (!v1Signatures.includes(expected)) throw new Error("Invalid webhook signature");
  return JSON.parse(body);
}
