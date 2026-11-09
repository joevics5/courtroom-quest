/**
 * The written decision that goes with a verdict. When the AI's write-up is missing or thin (a failed call,
 * a reply cut short) the player must still get a real explanation, so one is built from what is certain:
 * how the jurors voted and the reasons they gave on the final ballot.
 */
import type { JuryDeliberationResult } from './trialAI';

/** A decision shorter than this is treated as "not really written". */
export const MIN_WRITEUP_CHARS = 700;

export const isThinWriteup = (text: string | null | undefined) => (text ?? '').trim().length < MIN_WRITEUP_CHARS;

const verdictWord = (outcome: 'win' | 'lose' | 'partial') => (outcome === 'win' ? 'guilty' : outcome === 'lose' ? 'not guilty' : 'undecided');

/**
 * Pulls the "reasoning" text out of a reply whose JSON could not be parsed (long answers often contain raw
 * line breaks or get cut off), so a good write-up is not thrown away for a formatting slip.
 */
export function extractLooseReasoning(raw: string): string | null {
  const start = raw.search(/"reasoning"\s*:\s*"/);
  if (start < 0) return null;
  const open = raw.indexOf('"', raw.indexOf(':', start) + 1) + 1;
  let out = '';
  for (let i = open; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '\\' && i + 1 < raw.length) {
      const next = raw[i + 1];
      out += next === 'n' ? '\n' : next === 't' ? ' ' : next;
      i++;
    } else if (ch === '"') {
      // the closing quote of the field: the next thing is a comma / brace, not more prose
      if (/^\s*[,}]/.test(raw.slice(i + 1, i + 6))) break;
      out += ch;
    } else {
      out += ch;
    }
  }
  const text = out.trim();
  return text.length > 0 ? text : null;
}

interface ComposeInput {
  juryResult: JuryDeliberationResult;
  caseTitle: string;
  defendantName?: string;
  evidenceCited?: string[];
}

/** A full written decision for a jury verdict, from the votes and the reasons the jurors gave. */
export function composeJuryWriteup({ juryResult, caseTitle, defendantName, evidenceCited = [] }: ComposeInput): string {
  const { guiltyVotes, notGuiltyVotes, unanimous, outcome, rounds } = juryResult;
  const who = defendantName ? defendantName : 'the defendant';
  const word = verdictWord(outcome);
  const total = guiltyVotes + notGuiltyVotes;
  const final = rounds[rounds.length - 1];
  const majorityVote = outcome === 'win' ? 'GUILTY' : 'NOT_GUILTY';
  const withReasons = (final?.votes ?? []).filter(v => v.reason && v.reason.trim());
  const majority = withReasons.filter(v => v.vote === majorityVote).slice(0, 4);
  const dissent = withReasons.filter(v => v.vote !== majorityVote).slice(0, 3);
  const dissentCount = outcome === 'win' ? notGuiltyVotes : guiltyVotes;

  const paras: string[] = [];
  paras.push(
    `In the matter of ${caseTitle}, the jury finds ${who} ${word}${unanimous ? ', and the verdict is unanimous' : ` by a vote of ${Math.max(guiltyVotes, notGuiltyVotes)} to ${Math.min(guiltyVotes, notGuiltyVotes)}`}. ` +
    `The ${total || 12} jurors heard the testimony, examined the exhibits and deliberated${rounds.length > 1 ? ` through ${rounds.length} rounds of voting` : ''} before reaching this decision. ` +
    (outcome === 'win'
      ? 'A majority was convinced that the prosecution proved its case beyond a reasonable doubt.'
      : 'A majority was not convinced that the prosecution proved its case beyond a reasonable doubt, and under that standard the defendant must be acquitted.')
  );

  if (majority.length > 0) {
    paras.push(
      `What decided it for the majority: ` +
      majority.map(v => `${v.name}${v.occupation ? `, a ${v.occupation.toLowerCase()},` : ''} explained, "${v.reason.trim().replace(/"/g, "'")}"`).join(' ')
    );
  }

  if (!unanimous && dissentCount > 0) {
    paras.push(
      `${dissentCount} juror${dissentCount === 1 ? '' : 's'} disagreed and voted ${outcome === 'win' ? 'not guilty' : 'guilty'}. ` +
      (dissent.length > 0
        ? dissent.map(v => `${v.name} held that "${v.reason.trim().replace(/"/g, "'")}"`).join(' ')
        : 'Their doubts are part of the record, but they were outweighed by the rest of the jury.')
    );
  }

  paras.push(
    evidenceCited.length > 0
      ? `The exhibits the jury weighed were: ${evidenceCited.join(', ')}. Only testimony and admitted evidence counted as proof; the attorneys' statements and questions were argument.`
      : 'No exhibit was formally admitted, so the decision rested on witness testimony alone. The attorneys\' statements and questions were argument, not proof.'
  );

  paras.push(
    outcome === 'win'
      ? 'The jury\'s decision is a finding that the story the prosecution told held together better than the doubts raised against it.'
      : 'The jury\'s decision is a finding that the doubts raised were real enough that a conviction would not be safe.'
  );
  return paras.join('\n\n');
}
