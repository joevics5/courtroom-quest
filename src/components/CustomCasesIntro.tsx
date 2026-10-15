import { FileText, Gavel, PenLine, ShieldCheck, Sparkles, Users } from 'lucide-react';
import ModalSheet from './ModalSheet';
import { gameButton } from './ui';

interface Props {
  onClose: () => void;
}

const step = 'flex gap-3';
const num = 'flex-none w-6 h-6 rounded-full bg-[#FFD43B] text-black text-xs font-black flex items-center justify-center mt-0.5';
const heading = 'text-xs font-black tracking-widest text-[#FFD43B]';

/** Explains the My Cases page. Shown once automatically, and any time from the "How does this work?" link. */
export default function CustomCasesIntro({ onClose }: Props) {
  return (
    <ModalSheet
      title="Welcome to My Cases"
      subtitle="Your own private cases, played like any case on the Case Board."
      onClose={onClose}
      maxWidth="max-w-lg"
    >
      <div className="space-y-5 text-sm text-white/85 pt-2">
        <p>
          Build a case from a real or made-up file, then step into court. Interview the witnesses, go to trial against
          an AI opposing counsel, and find out where the other side is likely to hit you, so you can rehearse before it counts.
        </p>

        <section className="space-y-3">
          <h3 className={heading}>HOW IT WORKS</h3>
          <div className={step}><span className={num}>1</span><p><b className="text-white">Create a case.</b> Tap "Create New Custom Case" and choose how to build it (below).</p></div>
          <div className={step}><span className={num}>2</span><p><b className="text-white">Review and edit.</b> Check witnesses, evidence and details, and fix anything. Nothing is saved until you say so.</p></div>
          <div className={step}><span className={num}>3</span><p><b className="text-white">Interview witnesses.</b> Open the saved case, pick your side and question the witnesses. They only know what their details say.</p></div>
          <div className={step}><span className={num}>4</span><p><b className="text-white">Go to trial.</b> Same trial as the Case Board: jury, opening, examination, objections and a verdict.</p></div>
        </section>

        <section className="space-y-3">
          <h3 className={heading}>TWO WAYS TO CREATE</h3>
          <div className="rounded-2xl border border-[#FFD43B]/40 bg-[#FFD43B]/10 p-3 space-y-1.5">
            <p className="flex items-center gap-2 font-bold text-[#FFD43B]"><Sparkles className="w-4 h-4" /> Parse with AI</p>
            <p>Upload a case-file PDF (up to 10 MB) or paste your notes, and choose the side you will argue. The AI builds the witnesses, evidence and timeline, plus an
              <b className="text-white"> Opposing playbook</b>: where the other side will attack, the questions they could ask, and how you can answer.</p>
            <p className="flex items-start gap-2 text-xs text-white/60"><FileText className="w-3.5 h-3.5 mt-0.5 flex-none" /> Works best with clear facts, statements, exhibits and dates.</p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/5 p-3 space-y-1.5">
            <p className="flex items-center gap-2 font-bold text-white"><PenLine className="w-4 h-4" /> Fill in the form</p>
            <p>Write the case, evidence and witnesses yourself, step by step. You get the same trial either way.</p>
          </div>
        </section>

        <section className="space-y-2">
          <h3 className={heading}>GOOD TO KNOW</h3>
          <ul className="space-y-2">
            <li className="flex gap-2"><Users className="w-4 h-4 mt-0.5 flex-none text-white/45" /><span>Your cases are private to you. Use the pencil on a case to edit it later.</span></li>
            <li className="flex gap-2"><Gavel className="w-4 h-4 mt-0.5 flex-none text-white/45" /><span>The AI can misread a file. Check what it built against your documents, especially names, dates and quotes.</span></li>
            <li className="flex gap-2"><ShieldCheck className="w-4 h-4 mt-0.5 flex-none text-white/45" /><span>Uploaded PDFs are read by Google's Gemini AI and deleted from our storage once parsing finishes. Redact client names and anything privileged first. There is a daily limit on AI parsing.</span></li>
          </ul>
        </section>

        <div>
          <button onClick={onClose} className={`w-full ${gameButton('gold', 'md')}`}>Got it</button>
          <p className="text-center text-xs text-white/45 mt-2">You can reopen this any time from "How do custom cases work?"</p>
        </div>
      </div>
    </ModalSheet>
  );
}
