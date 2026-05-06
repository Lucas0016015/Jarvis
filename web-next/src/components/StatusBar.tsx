'use client';

import React from 'react';
import { Settings } from 'lucide-react';
import { useJarvisStore } from '@/store/jarvisStore';

export default function StatusBar() {
  const { activityState, statusText, currentScreen, setScreen } = useJarvisStore();

  const statusColors: Record<string, string> = {
    idle: '#888888',
    thinking: '#ffaa00',
    speaking: '#00d4ff',
    listening: '#00ff88',
    error: '#ff4444',
  };

  const color = statusColors[activityState] || '#888888';
  const isHome = currentScreen === 'home';

  return (
    <header className="relative z-30 flex items-center justify-between px-4 h-12 shrink-0">
      {/* Left: Brand — clickable to go home */}
      <button
        onClick={() => setScreen('home')}
        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        aria-label="Go to home"
      >
        <h1
          className="text-lg font-extrabold tracking-[0.3em] uppercase"
          style={{
            background: 'linear-gradient(135deg, #00d4ff, #ff00a0)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          JARVIS
        </h1>
      </button>

      {/* Center: Status */}
      <div className="flex items-center gap-2">
        <span
          className="relative flex h-2 w-2"
          aria-label={`Status: ${activityState}`}
        >
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{ backgroundColor: color }}
          />
          <span
            className="relative inline-flex rounded-full h-2 w-2"
            style={{ backgroundColor: color }}
          />
        </span>
        <span
          className="text-[9px] font-medium tracking-[0.2em] uppercase"
          style={{ color }}
        >
          {statusText}
        </span>
      </div>

      {/* Right: Settings */}
      <button
        onClick={() => setScreen('settings')}
        className="p-2 rounded-lg transition-all hover:bg-white/[0.04]"
        aria-label="Settings"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <Settings className="w-[18px] h-[18px] text-white/40" />
      </button>
    </header>
  );
}