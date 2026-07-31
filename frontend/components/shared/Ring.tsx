'use client';

import { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface RingProps {
  pct: number;
  size: number;
  strokeWidth?: number;
  color: string;
  centerLabel?: ReactNode;
  delay?: number;
}

/**
 * Single-value progress ring -- sweeps in from 0% on mount via the same
 * stroke-dashoffset technique as Investments' AllocationDonut, generalized
 * to one segment. The percentage is always paired with centerLabel text;
 * nothing here is conveyed by arc angle alone.
 */
export function Ring({ pct, size, strokeWidth = 8, color, centerLabel, delay = 0 }: RingProps) {
  const reduceMotion = useReducedMotion();
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const segLen = (clamped / 100) * circumference;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="currentColor" className="text-bg-elevated" strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          initial={reduceMotion ? false : { strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - segLen }}
          transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {centerLabel && (
        <div className="absolute inset-0 flex items-center justify-center text-center">
          {centerLabel}
        </div>
      )}
    </div>
  );
}
