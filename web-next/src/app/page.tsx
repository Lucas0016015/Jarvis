'use client'

import React, { useState } from 'react'
import dynamic from 'next/dynamic'
import { useJarvisStore } from '@/store/jarvisStore'
import { AppSidebar } from '@/components/AppSidebar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Mic, Zap, MessageCircle, BrainCircuit, Moon, AlertTriangle } from 'lucide-react'

/* ── Lazy-load panels + brain + bubble + voice ───────────────── */
const BrainBackground = dynamic(() => import('@/components/BrainBackground'), { ssr: false })
const ThinkingBubble  = dynamic(() => import('@/components/ThinkingBubble'),  { ssr: false })
const VoiceControls   = dynamic(() => import('@/components/VoiceControls'),   { ssr: false })

const ChatPanel        = dynamic(() => import('@/components/panels/ChatModePanel'),       { ssr: false })
const TasksPanel       = dynamic(() => import('@/components/panels/TasksModePanel'),      { ssr: false })
const NotesPanel       = dynamic(() => import('@/components/panels/NotesModePanel'),      { ssr: false })
const VoicePanel       = dynamic(() => import('@/components/panels/VoiceModePanel'),      { ssr: false })
const TimerPanel       = dynamic(() => import('@/components/panels/TimerModePanel'),      { ssr: false })
const EmailPanel       = dynamic(() => import('@/components/panels/EmailModePanel'),      { ssr: false })
const SettingsPanel    = dynamic(() => import('@/components/panels/SettingsPanel'),       { ssr: false })
const PersonalitiesPanel = dynamic(() => import('@/components/panels/PersonalitiesPanel'), { ssr: false })

const PANELS: Record<string, React.ComponentType> = {
  chat: ChatPanel, notes: NotesPanel, tasks: TasksPanel,
  voice: VoicePanel, timer: TimerPanel, email: EmailPanel,
  settings: SettingsPanel, personalities: PersonalitiesPanel,
}

/* ── State meta for status indicator ─────────────────────────── */
const STATE_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  idle:      { label: 'Neural Link Active', color: '#44ccdd', icon: BrainCircuit },
  listening: { label: 'Audio Input',        color: '#00ff88', icon: Mic },
  thinking:  { label: 'Processing',         color: '#ffaa00', icon: Zap },
  speaking:  { label: 'Transmitting',       color: '#00d4ff', icon: MessageCircle },
  error:     { label: 'System Error',       color: '#ff4444', icon: AlertTriangle },
  sleep:     { label: 'Standby',            color: '#5566aa', icon: Moon },
}

/* ── Status Indicator (top-right) ────────────────────────────── */
function StatusIndicator() {
  const { activityState } = useJarvisStore()
  const meta = STATE_META[activityState] || STATE_META.idle

  return (
    <div className="fixed top-5 right-5 z-50 flex items-center gap-2 px-3.5 py-2 rounded-full"
      style={{
        background: 'rgba(0,0,0,0.25)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <div
        className="w-2 h-2 rounded-full transition-all duration-300"
        style={{
          background: meta.color,
          boxShadow: `0 0 ${activityState === 'thinking' ? '16px' : '8px'} ${meta.color}`,
          animation: activityState === 'thinking' || activityState === 'listening' ? 'statusPulse 1.2s infinite' : 'none',
        }}
      />
      <span className="text-xs font-medium text-white/60">{meta.label}</span>
    </div>
  )
}

/* ── Control Dock (bottom-center) ─────────────────────────────── */
function ControlDock() {
  const { activityState, setActivityState } = useJarvisStore()
  const states: Array<'idle' | 'thinking' | 'speaking'> = ['idle', 'thinking', 'speaking']

  const labels = {
    idle: '⏸ Idle',
    thinking: '⚡ Pensando',
    speaking: '💬 Hablando',
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex gap-2.5 p-2 rounded-[14px]"
      style={{
        background: 'rgba(0,0,0,0.35)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {states.map((s) => (
        <button
          key={s}
          onClick={() => setActivityState(s)}
          className={`px-4 py-2.5 rounded-[11px] text-xs font-medium transition-all duration-300 cursor-pointer ${
            activityState === s
              ? 'text-white font-semibold'
              : 'text-white/55 hover:text-white hover:bg-white/[0.06]'
          }`}
          style={
            activityState === s
              ? {
                  background: 'linear-gradient(135deg, rgba(236,72,153,.25), rgba(64,224,208,.15))',
                  boxShadow: '0 0 20px rgba(236,72,153,.25)',
                }
              : { background: 'rgba(255,255,255,0.03)' }
          }
        >
          {labels[s]}
        </button>
      ))}
    </div>
  )
}

/* ── Hint ────────────────────────────────────────────────────── */
function Hint() {
  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-30 text-white/25 text-[11px] whitespace-nowrap pointer-events-none">
      Arrastra para orbitar · Scroll para zoom
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   ROOT PAGE — CINEMATIC JARVIS
   Brain 3D as full background. Panels float with glass morphism.
══════════════════════════════════════════════════════════════ */
export default function RootPage() {
  const [panelOpen, setPanelOpen] = useState(true)
  const { currentScreen } = useJarvisStore()
  const Panel = PANELS[currentScreen] || ChatPanel

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0a0a0f]">
      {/* 1. Brain 3D Background (z-0) */}
      <BrainBackground />

      {/* 2. Status Badge (z-50) */}
      <StatusIndicator />

      {/* 3. Thinking Bubble (z-40) */}
      <ThinkingBubble />

      {/* 4. Control Dock REPLACED with Voice Controls (mic + waves + navbar) */}
      <VoiceControls />

      {/* 5. Floating Title */}
      <div className="fixed top-5 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
        <h1
          className="text-xl font-bold tracking-[0.25em] text-white/70"
          style={{ textShadow: '0 0 30px rgba(68,204,221,0.25)' }}
        >
          JARVIS
        </h1>
      </div>

      {/* 7. UI Overlay Layer (z-20) */}
      <div className="relative z-20 flex h-full w-full pointer-events-none">
        {/* Sidebar */}
        <div className="pointer-events-auto shrink-0 h-full">
          <AppSidebar />
        </div>

        {/* Main panel area (right) */}
        <div className="flex-1 flex justify-end items-start p-4 h-full">
          {panelOpen && (
            <div
              className="pointer-events-auto w-[420px] max-w-[42vw] h-[85vh] rounded-2xl overflow-hidden animate-fade-in"
              style={{
                background: 'rgba(10,10,15,0.75)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.06)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              }}
            >
              <ScrollArea className="h-full">
                <Panel />
              </ScrollArea>
            </div>
          )}

          {/* Panel toggle button (when closed) */}
          {!panelOpen && (
            <button
              onClick={() => setPanelOpen(true)}
              className="pointer-events-auto mt-4 px-3 py-2 rounded-xl text-xs text-white/40 bg-white/[0.03] border border-white/[0.06] hover:text-white hover:bg-white/[0.06] transition-all"
            >
              Abrir panel
            </button>
          )}
        </div>
      </div>
    </div>
  )
}