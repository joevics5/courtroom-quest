// Receives Paystack's webhooks (payments, subscriptions). Public on purpose: Paystack calls it, so it does not use
// a user's login. Every call is checked against Paystack's signature before anything is trusted, and the rules for
// what an event means live in the database (apply_paystack_event).
//
// Secrets to set:  PAYSTACK_SECRET_KEY, PAYSTACK_PRO_PLAN_CODE, and (recommended) PAYSTACK_WEBHOOK_SECRET.

import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyPaystackSignature } from "./signature.ts";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const raw = new Uint8Array(await req.arrayBuffer());
  const verified = await verifyPaystackSignature(
    raw,
    { signature: req.headers.get("paystack-signature"), legacySignature: req.headers.get("x-paystack-signature") },
    { signingSecret: Deno.env.get("PAYSTACK_WEBHOOK_SECRET") ?? undefined, secretKey: Deno.env.get("PAYSTACK_SECRET_KEY") ?? undefined },
  );
  if (!verified) {
    console.error("[paystack-webhook] rejected: signature did not verify");
    return new Response("Invalid signature", { status: 401 });
  }

  let event: { event?: string; data?: unknown };
  try {
    event = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const planCode = Deno.env.get("PAYSTACK_PRO_PLAN_CODE");
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!planCode || !url || !serviceKey) {
    // A 500 makes Paystack deliver the event again later, once this is configured.
    console.error("[paystack-webhook] not configured: PAYSTACK_PRO_PLAN_CODE is missing");
    return new Response("Not configured", { status: 500 });
  }

  const admin = createClient(url, serviceKey);
  const { data, error } = await admin.rpc("apply_paystack_event", { p_event: event, p_pro_plan_code: planCode });
  if (error) {
    // Also a 500, so Paystack retries (the database side ignores repeats safely).
    console.error(`[paystack-webhook] ${event.event} failed: ${error.message}`);
    return new Response("Could not process the event", { status: 500 });
  }

  const result = (data ?? {}) as { handled?: boolean; note?: string };
  console.log(`[paystack-webhook] ${event.event}: ${result.handled ? "handled" : "not applied"}${result.note ? ` (${result.note})` : ""}`);
  return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "Content-Type": "application/json" } });
});
