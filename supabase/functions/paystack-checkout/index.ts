// Starts a Pro subscription: asks Paystack for a checkout page for the signed-in player and returns its address.
// The player has to have a real account (an email), because Paystack needs one and the receipt goes there.
//
// Secrets to set:  PAYSTACK_SECRET_KEY, PAYSTACK_PRO_PLAN_CODE, and optionally SITE_URL (where Paystack sends the
// player back to, e.g. https://courtroom-quest.vercel.app) and ALLOWED_ORIGINS.

import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((o) => o.trim()).filter(Boolean);

function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allow = ALLOWED.length === 0 ? "*" : ALLOWED.includes(origin) ? origin : ALLOWED[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
    "Vary": "Origin",
  };
}

Deno.serve(async (req: Request) => {
  const cors = corsFor(req);
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return reply({ error: "Not signed in" }, 401);
    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u, error: uErr } = await client.auth.getUser();
    if (uErr || !u?.user) return reply({ error: "Not signed in" }, 401);
    const user = u.user;
    if (user.is_anonymous || !user.email) return reply({ error: "account_required" }, 403);

    const secretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    const planCode = Deno.env.get("PAYSTACK_PRO_PLAN_CODE");
    if (!secretKey || !planCode) {
      console.error("[paystack-checkout] not configured: PAYSTACK_SECRET_KEY / PAYSTACK_PRO_PLAN_CODE");
      return reply({ error: "Payments are not set up yet." }, 503);
    }

    // Already Pro: do not take a second payment.
    const { data: sub } = await client
      .from("subscriptions")
      .select("status, current_period_end")
      .eq("user_id", user.id)
      .maybeSingle();
    if (sub && ["active", "trialing", "past_due"].includes(sub.status) && (!sub.current_period_end || new Date(sub.current_period_end) > new Date())) {
      return reply({ error: "already_pro" }, 409);
    }

    const paystack = (path: string, init?: RequestInit) =>
      fetch(`https://api.paystack.co${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(15_000),
      });

    // The plan decides the price and currency; Paystack still wants an amount on the transaction.
    const planRes = await paystack(`/plan/${encodeURIComponent(planCode)}`);
    const plan = await planRes.json();
    if (!planRes.ok || !plan?.data?.amount) {
      console.error(`[paystack-checkout] could not read the plan (HTTP ${planRes.status})`);
      return reply({ error: "Could not start the payment. Please try again." }, 502);
    }

    const siteUrl = Deno.env.get("SITE_URL") ?? req.headers.get("Origin") ?? "";
    const initRes = await paystack("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({
        email: user.email,
        amount: plan.data.amount,
        currency: plan.data.currency,
        plan: planCode,
        metadata: { user_id: user.id, purpose: "pro" },
        ...(siteUrl ? { callback_url: `${siteUrl.replace(/\/$/, "")}/?upgrade=success` } : {}),
      }),
    });
    const init = await initRes.json();
    if (!initRes.ok || !init?.data?.authorization_url) {
      console.error(`[paystack-checkout] initialize failed (HTTP ${initRes.status}): ${init?.message ?? "unknown"}`);
      return reply({ error: "Could not start the payment. Please try again." }, 502);
    }
    return reply({ url: init.data.authorization_url, reference: init.data.reference });
  } catch (err) {
    console.error("[paystack-checkout]", err instanceof Error ? err.message : "unknown");
    return reply({ error: "Could not start the payment. Please try again." }, 500);
  }
});
