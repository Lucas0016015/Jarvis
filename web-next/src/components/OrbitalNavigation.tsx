'use client';

import React from 'react';
import {
  MessageSquare,
  CheckCircle2,
  FileText,
  Mic,
  Clock,
  Mail,
  Settings,
  Sparkles,
} from 'lucide-react';
import { useJarvisStore, type AppScreen } from '@/store/jarvisStore';

interface NavItem {
  screen: AppScreen;
  label: string;
  Icon: React.ElementType;
}

const navItems: NavItem[] = [
  { screen: 'chat',          label: 'Chat',     Icon: MessageSquare },
  { screen: 'tasks',         label: 'Tasks',    Icon: CheckCircle2 },
  { screen: 'notes',         label: 'Notes',    Icon: FileText },
  { screen: 'voice',         label: 'Voice',    Icon: Mic },
  { screen: 'timer',         label: 'Timer',    Icon: Clock },
  { screen: 'email',         label: 'Email',    Icon: Mail },
  { screen: 'personalities', label: 'Personas', Icon: Sparkles },
  { screen: 'settings',      label: 'Settings', Icon: Settings },
];

export default function OrbitalNavigation() {
  const { currentScreen, setScreen } = useJarvisStore();

  return (
    <nav className="relative z-20 py-2">
      <div className="flex gap-2.5 overflow-x-auto scrollbar-hide px-4 snap-x snap-mandatory">
        {navItems.map((item) => {
          const isActive = currentScreen === item.screen;
          return (
            <button
              key={item.screen}
              onClick={() => setScreen(item.screen)}
              className={`flex flex-col items-center gap-1 snap-center shrink-0 transition-all duration-300 ${
                isActive ? 'opacity-100' : 'opacity-45 hover:opacity-80'
              }`}
            >
              <div
                className={`
                  flex items-center justify-center rounded-full transition-all duration-300
                  ${isActive
                    ? 'w-[52px] h-[52px] glass-strong neon-border'
                    : 'w-11 h-11 glass-base'
                  }
                `}
                style={{
                  boxShadow: isActive
                    ? '0 0 16px rgba(0,212,255,0.2), inset 0 0 8px rgba(0,212,255,0.05)'
                    : 'none',
                }}
              >
                <item.Icon
                  className={`transition-all duration-300 ${
                    isActive ? 'w-5 h-5 text-cyan-300' : 'w-[18px] h-[18px] text-white/50'
                  }`}
                />
              </div>

              <span
                className={`text-[9px] font-medium tracking-[0.12em] uppercase transition-colors duration-300 ${
                  isActive ? 'text-cyan-300' : 'text-white/25'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}