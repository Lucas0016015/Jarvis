'use client';

import { useEffect, useState } from 'react';

interface Email {
  id: string;
  subject: string;
  sender: string;
  snippet: string;
  received_at: string;
}

export default function EmailsPage() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/emails?label=INBOX&max=10')
      .then((r) => r.json())
      .then((d) => { setEmails(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <main className="w-full min-h-screen text-jarvis-cyan p-6 font-mono bg-jarvis-ambient">
      <div className="max-w-xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-lg font-bold tracking-widest text-glow">CORREOS</h1>
            <p className="text-[9px] tracking-[4px] text-jarvis-cyan/40 mt-1">MESSAGE STREAM INTERFACE</p>
          </div>
          <span className="text-[10px] opacity-50 glass-base px-3 py-1 rounded-full">{emails.length} mensajes</span>
        </div>

        {loading && (
          <div className="text-center py-12 opacity-50">
            <div className="w-32 h-[1px] bg-jarvis-cyan/20 mx-auto mb-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 h-full bg-jarvis-cyan animate-[loadbar_1.5s_ease-in-out_infinite]" />
            </div>
            <span className="text-xs tracking-widest">SYNCING NEURAL DATA...</span>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {emails.map((e) => (
            <div 
              key={e.id} 
              className="glass-base neon-border p-4 rounded-xl hover:border-jarvis-cyan/40 transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,242,255,0.1)]"
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-sm font-semibold text-glow">{e.subject || '(Sin asunto)'}</h3>
                <span className="text-[9px] opacity-40">{e.received_at?.slice(0, 16)}</span>
              </div>
              <span className="text-xs opacity-60">{e.sender}</span>
              <p className="text-xs opacity-70 mt-2 leading-relaxed">{e.snippet}</p>
            </div>
          ))}
        </div>

        {emails.length === 0 && !loading && (
          <div className="text-center py-16 opacity-30">
            <div className="text-3xl mb-4">◎</div>
            <p className="text-xs tracking-widest">INBOX EMPTY</p>
            <p className="text-[10px] mt-2 opacity-60">Message stream idle</p>
          </div>
        )}
      </div>
    </main>
  );
}
