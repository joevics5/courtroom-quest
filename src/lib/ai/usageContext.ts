/**
 * Which game the AI calls being made right now belong to, so the server can add up what a trial costs.
 * Set when a game is opened and cleared when it is left. It is only used for cost tracking.
 */
let current: { sessionId: string; trialDuration: number } | null = null;

export function setAiUsageContext(context: { sessionId: string; trialDuration: number } | null): void {
  current = context;
}

export function getAiUsageContext(): { sessionId: string; trialDuration: number } | null {
  return current;
}
