'use client';

import React from 'react';
import { useJarvisStore } from '@/store/jarvisStore';

/* ── ThinkingBubble ───────────────────────────────────────────────────
   Floating text bubble above the brain showing current AI thought.
   ───────────────────────────────────────────────────────────────────── */

export default function ThinkingBubble() {
  const { thinkingBubbleVisible, statusText } = useJarvisStore();

  if (!thinkingBubbleVisible) return null;

  return (
    <div
      className="px-4 py-2 glass-strong rounded-full pointer-events-none"
      style={{
        maxWidth: '200px',
        boxShadow: '0 0 20px rgba(0,212,255,0.15)',
      }}
    >
      <p className="text-[11px] text-cyan-300/90 text-center whitespace-nowrap truncate">
        {statusText}
      </p>
    </div>
  );
}
