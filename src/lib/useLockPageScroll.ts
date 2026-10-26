import { useEffect } from 'react';

/**
 * Stops the page itself from scrolling or panning while a full-screen screen (the trial) is open.
 * Only the screen's own panels scroll, so fixed bars (the header with the timer and buttons) stay put,
 * including when the on-screen keyboard opens. The previous styles are restored on unmount.
 */
export function lockPageScroll(doc: Document = document): () => void {
  const html = doc.documentElement;
  const body = doc.body;
  const before = {
    htmlOverflow: html.style.overflow,
    htmlOverscroll: html.style.overscrollBehavior,
    bodyOverflow: body.style.overflow,
    bodyOverscroll: body.style.overscrollBehavior,
  };
  html.style.overflow = 'hidden';
  html.style.overscrollBehavior = 'none';
  body.style.overflow = 'hidden';
  body.style.overscrollBehavior = 'none';
  return () => {
    html.style.overflow = before.htmlOverflow;
    html.style.overscrollBehavior = before.htmlOverscroll;
    body.style.overflow = before.bodyOverflow;
    body.style.overscrollBehavior = before.bodyOverscroll;
  };
}

export function useLockPageScroll(active = true) {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return;
    return lockPageScroll();
  }, [active]);
}
