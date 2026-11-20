/*
  # Measure what a trial costs in AI calls

  The ai-generate edge function now records the tokens each call used (Gemini reports them), tagged with the
  game it belongs to and that game's trial length. Only the function writes to the log (it uses the service
  role); the tables and views are closed to the app's users.

  - ai_usage_log           one row per AI call: model, input tokens, output tokens, thinking tokens
  - ai_trial_cost_report   per trial length, over finished trials: how many, calls, tokens and cost per trial
  - ai_cost_by_call_type   per trial length and kind of call (judge, witness, counsel...): where the cost goes

  Cost uses Google's list prices per million tokens: gemini-3.1-flash-lite $0.25 in / $1.50 out and
  gemini-3-flash-preview $0.50 in / $3.00 out. Output includes thinking tokens, which are billed as output.
  Change the two rates in the views if Google's prices change.
*/

CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id uuid REFERENCES public.case_sessions(id) ON DELETE SET NULL,
  trial_duration smallint,
  kind text,
  model text NOT NULL,
  prompt_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  thought_tokens integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS ai_usage_log_session ON public.ai_usage_log (session_id);
CREATE INDEX IF NOT EXISTS ai_usage_log_created ON public.ai_usage_log (created_at DESC);

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_usage_log FROM anon, authenticated;
-- No policies: the app's users can neither read nor write it. The edge function writes with the service role.

CREATE OR REPLACE VIEW public.ai_trial_cost_report AS
WITH per_session AS (
  SELECT l.session_id,
         max(l.trial_duration) AS trial_duration,
         count(*) AS calls,
         sum(l.prompt_tokens) AS input_tokens,
         sum(l.output_tokens + l.thought_tokens) AS output_tokens,
         sum(l.prompt_tokens * CASE WHEN l.model LIKE 'gemini-3-flash%' THEN 0.50 ELSE 0.25 END
             + (l.output_tokens + l.thought_tokens) * CASE WHEN l.model LIKE 'gemini-3-flash%' THEN 3.00 ELSE 1.50 END) / 1000000.0 AS cost_usd
  FROM public.ai_usage_log l
  JOIN public.case_sessions s ON s.id = l.session_id
  WHERE s.completed_at IS NOT NULL
  GROUP BY l.session_id
)
SELECT trial_duration,
       count(*) AS finished_trials,
       round(avg(calls), 1) AS avg_calls,
       round(avg(input_tokens)) AS avg_input_tokens,
       round(avg(output_tokens)) AS avg_output_tokens,
       round(avg(cost_usd)::numeric, 4) AS avg_cost_usd,
       round(max(cost_usd)::numeric, 4) AS max_cost_usd
FROM per_session
GROUP BY trial_duration
ORDER BY trial_duration;

CREATE OR REPLACE VIEW public.ai_cost_by_call_type AS
SELECT l.trial_duration,
       l.kind,
       count(*) AS calls,
       round(avg(l.prompt_tokens)) AS avg_input_tokens,
       round(avg(l.output_tokens + l.thought_tokens)) AS avg_output_tokens,
       round((sum(l.prompt_tokens * CASE WHEN l.model LIKE 'gemini-3-flash%' THEN 0.50 ELSE 0.25 END
             + (l.output_tokens + l.thought_tokens) * CASE WHEN l.model LIKE 'gemini-3-flash%' THEN 3.00 ELSE 1.50 END) / 1000000.0)::numeric, 4) AS total_cost_usd
FROM public.ai_usage_log l
GROUP BY l.trial_duration, l.kind
ORDER BY total_cost_usd DESC;

REVOKE ALL ON public.ai_trial_cost_report FROM anon, authenticated;
REVOKE ALL ON public.ai_cost_by_call_type FROM anon, authenticated;
