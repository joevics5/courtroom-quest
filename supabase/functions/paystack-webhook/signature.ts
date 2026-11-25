// Checks that a webhook really came from Paystack. Pure functions (Web Crypto only) so they can be unit tested.
//
// Paystack signs the RAW request body with HMAC-SHA512, in one of two ways:
//   Paystack-Signature: t=<unix seconds>,v1=<key id>:<hex>   keyed with the webhook signing secret (whsec_...),
//                       over "<t>." + body, and rejected when t is more than 5 minutes off
//   X-Paystack-Signature: <hex>                              keyed with the secret key, over the body (deprecated)

export const TOLERANCE_SECONDS = 300;
const HEX_SHA512 = /^[0-9a-f]{128}$/;

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha512Hex(secret: string, message: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, message as BufferSource));
}

/** Compares two strings without stopping at the first difference. */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function concat(prefix: Uint8Array, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(prefix.length + body.length);
  out.set(prefix, 0);
  out.set(body, prefix.length);
  return out;
}

export type SignatureResult = "signing-secret" | "secret-key" | null;

export async function verifyPaystackSignature(
  rawBody: Uint8Array,
  headers: { signature?: string | null; legacySignature?: string | null },
  secrets: { signingSecret?: string; secretKey?: string },
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<SignatureResult> {
  // The newer header, whenever a signing secret is set up and Paystack sent it. Nothing else is trusted then.
  if (headers.signature && secrets.signingSecret) {
    let t: number | null = null;
    const entries: string[] = [];
    for (const part of headers.signature.split(",")) {
      const i = part.indexOf("=");
      if (i === -1) continue;
      const key = part.slice(0, i).trim();
      const value = part.slice(i + 1).trim();
      if (key === "t") {
        if (t !== null || !/^[0-9]+$/.test(value)) return null;
        t = Number(value);
      } else if (key === "v1") {
        const j = value.indexOf(":");
        if (j !== -1) entries.push(value.slice(j + 1));
      }
    }
    if (t === null || entries.length === 0) return null;
    if (Math.abs(nowSeconds - t) > TOLERANCE_SECONDS) return null;
    const expected = await hmacSha512Hex(secrets.signingSecret, concat(new TextEncoder().encode(`${t}.`), rawBody));
    return entries.some((hex) => HEX_SHA512.test(hex) && constantTimeEqual(expected, hex)) ? "signing-secret" : null;
  }

  // The older header, keyed with the secret key.
  if (headers.legacySignature && secrets.secretKey) {
    const expected = await hmacSha512Hex(secrets.secretKey, rawBody);
    return HEX_SHA512.test(headers.legacySignature) && constantTimeEqual(expected, headers.legacySignature) ? "secret-key" : null;
  }

  return null;
}
