import type { Juror, Verdict, JuryVerdict } from './types';
import { callAI } from './aiAdapter';

function jurorPrompt({
  juror,
  trialSummary,
  round,
}: {
  juror: Juror;
  trialSummary: string;
  round: number;
}): string {
  return `
You are serving as a juror in a criminal trial.

Juror profile:
Age: ${juror.age}
Occupation: ${juror.occupation}
Background: ${juror.background}

Round: ${round} of 3

You must decide based ONLY on:
- evidence presented
- witness testimony
- arguments from both sides

Trial summary:
${trialSummary}

Respond with ONLY ONE WORD:
GUILTY or NOT_GUILTY

No explanation. No other text.
`;
}

export async function runJuryDeliberation({
  jurors,
  trialSummary,
}: {
  jurors: Juror[];
  trialSummary: string;
}): Promise<JuryVerdict> {
  const rounds = 3;
  const voteHistory: Record<number, Verdict[]> = {};

  for (let round = 1; round <= rounds; round++) {
    for (const juror of jurors) {
      try {
        const response = await callAI({
          system: jurorPrompt({ juror, trialSummary, round }),
          user: '',
          maxTokens: 50000, // Up to 50,000 tokens for comprehensive jury deliberations
        });

        const vote = response.trim().toUpperCase().includes('GUILTY') ? 'GUILTY' : 'NOT_GUILTY';

        if (!voteHistory[juror.id]) {
          voteHistory[juror.id] = [];
        }

        voteHistory[juror.id].push(vote);
        juror.vote = vote;
      } catch (error) {
        console.error(`Juror ${juror.id} vote failed:`, error);
        const fallbackVote: Verdict = Math.random() > 0.5 ? 'NOT_GUILTY' : 'GUILTY';
        if (!voteHistory[juror.id]) {
          voteHistory[juror.id] = [];
        }
        voteHistory[juror.id].push(fallbackVote);
        juror.vote = fallbackVote;
      }
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return tallyVerdict(jurors, voteHistory);
}

function tallyVerdict(
  jurors: Juror[],
  voteHistory: Record<number, Verdict[]>
): JuryVerdict {
  const finalVotes = jurors.map(j => j.vote || 'NOT_GUILTY');

  const guilty = finalVotes.filter(v => v === 'GUILTY').length;
  const notGuilty = finalVotes.filter(v => v === 'NOT_GUILTY').length;

  const unanimous = guilty === 12 || notGuilty === 12;

  return {
    verdict: guilty > notGuilty ? 'GUILTY' : 'NOT_GUILTY',
    guiltyVotes: guilty,
    notGuiltyVotes: notGuilty,
    unanimous,
    voteHistory,
  };
}

export function judgeReadsVerdict(result: JuryVerdict): string {
  if (result.unanimous) {
    return `Members of the jury have reached a unanimous verdict. The defendant is found ${result.verdict}.`;
  }

  return `Members of the jury have reached a majority verdict. By a vote of ${result.guiltyVotes} to ${result.notGuiltyVotes}, the defendant is found ${result.verdict}.`;
}
