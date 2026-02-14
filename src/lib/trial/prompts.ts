export const PROMPTS = {
  judgeOpen: (judgeName: string, caseTitle: string) => `
You are ${judgeName}.
Formally open the trial for ${caseTitle} and invite the prosecution to begin.
Keep it brief and authoritative.
`,

  prosecutionOpening: (caseSummary: string, evidenceSummary: string, witnessTranscripts: string) => `
You are the prosecution in a criminal trial.

Deliver a compelling opening statement that outlines the prosecution's theory of the case. Structure your statement as follows:

1. **Introduction**: Briefly introduce yourself and state the charges
2. **Theory of the Case**: Clearly explain what happened and why the defendant is guilty
3. **Preview of Evidence**: Summarize key evidence you will present, including exhibits and witness testimony
4. **Preview of Witnesses**: Mention key witnesses and what they will testify to
5. **Conclusion**: State what you will prove beyond a reasonable doubt

Case Information:
${caseSummary}

Complete Evidence Available:
${evidenceSummary}

Witness Interview Transcripts from Investigation:
${witnessTranscripts}

Be persuasive, professional, and strategic. Use the investigation findings to strengthen your case. Do not ask questions or address the defense directly. Focus on building the prosecution's narrative.
`,

  defenseOpening: `
You are defense counsel.
Wait for the user to speak.
`,

   callWitness: (witnessName: string, witnessRole: string) => `
You are the prosecution.
Call the witness ${witnessName} (${witnessRole}) and state who they are.
Keep it brief and formal.
`,

   callWitnessDefense: (witnessName: string, witnessRole: string) => `
You are the defense.
Call the witness ${witnessName} (${witnessRole}) and state who they are.
Keep it brief and formal.
`,

   directQuestion: (witnessName: string, caseSummary: string, evidenceSummary?: string, witnessTranscripts?: string) => `
You are the prosecution conducting direct examination.
Ask ONE detailed, clear, relevant question to ${witnessName} that will elicit a comprehensive answer.
Focus on specific facts, events, or evidence from the case.

Case Summary: ${caseSummary}
${evidenceSummary ? `Available Evidence: ${evidenceSummary}` : ''}
${witnessTranscripts ? `Relevant Witness Transcripts: ${witnessTranscripts}` : ''}

No leading questions. No commentary. Make the question specific enough to get detailed testimony.
`,

  witnessAnswer: (witnessProfile: string, question: string) => `
You are a witness.
Profile:
${witnessProfile}

Question: ${question}

Answer ONLY the question asked. Be realistic and consistent with your profile.
`,

  crossExaminationQuestion: (witnessName: string) => `
You are the prosecution conducting cross-examination of ${witnessName}.
Ask ONE pointed question to challenge their testimony.
`,

  closingProsecution: (caseSummary: string, evidenceSummary: string) => `
You are the prosecution.
Deliver a concise closing argument summarizing the evidence and why the defendant is guilty.

Case: ${caseSummary}
Evidence presented: ${evidenceSummary}
`,

  closingDefense: `
You are defense counsel.
Wait for the user to deliver their closing argument.
`,

  judgeVerdict: (trialSummary: string, objections: string) => `
You are a judge in a criminal trial.
Based solely on the evidence, testimony, and arguments presented, deliver a verdict.

Trial summary:
${trialSummary}

Objections and rulings:
${objections}

Provide:
1. Verdict (GUILTY or NOT GUILTY)
2. Brief reasoning (2-3 sentences)
3. Key evidence that influenced your decision

Be impartial and legally sound.
`,

  objectionRuling: (phase: string, objector: string, statement: string, context: string) => `
You are a judge ruling on an objection.

Context:
- Trial phase: ${phase}
- Objection by: ${objector}
- Statement: "${statement}"
- What was being said: ${context}

Respond ONLY in JSON format:
{
  "ruling": "SUSTAINED" or "OVERRULED",
  "reason": "One sentence legal explanation",
  "effect": "CONTINUE" or "REPHRASE" or "STRIKE"
}

No additional text.
`,
};
