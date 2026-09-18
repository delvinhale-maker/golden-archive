export class EmailDeliveryError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = "EmailDeliveryError";
  }
}

export type IndependentEmailPayload = {
  to: string;
  from: string;
  subject: string;
  html?: string;
  text?: string;
  idempotencyKey?: string;
  unsubscribeToken?: string;
};

function siteUrl(): string {
  return (
    process.env.PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    "https://www.aurumvault.store"
  ).replace(/\/$/, "");
}

export async function sendIndependentEmail(
  payload: IndependentEmailPayload,
): Promise<{ id: string | null }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new EmailDeliveryError("RESEND_API_KEY is not configured", 500);
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (payload.idempotencyKey) {
    headers["Idempotency-Key"] = payload.idempotencyKey.slice(0, 256);
  }

  const messageHeaders: Record<string, string> = {};
  if (payload.unsubscribeToken) {
    messageHeaders["List-Unsubscribe"] =
      `<${siteUrl()}/email/unsubscribe?token=${encodeURIComponent(payload.unsubscribeToken)}>`;
    messageHeaders["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  const response = await fetch(
    process.env.RESEND_API_URL ?? "https://api.resend.com/emails",
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        from: payload.from,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        headers:
          Object.keys(messageHeaders).length > 0 ? messageHeaders : undefined,
      }),
    },
  );

  const retryAfterHeader = response.headers.get("retry-after");
  const retryAfterSeconds =
    retryAfterHeader && Number.isFinite(Number(retryAfterHeader))
      ? Number(retryAfterHeader)
      : null;

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const message =
      body &&
      typeof body === "object" &&
      "message" in body &&
      typeof (body as { message?: unknown }).message === "string"
        ? (body as { message: string }).message
        : `Email provider request failed with status ${response.status}`;
    throw new EmailDeliveryError(message, response.status, retryAfterSeconds);
  }

  const id =
    body &&
    typeof body === "object" &&
    "id" in body &&
    typeof (body as { id?: unknown }).id === "string"
      ? (body as { id: string }).id
      : null;

  return { id };
}
