// Edge function for AI generation.
// Holds the Gemini API key server-side. The frontend NEVER talks to
// Google directly — it calls this function via supabase.functions.invoke().

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AIRequest {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: "text" | "json";
}

// gemini-2.0-flash was retired by Google in 2026 — removed from this list.
// gemini-2.5-flash and gemini-2.5-flash-lite are current as of the last check.
const FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const {
      system,
      user,
      maxTokens = 2048,
      temperature = 0.7,
      responseFormat,
    }: AIRequest = await req.json();

    const geminiKey = Deno.env.get("GEMINI_API_KEY");

    if (!geminiKey) {
      return new Response(
        JSON.stringify({
          error: "AI provider not configured. Set GEMINI_API_KEY as a Supabase secret.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[ai-generate] geminiKey present: ${!!geminiKey}, length: ${geminiKey?.length ?? 0}`);

    const prompt = system ? `${system}\n\n${user || "Continue"}` : user || "";

    let lastError: string | null = null;

    for (const model of FALLBACK_MODELS) {
      try {
        console.log(`[ai-generate] attempting model: ${model}`);
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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
        lastError = `${model}: ${err instanceof Error ? err.message : String(err)}`;
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
