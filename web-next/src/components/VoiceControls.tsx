'use client'

import { useRef, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, BrainCircuit, Zap, MessageCircle, Settings, User } from 'lucide-react'
import { useJarvisStore } from '@/store/jarvisStore'

/* ──────────────────────────────────────────────────────────────
   VOICE CONTROLS — Premium bottom navbar + microphone + waves
   Inspired by ChatGPT Voice Mode + Apple VisionOS glass.
─────────────────────────────────────────────────────────────── */

export default function VoiceControls() {
  const { activityState, setActivityState, setMicActive, micActive, visualizerAmplitude, currentScreen, setScreen } = useJarvisStore()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null)

  /* Voice waveform canvas */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const resize = () => {
      canvas.width = 400 * dpr
      canvas.height = 120 * dpr
      canvas.style.width = '400px'
      canvas.style.height = '120px'
      ctx.scale(dpr, dpr)
    }
    resize()
    window.addEventListener('resize', resize)

    const bars = 64
    const barArray = new Float32Array(bars)
    let phase = 0

    const render = () => {
      const w = 400
      const h = 120
      const isListening = activityState === 'listening'
      const isAgentSpeaking = activityState === 'speaking'
      const amp = visualizerAmplitude || (isListening ? 0.8 : isAgentSpeaking ? 0.5 : 0.05)

      ctx.clearRect(0, 0, w, h)

      // Update bars
      for (let i = 0; i < bars; i++) {
        const target = amp * (
          Math.sin(phase + i * 0.3) * 0.3 +
          Math.sin(phase * 1.5 + i * 0.7) * 0.2 +
          (Math.random() - 0.5) * 0.15
        )
        barArray[i] += (target - barArray[i]) * 0.15
      }
      phase += 0.04

      const barW = w / bars
      const cx = w / 2

      ctx.lineWidth = 2
      ctx.lineCap = 'round'

      for (let i = 0; i < bars; i++) {
        const val = Math.max(0, barArray[i])
        const x = i * barW + barW / 2
        const dist = Math.abs(x - cx) / cx
        const falloff = 1 - dist * 0.6
        const height = val * falloff * h * 0.9

        if (height <= 1) continue

        const hue = isListening ? 160 : isAgentSpeaking ? 190 : 330
        const sat = isListening ? '90%' : isAgentSpeaking ? '80%' : '60%'
        const lit = isListening ? '65%' : isAgentSpeaking ? '70%' : '55%'
        const alpha = 0.3 + falloff * 0.7

        ctx.strokeStyle = `hsla(${hue}, ${sat}, ${lit}, ${alpha})`
        ctx.beginPath()
        ctx.moveTo(x, h / 2 - height / 2)
        ctx.lineTo(x, h / 2 + height / 2)
        ctx.stroke()

        // Mirror glow
        if (height > h * 0.15) {
          ctx.strokeStyle = `hsla(${hue}, ${sat}, ${lit}, ${alpha * 0.3})`
          ctx.beginPath()
          ctx.moveTo(x - 2, h / 2 - height / 2 * 0.7)
          ctx.lineTo(x - 2, h / 2 + height / 2 * 0.7)
          ctx.stroke()
        }
      }

      animRef.current = requestAnimationFrame(render)
    }

    render()
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [activityState, visualizerAmplitude])

  const handleMicClick = () => {
    if (!micActive) {
      setMicActive(true)
      setActivityState('listening')
    } else {
      setMicActive(false)
      setActivityState('idle')
    }
  }

  const navItems = [
    { id: 'chat', label: 'Chat', icon: MessageCircle },
    { id: 'personalities', label: 'Mind', icon: BrainCircuit },
    { id: 'voice', label: 'Voice', icon: Zap },
    { id: 'settings', label: 'Config', icon: Settings },
  ]

  const isActive = (id: string) => {
    if (id === 'voice') return currentScreen === 'voice' || activityState === 'listening' || activityState === 'speaking'
    if (id === 'personalities') return currentScreen === 'personalities'
    return currentScreen === id
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center pb-6 pointer-events-none">
      <div className="pointer-events-auto flex flex-col items-center gap-3">
        {/* WAVE CANVAS */}
        <AnimatePresence>
          {(activityState === 'listening' || activityState === 'speaking') && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.8 }}
              transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
              className="relative"
            >
              <canvas
                ref={canvasRef}
                className="rounded-2xl"
                style={{
                  background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.15) 100%)',
                  filter: 'blur(0.5px)',
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <motion.p
                  key={activityState}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-[10px] uppercase tracking-[0.3em] font-medium"
                  style={{
                    color: activityState === 'listening' ? 'rgba(0,255,150,0.7)' : 'rgba(100,200,255,0.7)',
                    textShadow: `0 0 20px ${activityState === 'listening' ? 'rgba(0,255,150,0.3)' : 'rgba(100,200,255,0.3)'}`,
                  }}
                >
                  {activityState === 'listening' ? 'Escuchando...' : 'Jarvis hablando...'}
                </motion.p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* MAIN MIC BUTTON */}
        <div className="relative">
          {/* Pulse rings */}
          {(activityState === 'listening' || activityState === 'speaking') && (
            <>
              <motion.div
                className="absolute inset-0 rounded-full"
                animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  background: activityState === 'listening'
                    ? 'radial-gradient(circle, rgba(0,255,150,0.3) 0%, transparent 70%)'
                    : 'radial-gradient(circle, rgba(100,200,255,0.3) 0%, transparent 70%)',
                }}
              />
              <motion.div
                className="absolute inset-0 rounded-full"
                animate={{ scale: [1, 1.6, 1], opacity: [0.2, 0, 0.2] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                style={{
                  background: activityState === 'listening'
                    ? 'radial-gradient(circle, rgba(0,255,150,0.2) 0%, transparent 70%)'
                    : 'radial-gradient(circle, rgba(100,200,255,0.2) 0%, transparent 70%)',
                }}
              />
            </>
          )}

          <button
            onClick={handleMicClick}
            className="relative z-10 w-16 h-16 rounded-full flex items-center justify-center transition-all duration-500"
            onMouseEnter={() => setHoveredBtn('mic')}
            onMouseLeave={() => setHoveredBtn(null)}
            style={{
              background: micActive
                ? `radial-gradient(circle, rgba(0,255,150,0.15) 0%, rgba(0,255,150,0.05) 100%)`
                : 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
              border: `1px solid ${micActive ? 'rgba(0,255,150,0.3)' : 'rgba(255,255,255,0.1)'}`,
              boxShadow: micActive
                ? '0 0 40px rgba(0,255,150,0.2), inset 0 1px 0 rgba(255,255,255,0.1)'
                : '0 0 20px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
          >
            <motion.div
              animate={micActive ? { scale: [1, 1.08, 1] } : { scale: hoveredBtn === 'mic' ? 1.05 : 1 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            >
              {micActive ? (
                <Mic className="w-6 h-6" style={{ color: '#00ff96', filter: 'drop-shadow(0 0 10px rgba(0,255,150,0.5))' }}></Mic>
              ) : (
                <MicOff className="w-6 h-6" style={{ color: 'rgba(255,255,255,0.4)' }}></MicOff>
              )}
            </motion.div>
          </button>
        </div>

        {/* PREMIUM NAVBAR */}
        <div
          className="flex items-center gap-1 p-2 rounded-2xl"
          style={{
            background: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(32px) saturate(1.5)',
            border: '1px solid rgba(255,255,255,0.06)',
            boxShadow: '0 -8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.id)
              return (
              <motion.button
                key={item.id}
                onClick={() => {
                    if (item.id === 'voice') {
                      setScreen('voice')
                    } else {
                      setScreen(item.id as any)
                    }
                }}
                onMouseEnter={() => setHoveredBtn(item.id)}
                onMouseLeave={() => setHoveredBtn(null)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-medium transition-colors duration-300 cursor-pointer ${
                  active ? 'text-white' : 'text-white/40'
                }`}
                style={{
                  background: active
                    ? 'rgba(255,255,255,0.08)'
                    : hoveredBtn === item.id
                    ? 'rgba(255,255,255,0.04)'
                    : 'transparent',
                }}
              >
                <Icon className="w-4 h-4" style={{ color: active ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)' }}></Icon>
                <span className="hidden sm:inline">{item.label}</span>
                {active && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute inset-0 rounded-xl"
                    style={{
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'rgba(255,255,255,0.02)',
                    }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </motion.button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
