// Edge function: AI case generator.
//   admin  -> full generator (original behaviour, improve mode)
//   player -> "practice" mode: parses a lawyer's PDF / notes faithfully, rate-limited per user
// Two stages so each call stays within output limits and the admin can retry one half:
//   stage "core"     -> case info, facts, timeline, theories, witnesses
//   stage "analysis" -> evidence, loopholes, red herrings, contradictions, objections, ...
// The Gemini key stays server-side (GEMINI_API_KEY secret).
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  AnalysisSchema, CoreSchema, stripDanglingAnalysis, stripDanglingCore, validateAnalysis, validateCore,
} from "./schema.ts";
import type { Core } from "./schema.ts";
import { analysisSystem, buildUser, coreSystem } from "./prompts.ts";

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
const DOC_BUCKET = "case-documents";
const MAX_DOC_BYTES = 10 * 1024 * 1024;
const STALE_DOC_MS = 6 * 60 * 60 * 1000;

// deno-lint-ignore no-explicit-any
type Caller = { userId: string; isAdmin: boolean; client: any };

async function authorize(req: Request): Promise<Caller | Response> {
  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Not signed in" }, 401);
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: u, error: uErr } = await client.auth.getUser();
  if (uErr || !u?.user) return json({ error: "Not signed in" }, 401);
  const { data: admin } = await client.rpc("is_admin");
  return { userId: u.user.id, isAdmin: admin === true, client };
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Reads the caller's own uploaded PDF. Returns base64 or an error Response. */
async function loadDocument(caller: Caller, path: string): Promise<string | Response> {
  if (!path.startsWith(`${caller.userId}/`) || path.includes("..") || !path.toLowerCase().endsWith(".pdf"))
    return json({ error: "Invalid document path." }, 400);
  const { data, error } = await caller.client.storage.from(DOC_BUCKET).download(path);
  if (error || !data) return json({ error: "Could not read the uploaded PDF. Please upload it again." }, 400);
  if (data.size > MAX_DOC_BYTES) return json({ error: "PDF is too large (max 10 MB)." }, 400);
  const bytes = new Uint8Array(await data.arrayBuffer());
  if (String.fromCharCode(...bytes.subarray(0, 4)) !== "%PDF") return json({ error: "That file is not a valid PDF." }, 400);
  return toBase64(bytes);
}

/** Best effort: remove this user's uploads that were never cleaned up. */
async function sweepOldDocuments(caller: Caller, keep: string | null) {
  try {
    const { data } = await caller.client.storage.from(DOC_BUCKET).list(caller.userId, { limit: 100 });
    const stale = (data ?? [])
      .filter((o: any) => o.created_at && Date.now() - new Date(o.created_at).getTime() > STALE_DOC_MS)
      .map((o: any) => `${caller.userId}/${o.name}`)
      .filter((p: string) => p !== keep);
    if (stale.length) await caller.client.storage.from(DOC_BUCKET).remove(stale);
  } catch (_) { /* ignore */ }
}

async function callGemini(system: string, user: string, timeoutMs: number, pdfBase64?: string) {
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
            contents: [{ role: "user", parts: [...(pdfBase64 ? [{ inlineData: { mimeType: "application/pdf", data: pdfBase64 } }] : []), { text: user }] }],
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

const DIFF_OVERRIDE: Record<string, string> = { easy: "easy", medium: "medium", hard: "hard", expert: "hard" };

async function runStage(
  stage: "core" | "analysis", story: string, options: Record<string, string>, core?: Core,
  existing?: any, instructions?: string, practice = false, pdfBase64?: string,
) {
  const started = Date.now();
  const improving = !!existing;
  const requested = DIFF_OVERRIDE[String(options.difficulty ?? "").toLowerCase()];
  const system = stage === "core"
    ? coreSystem(requested, improving, practice)
    : analysisSystem(core?.case.difficulty ?? requested, improving, practice);
  let errors: string[] = [];
  let best: { data: any; errors: string[]; model: string } | null = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    const remaining = BUDGET_MS - (Date.now() - started);
    if (attempt > 1 && remaining < 30_000) break;
    const user = buildUser(stage, story, options, core, attempt > 1 ? errors : undefined, existing, instructions);
    const { text, model, finishReason } = await callGemini(system, user, Math.min(120_000, remaining), pdfBase64);

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
    if (stage === "core" && requested) parsed.case.difficulty = requested; // the admin's choice wins
    errors = stage === "core" ? validateCore(parsed, improving, practice) : validateAnalysis(parsed, core!, improving, practice);
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
    const caller = await authorize(req);
    if (caller instanceof Response) return caller;

    const body = await req.json();
    const stage = body.stage as "core" | "analysis";
    const story = String(body.story ?? "").trim();
    const options = (body.options ?? {}) as Record<string, string>;
    // Players always get practice mode; admins keep the original generator unless they ask for practice.
    const practice = !caller.isAdmin || body.mode === "practice";
    const docPath = typeof body.document?.path === "string" ? body.document.path : "";
    if (stage !== "core" && stage !== "analysis") return json({ error: "stage must be 'core' or 'analysis'" }, 400);
    if (docPath && !practice) return json({ error: "Documents are only supported in practice mode." }, 400);
    if (!docPath && story.length < 80) return json({ error: "Paste a longer case story (at least a few sentences) or upload a PDF." }, 400);
    if (story.length > MAX_STORY) return json({ error: `Story too long (max ${MAX_STORY} characters).` }, 400);

    let core: Core | undefined;
    if (stage === "analysis") {
      const parsed = CoreSchema.safeParse(body.core);
      if (!parsed.success || parsed.data.facts.length === 0) return json({ error: "analysis stage needs the stage 1 result in 'core'" }, 400);
      core = parsed.data;
    }

    let pdf: string | undefined;
    if (docPath) {
      const doc = await loadDocument(caller, docPath);
      if (doc instanceof Response) return doc;
      pdf = doc;
    }

    if (!caller.isAdmin) {
      const { data: ok, error: qErr } = await caller.client.rpc("consume_case_ai_quota", { p_stage: stage });
      if (qErr) return json({ error: "Could not check your usage limit. Please try again." }, 500);
      if (ok !== true) return json({ error: "Daily AI limit reached. Please try again tomorrow." }, 429);
      await sweepOldDocuments(caller, docPath || null);
    }

    // Improve mode is admin-only (it edits live preset cases).
    const existing = caller.isAdmin && body.existing && typeof body.existing === "object" ? body.existing : undefined;
    const instructions = caller.isAdmin ? String(body.instructions ?? "").slice(0, 4000) : "";
    const result = await runStage(stage, story, options, core, existing, instructions, practice, pdf);

    // The uploaded file is only needed while parsing; delete it once the last stage succeeds.
    if (docPath && stage === "analysis") await caller.client.storage.from(DOC_BUCKET).remove([docPath]).catch(() => undefined);
    return json(result);
  } catch (error) {
    console.error("generate-case error:", error);
    return json({ error: error instanceof Error ? error.message : "Generation failed" }, 500);
  }
});
