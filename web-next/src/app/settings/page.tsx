'use client';

import { useState, useEffect } from 'react';

interface Settings {
  apiUrl: string;
  llmProvider: string;
  modelName: string;
  theme: 'dark' | 'system';
  autoConnect: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  apiUrl: 'http://localhost:8000',
  llmProvider: 'ollama',
  modelName: 'llama3.2',
  theme: 'dark',
  autoConnect: true,
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [cacheSize, setCacheSize] = useState('0 KB');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('jarvis_settings');
      if (stored) setSettings(JSON.parse(stored));
    } catch {
      console.error('Failed to load settings');
    }
  }, []);

  const saveSettings = () => {
    localStorage.setItem('jarvis_settings', JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const clearCache = () => {
    if (!confirm('Clear all local data?')) return;
    localStorage.removeItem('jarvis_settings');
    localStorage.removeItem('jarvis_messages');
    setSettings(DEFAULT_SETTINGS);
    setCacheSize('0 KB');
  };

  const Section = ({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) => (
    <div className="glass-base neon-border p-5 rounded-xl space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-lg opacity-60">{icon}</span>
        <h2 className="text-xs font-bold tracking-[4px] text-jarvis-cyan/70">{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );

  const Input = ({ label, value, onChange, type = 'text', placeholder }: {
    label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
  }) => (
    <div className="space-y-1.5">
      <label className="text-[10px] tracking-[3px] uppercase text-jarvis-cyan/50">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-black/30 border border-jarvis-border/40 rounded-lg px-3 py-2.5 text-sm font-mono placeholder:text-gray-600 focus:border-jarvis-cyan/50 transition-all duration-300"
      />
    </div>
  );

  const Select = ({ label, value, options, onChange }: {
    label: string; value: string;
    options: string[];
    onChange: (v: string) => void;
  }) => (
    <div className="space-y-1.5">
      <label className="text-[10px] tracking-[3px] uppercase text-jarvis-cyan/50">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-black/30 border border-jarvis-border/40 rounded-lg px-3 py-2.5 text-sm font-mono focus:border-jarvis-cyan/50 transition-all"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o.toUpperCase()}</option>
        ))}
      </select>
    </div>
  );

  return (
    <main className="w-full min-h-screen text-jarvis-cyan p-6 font-mono bg-jarvis-ambient">
      <div className="max-w-xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-lg font-bold tracking-widest text-glow">SETTINGS</h1>
            <p className="text-[9px] tracking-[4px] text-jarvis-cyan/40 mt-1">SYSTEM CONFIGURATION</p>
          </div>
          {saved && (
            <span className="text-[10px] tracking-widest text-jarvis-green glow-green px-3 py-1 rounded-full glass-base border-jarvis-green/30 transition-all duration-300">
              ✓ SAVED
            </span>
          )}
        </div>

        <div className="space-y-4">
          <Section title="Connection" icon="◈">
            <Input
              label="Backend API URL"
              value={settings.apiUrl}
              onChange={(v) => setSettings(s => ({ ...s, apiUrl: v }))}
              placeholder="http://localhost:8000"
            />
            <div className="flex items-center justify-between">
              <span className="text-[10px] tracking-[3px] uppercase text-jarvis-cyan/50">Auto-Connect on startup</span>
              <button
                onClick={() => setSettings(s => ({ ...s, autoConnect: !s.autoConnect }))}
                className={`w-10 h-5 rounded-full relative transition-all duration-300 ${
                  settings.autoConnect ? 'bg-jarvis-cyan/30' : 'bg-gray-700'
                }`}
              >
                <span
                  className={`absolute top-[2px] w-4 h-4 rounded-full transition-all duration-300 ${
                    settings.autoConnect ? 'left-[22px] bg-jarvis-cyan shadow-[0_0_8px_rgba(0,242,255,0.6)]' : 'left-[2px] bg-gray-400'
                  }`}
                />
              </button>
            </div>
          </Section>

          <Section title="AI Model" icon="◉">
            <Select
              label="LLM Provider"
              value={settings.llmProvider}
              options={['ollama', 'bedrock', 'lm-studio']}
              onChange={(v) => setSettings(s => ({ ...s, llmProvider: v }))}
            />
            <Input
              label="Model Name"
              value={settings.modelName}
              onChange={(v) => setSettings(s => ({ ...s, modelName: v }))}
              placeholder="llama3.2, claude-sonnet, etc."
            />
          </Section>

          <Section title="Appearance" icon="◐">
            <Select
              label="Theme"
              value={settings.theme}
              options={['dark', 'system']}
              onChange={(v) => setSettings(s => ({ ...s, theme: v as Settings['theme'] }))}
            />
          </Section>

          <Section title="Maintenance" icon="◊">
            <div className="flex justify-between items-center">
              <div className="space-y-1">
                <span className="text-sm">Local Cache</span>
                <p className="text-[10px] opacity-50">Size: {cacheSize}</p>
              </div>
              <button
                onClick={clearCache}
                className="px-4 py-2 text-xs tracking-wider border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/10 hover:border-red-500/60 transition-all duration-300"
              >
                CLEAR
              </button>
            </div>
          </Section>

          <Section title="System" icon="◎">
            <div className="grid grid-cols-2 gap-4">
              {[
                ['App Version', '2.0.0'],
                ['Frontend', 'Next.js 14'],
                ['Backend', 'FastAPI'],
                ['Storage', 'PostgreSQL'],
              ].map(([label, value]) => (
                <div key={label} className="space-y-1">
                  <span className="text-[10px] tracking-[3px] text-jarvis-cyan/40">{label.toUpperCase()}</span>
                  <p className="text-sm text-glow">{value}</p>
                </div>
              ))}
            </div>
          </Section>

          <button
            onClick={saveSettings}
            className="w-full btn-gradient-cyan py-3 rounded-xl text-sm font-bold tracking-[3px] glow-cyan transition-all duration-300 hover:shadow-[0_0_30px_rgba(0,242,255,0.3)]"
          >
            SAVE CONFIGURATION
          </button>
        </div>
      </div>
    </main>
  );
}
