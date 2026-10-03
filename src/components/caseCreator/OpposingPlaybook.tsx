import { ShieldAlert, Swords, Gavel, FileWarning, MessageCircleWarning } from 'lucide-react';
import type { Playbook } from '../../lib/caseCreator/playbook';
import { sideLabel } from '../../lib/caseCreator/playbook';

const card = 'rounded-lg border border-white/15 bg-black/30 p-3 space-y-2';
const h = 'flex items-center gap-2 text-sm font-semibold text-[#FFD43B]';

function Section({ icon, title, hint, children }: { icon: React.ReactNode; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className={h}>{icon}{title}</h3>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
      {children}
    </section>
  );
}

/** Read-only briefing: where the other side will attack and how to prepare. */
export default function OpposingPlaybook({ playbook }: { playbook: Playbook }) {
  const p = playbook;
  if (p.isEmpty) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-4 text-sm text-amber-200">
        The AI did not find specific attack lines for the {sideLabel(p.opponent)} in this file. Check the Analysis tab, or add more detail to your notes and regenerate.
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-300">
        You argue the <b className="text-white">{sideLabel(p.userSide)}</b>. This is what the <b className="text-white">{sideLabel(p.opponent)}</b> is likely to
        do with the file. It is the AI's reading of your documents, so check it against the file before relying on it.
      </p>

      {p.attacks.length > 0 && (
        <Section icon={<Swords className="w-4 h-4" />} title={`Where they will hit (${p.attacks.length})`} hint="Subtler lines are listed first.">
          {p.attacks.map((a, i) => (
            <div key={i} className={card}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-white text-sm font-medium">{a.title}</p>
                {a.hardToSpot && <span className="shrink-0 text-[10px] uppercase tracking-wide rounded bg-red-500/20 text-red-300 px-1.5 py-0.5">subtle</span>}
              </div>
              {a.kind && <p className="text-xs text-slate-400 capitalize">{a.kind}</p>}
              {a.how && <p className="text-sm text-slate-200"><span className="text-slate-400">How they put it: </span>{a.how}</p>}
              {a.involves.length > 0 && <p className="text-xs text-slate-400">Involves: {a.involves.join(', ')}</p>}
              {a.questions.length > 0 && (
                <ul className="text-sm text-slate-200 list-disc pl-5 space-y-0.5">
                  {a.questions.map((q, j) => <li key={j}>{q}</li>)}
                </ul>
              )}
              {a.yourAnswer && (
                <p className="text-sm text-green-200 border-l-2 border-green-500/60 pl-3"><span className="text-green-300 font-medium">Your answer: </span>{a.yourAnswer}</p>
              )}
            </div>
          ))}
        </Section>
      )}

      {(p.weakPoints.length > 0 || p.exploitableFacts.length > 0) && (
        <Section icon={<ShieldAlert className="w-4 h-4" />} title="Weak points in your own theory">
          <div className={card}>
            <ul className="text-sm text-slate-200 list-disc pl-5 space-y-1">
              {p.weakPoints.map((w, i) => <li key={`w${i}`}>{w}</li>)}
              {p.exploitableFacts.map((w, i) => <li key={`f${i}`}><span className="text-slate-400">Fact they can use: </span>{w}</li>)}
            </ul>
          </div>
        </Section>
      )}

      {p.contradictions.length > 0 && (
        <Section icon={<FileWarning className="w-4 h-4" />} title="Contradictions that hurt you">
          {p.contradictions.map((c, i) => (
            <div key={i} className={card}>
              <p className="text-sm text-slate-200">{c.a}</p>
              <p className="text-xs text-slate-500">vs.</p>
              <p className="text-sm text-slate-200">{c.b}</p>
              {c.impact && <p className="text-xs text-slate-400">Impact: {c.impact}</p>}
              {c.found && <p className="text-xs text-slate-400">How it surfaces: {c.found}</p>}
            </div>
          ))}
        </Section>
      )}

      {p.exhibitsAtRisk.length > 0 && (
        <Section icon={<FileWarning className="w-4 h-4" />} title="Exhibits they will challenge">
          {p.exhibitsAtRisk.map((e, i) => (
            <div key={i} className={card}>
              <p className="text-sm text-white font-medium">{e.title}</p>
              {e.theirReading && <p className="text-sm text-slate-200"><span className="text-slate-400">Their reading: </span>{e.theirReading}</p>}
              {e.challenges.length > 0 && (
                <ul className="text-sm text-slate-300 list-disc pl-5">{e.challenges.map((c, j) => <li key={j}>{c}</li>)}</ul>
              )}
            </div>
          ))}
        </Section>
      )}

      {p.backfireQuestions.length > 0 && (
        <Section icon={<MessageCircleWarning className="w-4 h-4" />} title="Questions that could backfire" hint="Asking these of your own or their witnesses may help the other side.">
          {p.backfireQuestions.map((w, i) => (
            <div key={i} className={card}>
              <p className="text-sm text-white font-medium">{w.witness}</p>
              <ul className="text-sm text-slate-300 list-disc pl-5">{w.questions.map((q, j) => <li key={j}>{q}</li>)}</ul>
            </div>
          ))}
        </Section>
      )}

      {p.objections.length > 0 && (
        <Section icon={<Gavel className="w-4 h-4" />} title="Objections to expect">
          <div className={card}>
            <ul className="text-sm text-slate-200 space-y-1.5">
              {p.objections.map((o, i) => (
                <li key={i}><span className="capitalize font-medium text-white">{o.type || 'Objection'}</span>{o.example && <> — {o.example}</>}{o.ruling && <span className="text-slate-400"> (likely: {o.ruling})</span>}</li>
              ))}
            </ul>
          </div>
        </Section>
      )}

      {p.legalIssues.length > 0 && (
        <Section icon={<Gavel className="w-4 h-4" />} title="Legal issues in their favour">
          <div className={card}>
            <ul className="text-sm text-slate-200 space-y-1.5">
              {p.legalIssues.map((l, i) => <li key={i}><span className="font-medium text-white">{l.issue}</span>{l.why && <> — {l.why}</>}</li>)}
            </ul>
          </div>
        </Section>
      )}
    </div>
  );
}
