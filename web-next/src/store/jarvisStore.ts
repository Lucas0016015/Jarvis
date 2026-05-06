import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/* ── Types ───────────────────────────────────────────────────────────── */

export type ActivityState =
  | 'idle'           // Esperando
  | 'thinking'       // Procesando
  | 'speaking'       // Hablando (TTS)
  | 'listening'      // Escuchando (STT)
  | 'error'          // Error de conexión

export type PanelMode =
  | 'chat'
  | 'tasks'
  | 'notes'
  | 'voice'
  | 'timer'
  | 'email'
  | 'settings'
  | 'personalities'

export type AppScreen =
  | 'home'
  | 'chat'
  | 'tasks'
  | 'notes'
  | 'voice'
  | 'timer'
  | 'email'
  | 'settings'
  | 'personalities'

export interface Persona {
  name: string
  label: string
  description: string
  icon: string
}

export interface JarvisStore {
  /* ── Core state ── */
  activityState: ActivityState
  currentScreen: AppScreen
  previousScreen: AppScreen | null
  panelMode: PanelMode
  panelExpanded: boolean         // Panel completo vs minimizado

  /* ── Audio / Voice ── */
  micActive: boolean             // Micrófono grabando
  visualizerAmplitude: number    // 0.0 - 1.0 para el visualizador

  /* ── Thinking / Status ── */
  statusText: string             // Texto que aparece en la burbuja
  thinkingBubbleVisible: boolean

  /* ── Persona ── */
  persona: Persona | null
  availablePersonas: Persona[]

  /* ── Actions ── */
  setActivityState: (s: ActivityState) => void
  setPanelMode: (m: PanelMode) => void
  setScreen: (s: AppScreen) => void
  goBack: () => void

  togglePanelExpanded: () => void
  setPanelExpanded: (v: boolean) => void

  setMicActive: (active: boolean) => void
  setVisualizerAmplitude: (amp: number) => void

  setStatusText: (text: string) => void
  showThinkingBubble: (text: string) => void
  hideThinkingBubble: () => void

  setPersona: (p: Persona) => void
  setAvailablePersonas: (ps: Persona[]) => void

  reset: () => void
}

/* ── Store Instance ──────────────────────────────────────────────── */

export const useJarvisStore = create<JarvisStore>()(
  persist(
    (set, get) => ({
  /* state */
  activityState: 'idle',
  currentScreen: 'home',
  previousScreen: null,
  panelMode: 'chat',
  panelExpanded: true,

  micActive: false,
  visualizerAmplitude: 0,

  statusText: 'Neural Link Active',
  thinkingBubbleVisible: false,

  persona: null,
  availablePersonas: [],

  /* actions */
  setActivityState: (activityState) => {
    const texts: Record<ActivityState, string> = {
      idle: 'Neural Link Active',
      thinking: 'Processing Neural Patterns...',
      speaking: 'Transmitting Intelligence...',
      listening: 'Listening...',
      error: 'Connection Lost',
    }
    set({ activityState, statusText: texts[activityState] })
  },

  setPanelMode: (panelMode) => set({ panelMode }),

  setScreen: (currentScreen) => set((state) => ({
    currentScreen,
    previousScreen: state.currentScreen,
  })),

  goBack: () => set((state) => ({
    currentScreen: state.previousScreen ?? 'home',
    previousScreen: null,
  })),

  togglePanelExpanded: () => set((s) => ({ panelExpanded: !s.panelExpanded })),
  setPanelExpanded: (panelExpanded) => set({ panelExpanded }),

  setMicActive: (micActive) => set({ micActive }),
  setVisualizerAmplitude: (visualizerAmplitude) => set({ visualizerAmplitude }),

  setStatusText: (statusText) => set({ statusText }),

  showThinkingBubble: (text) => set({ statusText: text, thinkingBubbleVisible: true }),
  hideThinkingBubble: () => set({ thinkingBubbleVisible: false }),

  setPersona: (persona) => set({ persona }),
  setAvailablePersonas: (availablePersonas) => set({ availablePersonas }),

  reset: () => set({
    activityState: 'idle',
    panelMode: 'chat',
    panelExpanded: true,
    micActive: false,
    visualizerAmplitude: 0,
    statusText: 'Neural Link Active',
    thinkingBubbleVisible: false,
    persona: null,
  }),
}),
{
  name: 'jarvis-store',
  partialize: (state) => ({
    currentScreen: state.currentScreen,
    panelMode: state.panelMode,
    panelExpanded: state.panelExpanded,
    persona: state.persona,
  }),
}
)
)
