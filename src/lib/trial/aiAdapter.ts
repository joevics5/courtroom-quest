export interface AIRequest {
  system: string;
  user: string;
  maxTokens?: number;
}

export async function callAI({ system, user, maxTokens = 300 }: AIRequest): Promise<string> {
  try {
    const response = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        system,
        user,
        maxTokens,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI request failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.text || data.content || '';
  } catch (error) {
    console.error('AI call failed:', error);
    throw error;
  }
}
