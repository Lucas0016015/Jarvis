'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useJarvisStore } from '@/store/jarvisStore';
import CommandPalette from '@/components/CommandPalette';

const NeuralBrainScene  = dynamic(() => import('@/components/NeuralBrainScene'),  { ssr: false });
const StatusBar         = dynamic(() => import('@/components/StatusBar'),         { ssr: false });
const MicButton         = dynamic(() => import('@/components/MicButton'),         { ssr: false });
const AudioVisualizer   = dynamic(() => import('@/components/AudioVisualizer'),  { ssr: false });
const OrbitalNav        = dynamic(() => import('@/components/OrbitalNavigation'), { ssr: false });
const ChatPanel         = dynamic(() => import('@/components/panels/ChatModePanel'),       { ssr: false });
const TasksPanel        = dynamic(() => import('@/components/panels/TasksModePanel'),      { ssr: false });
const NotesPanel        = dynamic(() => import('@/components/panels/NotesModePanel'),      { ssr: false });
const VoicePanel        = dynamic(() => import('@/components/panels/VoiceModePanel'),      { ssr: false });
const TimerPanel        = dynamic(() => import('@/components/panels/TimerModePanel'),      { ssr: false });
const EmailPanel        = dynamic(() => import('@/components/panels/EmailModePanel'),      { ssr: false });
const SettingsPanel     = dynamic(() => import('@/components/panels/SettingsPanel'),       { ssr: false });
const PersonalitiesPanel = dynamic(() => import('@/components/panels/PersonalitiesPanel'), { ssr: false });

const SECTION_PANELS: Partial<Record<string, React.ComponentType>> = {
  chat:          ChatPanel,
  tasks:         TasksPanel,
  notes:         NotesPanel,
  voice:         VoicePanel,
  timer:         TimerPanel,
  email:         EmailPanel,
  settings:      SettingsPanel,
  personalities: PersonalitiesPanel,
};

const SECTION_TITLES: Record<string, string> = {
  chat: 'Chat', tasks: 'Tasks', notes: 'Notes', voice: 'Voice',
  timer: 'Timer', email: 'Email', settings: 'Settings', personalities: 'Personas',
};

function HomeView() {
  const { activityState } = useJarvisStore();
  return (
    <div className="flex flex-col h-full">
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-[15%] left-1/2 -translate-x-1/2 w-[320px] h-[320px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.07) 0%, transparent 70%)' }} />
      </div>

      <div className="relative z-10 w-full" style={{ height: '45%', minHeight: 180 }}>
        <NeuralBrainScene state={activityState} />
      </div>

      <div className="relative z-20 flex justify-center -mt-5 mb-3">
        <MicButton />
      </div>

      <div className="px-4 mb-3">
        <AudioVisualizer />
      </div>

      <div className="mb-2">
        <OrbitalNav />
      </div>
    </div>
  );
}

function SectionView({ screen }: { screen: string }) {
  const { goBack } = useJarvisStore();
  const Panel = SECTION_PANELS[screen];
  const title = SECTION_TITLES[screen] ?? screen;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 h-12 shrink-0 border-b"
        style={{ borderColor: 'rgba(0,212,255,0.08)' }}>
        <button
          onClick={goBack}
          className="flex items-center justify-center w-8 h-8 rounded-xl transition-all"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          aria-label="Go back"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <span className="text-[11px] font-semibold tracking-[0.2em] uppercase"
          style={{ color: 'rgba(255,255,255,0.5)' }}>
          {title}
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {Panel ? <Panel /> : (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-white/20">Coming soon</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RootPage() {
  const { currentScreen } = useJarvisStore();
  const [mounted, setMounted] = React.useState(false);
  const [scale, setScale] = React.useState(1);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    const updateScale = () => {
      const availH = window.innerHeight - 32;
      const availW = window.innerWidth - 32;
      const scaleH = availH / 844;
      const scaleW = availW / 390;
      setScale(Math.min(scaleH, scaleW, 1));
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  const isHome = currentScreen === 'home';

  if (!mounted) {
    return (
      <div className="w-screen h-screen flex items-center justify-center"
        style={{ background: '#0d0d12' }}>
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 border-2 rounded-full animate-spin"
            style={{ borderColor: 'rgba(0,212,255,0.2)', borderTopColor: '#00d4ff', borderRightColor: '#ff00a0' }} />
          <p className="text-[10px] tracking-[0.4em] uppercase" style={{ color: 'rgba(0,212,255,0.4)' }}>
            Initializing...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen flex items-center justify-center"
      style={{ background: '#0d0d12' }}>

      <div
        className="relative overflow-hidden flex flex-col"
        style={{
          width: 390,
          height: 844,
          borderRadius: 44,
          background: '#0a0a0f',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 40px 80px rgba(0,0,0,0.8), 0 0 60px rgba(0,212,255,0.04)',
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
        }}
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[34px] z-50"
          style={{ background: '#0a0a0f', borderRadius: '0 0 20px 20px' }} />

        <StatusBar />
        <CommandPalette />

        <div className="flex-1 min-h-0 relative">
          {isHome ? <HomeView /> : <SectionView screen={currentScreen} />}
        </div>

        <div className="flex justify-center pb-2 pt-1 shrink-0">
          <div className="w-[130px] h-[5px] rounded-full"
            style={{ background: 'rgba(255,255,255,0.2)' }} />
        </div>
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center">
        <p className="text-[9px] tracking-[0.2em] uppercase"
          style={{ color: 'rgba(255,255,255,0.12)' }}>
          JARVIS v3.0 · Mobile Preview
        </p>
      </div>
    </div>
  );
}