import { FileText, Gavel, PenLine, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  return (
    <ModalSheet
      title={t('customIntro.title')}
      subtitle={t('customIntro.sub')}
      onClose={onClose}
      maxWidth="max-w-lg"
    >
      <div className="space-y-5 text-sm text-white/85 pt-2">
        <p>{t('customIntro.intro')}</p>

        <section className="space-y-3">
          <h3 className={heading}>{t('customIntro.how')}</h3>
          <div className={step}><span className={num}>1</span><p><Trans i18nKey="customIntro.step1" components={{ b: <b className="text-white" /> }} /></p></div>
          <div className={step}><span className={num}>2</span><p><Trans i18nKey="customIntro.step2" components={{ b: <b className="text-white" /> }} /></p></div>
          <div className={step}><span className={num}>3</span><p><Trans i18nKey="customIntro.step3" components={{ b: <b className="text-white" /> }} /></p></div>
          <div className={step}><span className={num}>4</span><p><Trans i18nKey="customIntro.step4" components={{ b: <b className="text-white" /> }} /></p></div>
        </section>

        <section className="space-y-3">
          <h3 className={heading}>{t('customIntro.two')}</h3>
          <div className="rounded-2xl border border-[#FFD43B]/40 bg-[#FFD43B]/10 p-3 space-y-1.5">
            <p className="flex items-center gap-2 font-bold text-[#FFD43B]"><Sparkles className="w-4 h-4" /> {t('customIntro.fromFile')}</p>
            <p><Trans i18nKey="customIntro.fromFileBody" components={{ b: <b className="text-white" /> }} /></p>
            <p className="flex items-start gap-2 text-xs text-white/60"><FileText className="w-3.5 h-3.5 mt-0.5 flex-none" /> {t('customIntro.works')}</p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/5 p-3 space-y-1.5">
            <p className="flex items-center gap-2 font-bold text-white"><PenLine className="w-4 h-4" /> {t('customIntro.form')}</p>
            <p>{t('customIntro.formBody')}</p>
          </div>
        </section>

        <section className="space-y-2">
          <h3 className={heading}>{t('customIntro.know')}</h3>
          <ul className="space-y-2">
            <li className="flex gap-2"><Users className="w-4 h-4 mt-0.5 flex-none text-white/45" /><span>{t('customIntro.know1')}</span></li>
            <li className="flex gap-2"><Gavel className="w-4 h-4 mt-0.5 flex-none text-white/45" /><span>{t('customIntro.know2')}</span></li>
            <li className="flex gap-2"><ShieldCheck className="w-4 h-4 mt-0.5 flex-none text-white/45" /><span>{t('customIntro.know3')}</span></li>
          </ul>
        </section>

        <div>
          <button onClick={onClose} className={`w-full ${gameButton('gold', 'md')}`}>{t('customIntro.gotIt')}</button>
          <p className="text-center text-xs text-white/45 mt-2">{t('customIntro.reopen')}</p>
        </div>
      </div>
    </ModalSheet>
  );
}
