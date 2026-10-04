import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Gavel, PenLine, ShieldCheck, Sparkles, Users, X } from 'lucide-react';

interface Props {
  onClose: () => void;
}

const step = 'flex gap-3';
const num = 'flex-none w-6 h-6 rounded-full bg-[#FFD43B] text-black text-xs font-black flex items-center justify-center mt-0.5';

/** Explains the My Cases page. Shown once automatically, and any time from the "How does this work?" link. */
export default function CustomCasesIntro({ onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; // don't scroll the page behind the popup
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black/80 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog" aria-modal="true" aria-labelledby="custom-intro-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-slate-900 border border-white/20 shadow-2xl"
      >
        <div className="sticky top-0 flex items-start justify-between gap-3 bg-slate-900 border-b border-white/10 px-5 py-4">
          <div>
            <h2 id="custom-intro-title" className="text-lg font-black text-white tracking-wide">Welcome to My Cases</h2>
            <p className="text-sm text-slate-300 mt-0.5">Your own private cases, played like any case on the Case Board.</p>
          </div>
          <button ref={closeRef} onClick={onClose} aria-label="Close" className="p-1.5 -mr-1 text-slate-300 hover:text-white rounded-lg hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5 text-sm text-slate-200">
          <p>
            Build a case from a real or made-up file, then step into court. Interview the witnesses, go to trial against
            an AI opposing counsel, and find out where the other side is likely to hit you, so you can rehearse before it counts.
          </p>

          <section className="space-y-3">
            <h3 className="text-xs font-black tracking-widest text-[#FFD43B]">HOW IT WORKS</h3>
            <div className={step}><span className={num}>1</span><p><b className="text-white">Create a case.</b> Tap "Create New Custom Case" and choose how to build it (below).</p></div>
            <div className={step}><span className={num}>2</span><p><b className="text-white">Review and edit.</b> Check witnesses, evidence and details, and fix anything. Nothing is saved until you say so.</p></div>
            <div className={step}><span className={num}>3</span><p><b className="text-white">Interview witnesses.</b> Open the saved case, pick your side and question the witnesses. They only know what their details say.</p></div>
            <div className={step}><span className={num}>4</span><p><b className="text-white">Go to trial.</b> Same trial as the Case Board: jury, opening, examination, objections and a verdict.</p></div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-black tracking-widest text-[#FFD43B]">TWO WAYS TO CREATE</h3>
            <div className="rounded-xl border border-[#FFD43B]/40 bg-[#FFD43B]/10 p-3 space-y-1.5">
              <p className="flex items-center gap-2 font-bold text-[#FFD43B]"><Sparkles className="w-4 h-4" /> Parse with AI</p>
              <p>Upload a case-file PDF (up to 10 MB) or paste your notes, and choose the side you will argue. The AI builds the witnesses, evidence and timeline, plus an
                <b className="text-white"> Opposing playbook</b>: where the other side will attack, the questions they could ask, and how you can answer.</p>
              <p className="flex items-start gap-2 text-xs text-slate-300"><FileText className="w-3.5 h-3.5 mt-0.5 flex-none" /> Works best with clear facts, statements, exhibits and dates.</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/5 p-3 space-y-1.5">
              <p className="flex items-center gap-2 font-bold text-white"><PenLine className="w-4 h-4" /> Fill in the form</p>
              <p>Write the case, evidence and witnesses yourself, step by step. You get the same trial either way.</p>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-black tracking-widest text-[#FFD43B]">GOOD TO KNOW</h3>
            <ul className="space-y-2">
              <li className="flex gap-2"><Users className="w-4 h-4 mt-0.5 flex-none text-slate-400" /><span>Your cases are private to you. Use the pencil on a case to edit it later.</span></li>
              <li className="flex gap-2"><Gavel className="w-4 h-4 mt-0.5 flex-none text-slate-400" /><span>The AI can misread a file. Check what it built against your documents, especially names, dates and quotes.</span></li>
              <li className="flex gap-2"><ShieldCheck className="w-4 h-4 mt-0.5 flex-none text-slate-400" /><span>Uploaded PDFs are read by Google's Gemini AI and deleted from our storage once parsing finishes. Redact client names and anything privileged first. There is a daily limit on AI parsing.</span></li>
            </ul>
          </section>
        </div>

        <div className="sticky bottom-0 bg-slate-900 border-t border-white/10 px-5 py-3">
          <button onClick={onClose} className="w-full bg-[#FFD43B] hover:bg-[#ffdc5e] text-black font-bold py-3 rounded-xl transition-colors">
            Got it
          </button>
          <p className="text-center text-xs text-slate-400 mt-2">You can reopen this any time from "How do custom cases work?"</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
