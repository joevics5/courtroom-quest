# AI Provider System

Gemini is the only model provider in use. All requests go through the
`ai-generate` Supabase edge function (`supabase/functions/ai-generate/index.ts`)
— the client never talks to Google directly, and the API key is never
present in client-side (`VITE_`) env vars or the browser bundle.

## Architecture

```
src/lib/ai/
├── types.ts                     # Core request/response types
├── providerFactory.ts           # Returns the active provider (SupabaseEdgeProvider)
├── trialAI.ts                   # Unified trial AI service (judge/prosecution/witness/verdict)
└── providers/
    ├── base.ts                  # Base provider class
    ├── supabaseEdge.ts          # Calls the ai-generate edge function
    ├── openai.ts                # Unused, kept for reference — not wired up
    └── voice.ts                 # Placeholder, not implemented
```

## Configuration

The Gemini key is a **Supabase secret**, set with:

```
supabase secrets set GEMINI_API_KEY=your-key-here
```

It is read server-side in `supabase/functions/ai-generate/index.ts` via
`Deno.env.get("GEMINI_API_KEY")`. There is no client-side env var for this —
if you ever see `VITE_GEMINI_API_KEY` reintroduced anywhere in `src/`, that's
a regression back to shipping the key in the public bundle. Don't add it.

## Usage

No change to call sites — `trialAI.ts` functions work exactly as before:

```typescript
import {
  generateJudgeOpeningRequest,
  generateProsecutionAction,
  generateWitnessResponse,
  generateJudgeObjectionRuling
} from '@/lib/ai/trialAI';
```

Under the hood, these call `getAIProvider().generate(request)`, which now
resolves to `SupabaseEdgeProvider`, which calls
`supabase.functions.invoke('ai-generate', { body: request })`.

## Adding a new provider

Only do this if the provider call also happens server-side (an edge
function or similar). Never instantiate a model SDK with an API key
directly in a component or a `src/lib/*.ts` file that ships to the browser.
