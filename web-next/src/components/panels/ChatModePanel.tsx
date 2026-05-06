'use client';

import React, { KeyboardEvent, useRef, useEffect } from 'react';
import { Send, Bot, User } from 'lucide-react';
import { useJarvisStore } from '@/store/jarvisStore';
import { useJarvisChat } from '@/hooks/useJarvisChat';

/* ── ChatModePanel ────────────────────────────────────────────────────
   Clean chat interface with message bubbles and persona selector.
   ───────────────────────────────────────────────────────────────────── */

export default function ChatModePanel() {
  const { messages, input, setInput, status, sendMessage, isConnected } = useJarvisChat();
  const { persona, availablePersonas, setPersona } = useJarvisStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 scrollbar-hide">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center opacity-30">
            <Bot className="w-10 h-10 text-cyan-400/40 mb-3" />
            <p className="text-xs text-cyan-300/40 tracking-[0.2em]">NEURAL LINK ACTIVE</p>
            <p className="text-[10px] text-white/20 mt-1">Begin transmission</p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed ${
                msg.role === 'user'
                  ? 'glass-strong ml-auto border-l-2 border-cyan-400/30'
                  : 'glass-base mr-auto'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                {msg.role === 'assistant' ? (
                  <>
                    <Bot className="w-3.5 h-3.5 text-cyan-400/70" />
                    <span className="text-[9px] text-cyan-400/50 tracking-[0.15em]">JARVIS</span>
                  </>
                ) : (
                  <>
                    <User className="w-3.5 h-3.5 text-white/40" />
                    <span className="text-[9px] text-white/30 tracking-[0.15em]">USER</span>
                  </>
                )}
              </div>

              <div className={msg.role === 'user' ? 'text-white/90' : 'text-white/70'}>
                {msg.content}
              </div>

              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="mt-2 pt-1.5 border-t border-white/[0.06] space-y-1">
                  {msg.toolCalls.map((tc, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[10px]">
                      <span className="text-cyan-400/70">⚡</span>
                      <span className="text-cyan-300/60">{tc.tool}</span>
                      {tc.output && <span className="text-green-400/60">✓</span>}
                    </div>
                  ))}
                </div>
              )}

              {msg.isStreaming && (
                <span className="inline-block ml-1 animate-blink text-cyan-400/60">┃</span>
              )}
            </div>
          </div>
        ))}

        {status === 'connecting' && (
          <div className="flex justify-start">
            <div className="px-3 py-2 glass-base rounded-2xl">
              <span className="text-[11px] text-white/30">Connecting...</span>
            </div>
          </div>
        )}

        {/* Auto-scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="px-3 py-2 border-t border-white/[0.06]">
        {/* Persona chip */}
        {availablePersonas.length > 0 && (
          <div className="flex gap-1.5 mb-2 overflow-x-auto scrollbar-hide">
            {availablePersonas.map((p) => (
              <button
                key={p.name}
                onClick={() => setPersona(p)}
                className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-medium transition-all border ${
                  persona?.name === p.name
                    ? 'bg-cyan-400/15 border-cyan-400/30 text-cyan-300'
                    : 'bg-white/[0.03] border-white/[0.06] text-white/40 hover:bg-white/[0.06]'
                }`}
              >
                {p.icon} {p.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Transmit query..."
            rows={1}
            className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-2xl px-3.5 py-2.5 text-[13px] text-white/90 resize-none outline-none placeholder:text-white/20 focus:border-cyan-400/30 btn-focus transition-all"
            style={{ minHeight: 40, maxHeight: 96 }}
          />

          <button
            onClick={() => sendMessage()}
            disabled={!isConnected || !input.trim()}
            className="flex items-center justify-center w-10 h-10 rounded-xl btn-cyan shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
