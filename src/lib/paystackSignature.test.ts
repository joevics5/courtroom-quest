import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyPaystackSignature, TOLERANCE_SECONDS } from '../../supabase/functions/paystack-webhook/signature';

const body = '{"event":"charge.success","data":{"id":1,"amount":599000}}';
const raw = new TextEncoder().encode(body);
const SIGNING = 'whsec_test_signing_secret';
const SECRET_KEY = 'sk_test_secret_key';
const NOW = 1_800_000_000;

const sign = (secret: string, message: string) => createHmac('sha512', secret).update(message).digest('hex');
const header = (t: number, ...sigs: string[]) => `t=${t},${sigs.map((s, i) => `v1=whk_k${i}:${s}`).join(',')}`;

describe('Paystack-Signature (signing secret)', () => {
  it('accepts a correct signature', async () => {
    const h = header(NOW, sign(SIGNING, `${NOW}.${body}`));
    expect(await verifyPaystackSignature(raw, { signature: h }, { signingSecret: SIGNING }, NOW)).toBe('signing-secret');
  });

  it('accepts either signature while the secret is being rotated', async () => {
    const h = header(NOW, sign('whsec_old', `${NOW}.${body}`), sign(SIGNING, `${NOW}.${body}`));
    expect(await verifyPaystackSignature(raw, { signature: h }, { signingSecret: SIGNING }, NOW)).toBe('signing-secret');
  });

  it('rejects a wrong secret, a changed body and a malformed header', async () => {
    const good = header(NOW, sign(SIGNING, `${NOW}.${body}`));
    expect(await verifyPaystackSignature(raw, { signature: header(NOW, sign('whsec_other', `${NOW}.${body}`)) }, { signingSecret: SIGNING }, NOW)).toBeNull();
    expect(await verifyPaystackSignature(new TextEncoder().encode(body.replace('599000', '1')), { signature: good }, { signingSecret: SIGNING }, NOW)).toBeNull();
    expect(await verifyPaystackSignature(raw, { signature: 'garbage' }, { signingSecret: SIGNING }, NOW)).toBeNull();
    expect(await verifyPaystackSignature(raw, { signature: `t=${NOW},v1=whk_k:short` }, { signingSecret: SIGNING }, NOW)).toBeNull();
    expect(await verifyPaystackSignature(raw, { signature: `v1=whk_k:${sign(SIGNING, `${NOW}.${body}`)}` }, { signingSecret: SIGNING }, NOW)).toBeNull();
  });

  it('rejects an old or future timestamp (replay), but allows a few minutes of clock difference', async () => {
    const old = NOW - TOLERANCE_SECONDS - 1;
    expect(await verifyPaystackSignature(raw, { signature: header(old, sign(SIGNING, `${old}.${body}`)) }, { signingSecret: SIGNING }, NOW)).toBeNull();
    const future = NOW + TOLERANCE_SECONDS + 1;
    expect(await verifyPaystackSignature(raw, { signature: header(future, sign(SIGNING, `${future}.${body}`)) }, { signingSecret: SIGNING }, NOW)).toBeNull();
    const ok = NOW - TOLERANCE_SECONDS;
    expect(await verifyPaystackSignature(raw, { signature: header(ok, sign(SIGNING, `${ok}.${body}`)) }, { signingSecret: SIGNING }, NOW)).toBe('signing-secret');
  });

  it('does not fall back to the old header once the new one is present and wrong', async () => {
    const bad = header(NOW, sign('whsec_other', `${NOW}.${body}`));
    const legacy = sign(SECRET_KEY, body);
    expect(await verifyPaystackSignature(raw, { signature: bad, legacySignature: legacy }, { signingSecret: SIGNING, secretKey: SECRET_KEY }, NOW)).toBeNull();
  });
});

describe('X-Paystack-Signature (secret key, the older header)', () => {
  it('accepts a correct signature', async () => {
    expect(await verifyPaystackSignature(raw, { legacySignature: sign(SECRET_KEY, body) }, { secretKey: SECRET_KEY }, NOW)).toBe('secret-key');
  });

  it('is used when no signing secret is set up, even if Paystack also sent the new header', async () => {
    const h = header(NOW, sign(SIGNING, `${NOW}.${body}`));
    expect(await verifyPaystackSignature(raw, { signature: h, legacySignature: sign(SECRET_KEY, body) }, { secretKey: SECRET_KEY }, NOW)).toBe('secret-key');
  });

  it('rejects a wrong key, a changed body, a malformed value and a missing secret', async () => {
    expect(await verifyPaystackSignature(raw, { legacySignature: sign('sk_test_other', body) }, { secretKey: SECRET_KEY }, NOW)).toBeNull();
    expect(await verifyPaystackSignature(new TextEncoder().encode(body + ' '), { legacySignature: sign(SECRET_KEY, body) }, { secretKey: SECRET_KEY }, NOW)).toBeNull();
    expect(await verifyPaystackSignature(raw, { legacySignature: 'abc' }, { secretKey: SECRET_KEY }, NOW)).toBeNull();
    expect(await verifyPaystackSignature(raw, { legacySignature: sign(SECRET_KEY, body) }, {}, NOW)).toBeNull();
  });

  it('rejects a request with no signature at all', async () => {
    expect(await verifyPaystackSignature(raw, {}, { signingSecret: SIGNING, secretKey: SECRET_KEY }, NOW)).toBeNull();
  });
});
