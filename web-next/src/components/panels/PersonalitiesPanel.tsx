'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, Check, Bot, Wrench, Search, Pen } from 'lucide-react';

/* ── PersonalitiesPanel ──────────────────────────────────────────────
   Agent persona selector: shows all personalities, allows switching,
   and shows details about each persona's capabilities.
   ──────────────────────────────────────────────────────────────────── */

const API = 'http://localhost:8000/api/v1';

interface Persona {
  name: string;
  label: string;
  description: string;
  icon: string;
  system_prompt?: string;
  allowed_tools?: string[];
}

const ICON_MAP: Record<string, React.ElementType> = {
  '🤖': Bot,
  '🛠️': Wrench,
  '🔍': Search,
  '✍️': Pen,
};

export default function PersonalitiesPanel() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [active, setActive] = useState<string>('default');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API}/personas`)
      .then(r => r.json())
      .then((data) => {
        setPersonas(data);
        setLoading(false);
      })
      .catch((e) => {
        setError('Failed to load personas');
        setLoading(false);
        // fallback
        setPersonas([
          { name: 'default', label: 'JARVIS', description: 'General purpose AI assistant', icon: '🤖' },
          { name: 'developer', label: 'DEV', description: 'Code-focused specialist', icon: '🛠️' },
          { name: 'researcher', label: 'RESEARCH', description: 'Deep web research', icon: '🔍' },
          { name: 'writer', label: 'WRITER', description: 'Creative writing', icon: '✍️' },
        ]);
      });
  }, []);

  const activePersona = personas.find(p => p.name === active);

  return (
    <div className="flex flex-col h-full overflow-y-auto scrollbar-hide px-4 py-4 space-y-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between"
      >
        <span className="text-[9px] tracking-[0.2em] uppercase text-white/30"
        >Neural Personas</span>
        <Sparkles className="w-4 h-4 text-cyan-400/30" />
      </div>

      {/* Persona grid */}
      <div className="grid grid-cols-2 gap-3"
      >
        {personas.map((p) => {
          const isActive = active === p.name;
          const Icon = ICON_MAP[p.icon] || Bot;
          return (
            <button
              key={p.name}
              onClick={() => setActive(p.name)}
              className={`relative p-4 rounded-xl text-left transition-all ${
                isActive
                  ? 'glass-strong neon-border bg-cyan-400/[0.04]'
                  : 'glass-base hover:glass-hover'
              }`}
            >
              {isActive && <Check className="absolute top-2 right-2 w-3 h-3 text-cyan-400" />}
              
              <div className="flex items-center gap-2 mb-2"
              >
                <span className="text-lg"
                >{p.icon}</span>
                <span className={`text-[13px] font-semibold ${isActive ? 'text-cyan-300' : 'text-white/70'}`}
                >
                  {p.label}
                </span>
              </div>
              <p className="text-[10px] text-white/40 leading-relaxed"
              >{p.description}</p>
            </button>
          );
        })}
      </div>

      {/* Active persona details */}
      {activePersona && (
        <div className="glass-base rounded-xl p-4 space-y-3"
        >
          <h4 className="text-[12px] font-semibold text-white/70"
          >{activePersona.label} — Active</h4>
          <p className="text-[11px] text-white/40 leading-relaxed"
          >{activePersona.description}</p>
          
          {activePersona.allowed_tools && (
            <div className="space-y-1"
            >
              <span className="text-[9px] tracking-[0.15em] uppercase text-white/20"
              >Available Tools</span>
              <div className="flex flex-wrap gap-1.5"
              >
                {activePersona.allowed_tools.map((tool) => (
                  <span
                    key={tool}
                    className="text-[9px] px-2 py-1 rounded-full bg-cyan-400/8 text-cyan-300/50 border border-cyan-400/10"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-[11px] text-red-400/60 text-center">{error}</p>}
    </div>
  );
}
