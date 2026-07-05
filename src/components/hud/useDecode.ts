'use client';

import { useEffect, useState } from 'react';
import { useApp } from '@/state/store';

const GLYPHS = '▚▞▛▜░▒▓#$%&@!<>[]/\\01';

/**
 * Terminal text-decode effect: characters resolve left → right, the
 * unresolved tail shows scrambled glyphs (bible: `decode` 35ms/char).
 * Under reduced motion the text appears instantly.
 */
export function useDecode(text: string, msPerChar = 35): string {
  const reducedMotion = useApp((s) => s.reducedMotion);
  const [out, setOut] = useState(reducedMotion ? text : '');

  useEffect(() => {
    if (reducedMotion) {
      setOut(text);
      return;
    }
    let i = 0;
    setOut('');
    const iv = window.setInterval(() => {
      i++;
      if (i >= text.length) {
        setOut(text);
        window.clearInterval(iv);
        return;
      }
      const scrambleLen = Math.min(3, text.length - i);
      let scramble = '';
      for (let j = 0; j < scrambleLen; j++) {
        scramble += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }
      setOut(text.slice(0, i) + scramble);
    }, msPerChar);
    return () => window.clearInterval(iv);
  }, [text, msPerChar, reducedMotion]);

  return out;
}
