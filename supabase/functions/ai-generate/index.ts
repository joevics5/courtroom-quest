// Edge function for AI generation.
// Holds the Gemini API key server-side. The frontend NEVER talks to
// Google directly — it calls this function via supabase.functions.invoke().

import { createClient } from "npm:@supabase/supabase-js@2";

// Optional: set ALLOWED_ORIGINS (comma separated, e.g. "https://courtroom-quest.vercel.app")
// as a Supabase secret to lock browsers to your site. Unset = any origin.
// Real protection is the sign-in + per-user quota below, not CORS.
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

const MAX_SYSTEM_CHARS = 30_000;
const MAX_USER_CHARS = 60_000;
// The game asks for up to 50,000 as a "no artificial ceiling" value; real replies are far shorter. 16k caps worst-case cost per call.
const MAX_OUTPUT_TOKENS = 16_000;

interface AIRequest {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: "text" | "json";
}

// gemini-2.0-flash was retired by Google in 2026 — removed.
const FALLBACK_MODELS = ["gemini-3.1-flash-lite", "gemini-3-flash-preview"];

Deno.serve(async (req: Request) => {
  const corsHeaders = corsFor(req);
  const reply = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") return reply({ error: "Method not allowed", text: "" }, 405);

  try {
    // 1. Must be a real signed-in user (guests are anonymous sign-ins; the public anon key alone is not enough).
    const auth = req.headers.get("Authorization");
    if (!auth) return reply({ error: "Not signed in", text: "" }, 401);
    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u, error: uErr } = await client.auth.getUser();
    if (uErr || !u?.user) return reply({ error: "Not signed in", text: "" }, 401);

    // 2. Per-user rate limit.
    const { data: quota, error: qErr } = await client.rpc("consume_ai_quota");
    if (qErr) return reply({ error: "Could not check your usage limit. Please try again.", text: "" }, 500);
    if (quota === "minute") return reply({ error: "Slow down a little and try again in a moment.", text: "" }, 429);
    if (quota === "day") return reply({ error: "Daily AI limit reached. Please try again tomorrow.", text: "" }, 429);
    if (quota !== "ok") return reply({ error: "Not signed in", text: "" }, 401);

    // 3. Validate and clamp the input.
    const body = (await req.json()) as Partial<AIRequest>;
    const system = typeof body.system === "string" ? body.system : "";
    const user = typeof body.user === "string" ? body.user : "";
    const responseFormat = body.responseFormat === "json" ? "json" : "text";
    if (!system && !user) return reply({ error: "Empty request", text: "" }, 400);
    if (system.length > MAX_SYSTEM_CHARS || user.length > MAX_USER_CHARS) {
      return reply({ error: "Request too large", text: "" }, 413);
    }
    const maxTokens = Math.min(Math.max(Number(body.maxTokens) || 2048, 1), MAX_OUTPUT_TOKENS);
    const temperature = Math.min(Math.max(Number(body.temperature ?? 0.7), 0), 1.5);

    const geminiKey = Deno.env.get("GEMINI_API_KEY");

    if (!geminiKey) {
      return new Response(
        JSON.stringify({
          error: "AI provider not configured. Set GEMINI_API_KEY as a Supabase secret.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = system ? `${system}\n\n${user || "Continue"}` : user || "";

    let lastError: string | null = null;

    // Gemini preview models sometimes hang for a minute or more before answering 503. Give each model
    // a bounded time so the next fallback takes over quickly; the last model gets the most patience.
    // Short replies (examiner moves, witness answers) are cut off sooner than long statements.
    const baseTimeoutMs = maxTokens <= 1000 ? 12_000 : 25_000;

    for (let i = 0; i < FALLBACK_MODELS.length; i++) {
      const model = FALLBACK_MODELS[i];
      const isLast = i === FALLBACK_MODELS.length - 1;
      try {
        console.log(`[ai-generate] attempting model: ${model}`);
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: AbortSignal.timeout(isLast ? baseTimeoutMs * 2 : baseTimeoutMs),
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature,
                maxOutputTokens: maxTokens,
              },
            }),
          }
        );

        console.log(`[ai-generate] ${model} responded with status ${response.status}`);

        if (!response.ok) {
          const errText = await response.text();
          console.error(`[ai-generate] ${model} error body: ${errText}`);
          lastError = `${model} (HTTP ${response.status}): ${errText}`;
          continue; // try next fallback model
        }

        const data = await response.json();
        let text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

        if (!text) {
          lastError = `${model}: empty response`;
          continue;
        }

        if (responseFormat === "json") {
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) text = jsonMatch[0];
        }

        return new Response(
          JSON.stringify({ text: text.trim(), content: text.trim(), metadata: { model } }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (err) {
        const timedOut = err instanceof DOMException && (err.name === "TimeoutError" || err.name === "AbortError");
        lastError = `${model}: ${timedOut ? "timed out" : err instanceof Error ? err.message : String(err)}`;
        console.error(`[ai-generate] ${lastError}`);
        continue;
      }
    }

    throw new Error(`All Gemini models failed. Last error: ${lastError}`);
  } catch (error) {
    console.error("AI generation error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "AI generation failed",
        text: "",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
