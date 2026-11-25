// Gives a Pro player Paystack's page for managing their subscription (update the card, cancel).
// Secret to set: PAYSTACK_SECRET_KEY (and optionally ALLOWED_ORIGINS).

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

    const secretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!secretKey) return reply({ error: "Payments are not set up yet." }, 503);

    // Only the player's own subscription (row level security limits this to them).
    const { data: sub } = await client
      .from("subscriptions")
      .select("provider_subscription_id")
      .eq("user_id", u.user.id)
      .eq("provider", "paystack")
      .maybeSingle();
    if (!sub?.provider_subscription_id) return reply({ error: "no_subscription" }, 404);

    const res = await fetch(`https://api.paystack.co/subscription/${encodeURIComponent(sub.provider_subscription_id)}/manage/link`, {
      headers: { Authorization: `Bearer ${secretKey}` },
      signal: AbortSignal.timeout(15_000),
    });
    const body = await res.json();
    if (!res.ok || !body?.data?.link) {
      console.error(`[paystack-manage] could not get the link (HTTP ${res.status})`);
      return reply({ error: "Could not open the subscription page. Please try again." }, 502);
    }
    return reply({ url: body.data.link });
  } catch (err) {
    console.error("[paystack-manage]", err instanceof Error ? err.message : "unknown");
    return reply({ error: "Could not open the subscription page. Please try again." }, 500);
  }
});
