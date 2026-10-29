import { useState } from 'react';
import { Check, Copy, Share2 } from 'lucide-react';

interface Props {
  link: string;
  /** Message sent along with the link when sharing (the link itself is added after it). */
  shareText: string;
  className?: string;
}

/** A private challenge's link, with Copy and (where the device supports it) Share. */
export default function ShareLinkBox({ link, shareText, className = '' }: Props) {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function';

  const copy = async () => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(link);
      ok = true;
    } catch {
      // Older browsers / blocked clipboard: select a temporary field and copy from it.
      try {
        const field = document.createElement('textarea');
        field.value = link;
        field.setAttribute('readonly', '');
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.appendChild(field);
        field.select();
        ok = document.execCommand('copy');
        document.body.removeChild(field);
      } catch {
        ok = false;
      }
    }
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const share = async () => {
    try {
      await (navigator as any).share({ title: 'Courtroom Quest challenge', text: shareText, url: link });
    } catch {
      /* the person closed the share sheet */
    }
  };

  return (
    <div className={className}>
      <input
        readOnly
        value={link}
        onFocus={e => e.currentTarget.select()}
        aria-label="Challenge link"
        className="w-full px-3 py-2.5 bg-black/50 border border-white/20 rounded-xl text-white/90 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-[#FFD43B]"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={copy}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#FFD43B] hover:bg-[#ffdc5e] text-black font-bold rounded-xl border-b-4 border-[#B8860B] active:translate-y-0.5 active:border-b-2 transition-all"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copied' : 'Copy link'}
        </button>
        {canShare && (
          <button
            type="button"
            onClick={share}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold rounded-xl transition-colors"
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>
        )}
      </div>
    </div>
  );
}
