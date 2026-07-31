'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * Animates a number from its previous value to `target` on every change,
 * starting from 0 on first mount. Respects prefers-reduced-motion by
 * jumping straight to the final value instead of animating.
 */
export function useCountUp(target: number, durationMs = 700) {
  const reduceMotion = useReducedMotion();
  const [value, setValue] = useState(0);
  const prevTarget = useRef(0);
  const frame = useRef<number>();

  useEffect(() => {
    const from = prevTarget.current;
    prevTarget.current = target;

    if (reduceMotion || from === target) {
      setValue(target);
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (target - from) * eased);
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);

    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [target, durationMs, reduceMotion]);

  return value;
}
