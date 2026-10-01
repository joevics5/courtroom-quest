// Edge function: AI case generator (admin only).
// Two stages so each call stays within output limits and the admin can retry one half:
//   stage "core"     -> case info, facts, timeline, theories, witnesses
//   stage "analysis" -> evidence, loopholes, red herrings, contradictions, objections, ...
// The Gemini key stays server-side (GEMINI_API_KEY secret).
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  AnalysisSchema, CoreSchema, stripDanglingAnalysis, stripDanglingCore, validateAnalysis, validateCore,
} from "./schema.ts";
import type { Core } from "./schema.ts";
import { ANALYSIS_SYSTEM, CORE_SYSTEM, buildUser } from "./prompts.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const MODELS = (Deno.env.get("GEMINI_CASE_MODELS") ?? "gemini-3-flash-preview,gemini-3.1-flash-lite")
  .split(",").map((s) => s.trim()).filter(Boolean);
const BUDGET_MS = 140_000; // stay under the edge function wall-clock limit
const MAX_STORY = 40_000;

async function requireAdmin(req: Request): Promise<Response | null> {
  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Not signed in" }, 401);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data, error } = await supabase.rpc("is_admin");
  if (error || data !== true) return json({ error: "Admin access required" }, 403);
  return null;
}

async function callGemini(system: string, user: string, timeoutMs: number) {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new Error("GEMINI_API_KEY is not set as a Supabase secret.");
  let lastError = "";
  for (const model of MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(timeoutMs),
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts: [{ text: user }] }],
            generationConfig: { temperature: 0.8, maxOutputTokens: 60000, responseMimeType: "application/json" },
          }),
        },
      );
      if (!res.ok) {
        lastError = `${model} (HTTP ${res.status}): ${(await res.text()).slice(0, 300)}`;
        continue;
      }
      const data = await res.json();
      const cand = data?.candidates?.[0];
      const text: string = (cand?.content?.parts ?? []).map((p: any) => p.text ?? "").join("");
      if (!text) { lastError = `${model}: empty response (${cand?.finishReason ?? "no candidate"})`; continue; }
      return { text, model, finishReason: cand?.finishReason as string | undefined };
    } catch (err) {
      lastError = `${model}: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
  throw new Error(`All Gemini models failed. Last error: ${lastError}`);
}

function parseJson(text: string): unknown {
  let t = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  return JSON.parse(t);
}

async function runStage(stage: "core" | "analysis", story: string, options: Record<string, string>, core?: Core) {
  const started = Date.now();
  const system = stage === "core" ? CORE_SYSTEM : ANALYSIS_SYSTEM;
  let errors: string[] = [];
  let best: { data: any; errors: string[]; model: string } | null = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    const remaining = BUDGET_MS - (Date.now() - started);
    if (attempt > 1 && remaining < 30_000) break;
    const user = buildUser(stage, story, options, core, attempt > 1 ? errors : undefined);
    const { text, model, finishReason } = await callGemini(system, user, Math.min(120_000, remaining));

    let parsed: any;
    try {
      parsed = (stage === "core" ? CoreSchema : AnalysisSchema).parse(parseJson(text));
    } catch (e) {
      errors = [
        finishReason === "MAX_TOKENS"
          ? "Output was cut off. Be more concise: shorter text fields, fewer sample questions."
          : `Output was not valid JSON for the schema: ${e instanceof Error ? e.message.slice(0, 200) : "parse error"}`,
      ];
      continue;
    }
    errors = stage === "core" ? validateCore(parsed) : validateAnalysis(parsed, core!);
    if (!best || errors.length < best.errors.length) best = { data: parsed, errors, model };
    if (errors.length === 0) break;
  }

  if (!best) throw new Error(`Generation failed after retries: ${errors.join("; ")}`);
  if (stage === "core") stripDanglingCore(best.data);
  else stripDanglingAnalysis(best.data, core!);
  return { data: best.data, warnings: best.errors, model: best.model };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  try {
    const denied = await requireAdmin(req);
    if (denied) return denied;

    const body = await req.json();
    const stage = body.stage as "core" | "analysis";
    const story = String(body.story ?? "").trim();
    const options = (body.options ?? {}) as Record<string, string>;
    if (stage !== "core" && stage !== "analysis") return json({ error: "stage must be 'core' or 'analysis'" }, 400);
    if (story.length < 80) return json({ error: "Paste a longer case story (at least a few sentences)." }, 400);
    if (story.length > MAX_STORY) return json({ error: `Story too long (max ${MAX_STORY} characters).` }, 400);

    let core: Core | undefined;
    if (stage === "analysis") {
      const parsed = CoreSchema.safeParse(body.core);
      if (!parsed.success || parsed.data.facts.length === 0) return json({ error: "analysis stage needs the stage 1 result in 'core'" }, 400);
      core = parsed.data;
    }

    const result = await runStage(stage, story, options, core);
    return json(result);
  } catch (error) {
    console.error("generate-case error:", error);
    return json({ error: error instanceof Error ? error.message : "Generation failed" }, 500);
  }
});
