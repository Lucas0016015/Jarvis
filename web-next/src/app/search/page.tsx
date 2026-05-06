'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface SearchResult {
  type: 'todo' | 'note' | 'event' | 'email';
  id: string;
  title: string;
  snippet: string;
  meta: string;
  date?: string;
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | SearchResult['type']>('all');
  const [stats, setStats] = useState({ todos: 0, notes: 0, events: 0, emails: 0 });

  const loadStats = useCallback(async () => {
    try {
      const [t, n, e, m] = await Promise.all([
        fetch('/api/todos?show_completed=true').then(r => r.json()).catch(() => []),
        fetch('/api/notes').then(r => r.json()).catch(() => []),
        fetch('/api/calendar?upcoming_only=false').then(r => r.json()).catch(() => []),
        fetch('/api/emails?max=1').then(r => r.json()).catch(() => []),
      ]);
      setStats({
        todos: Array.isArray(t) ? t.length : 0,
        notes: Array.isArray(n) ? n.length : 0,
        events: Array.isArray(e) ? e.length : 0,
        emails: Array.isArray(m) ? m.length : 0,
      });
    } catch { console.error('Failed to load stats'); }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  const performSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    const lower = q.toLowerCase();
    const allResults: SearchResult[] = [];

    try {
      const [todos, notes, events, emails] = await Promise.all([
        fetch('/api/todos?show_completed=true').then(r => r.json()).catch(() => []),
        fetch('/api/notes').then(r => r.json()).catch(() => []),
        fetch('/api/calendar?upcoming_only=false').then(r => r.json()).catch(() => []),
        fetch('/api/emails?max=50').then(r => r.json()).catch(() => []),
      ]);

      for (const t of todos || []) {
        if (t.text?.toLowerCase().includes(lower) || t.priority?.includes(lower))
          allResults.push({ type: 'todo', id: t.id, title: t.text, snippet: `Priority: ${t.priority}${t.due_date ? ' | Due: ' + t.due_date.slice(0, 10) : ''}`, meta: t.completed ? '✓ Done' : '◊ Active', date: t.created_at });
      }
      for (const n of notes || []) {
        if (n.title?.toLowerCase().includes(lower) || n.content?.toLowerCase().includes(lower))
          allResults.push({ type: 'note', id: n.id, title: n.title, snippet: n.content?.slice(0, 100), meta: n.tags?.join(', ') || '', date: n.updated_at });
      }
      for (const e of events || []) {
        if (e.title?.toLowerCase().includes(lower) || e.description?.toLowerCase().includes(lower) || e.location?.toLowerCase().includes(lower))
          allResults.push({ type: 'event', id: e.id, title: e.title, snippet: e.description || '', meta: e.location || '', date: e.start_datetime });
      }
      for (const m of emails || []) {
        if (m.subject?.toLowerCase().includes(lower) || m.snippet?.toLowerCase().includes(lower) || m.sender?.toLowerCase().includes(lower))
          allResults.push({ type: 'email', id: m.id, title: m.subject || '(No Subject)', snippet: m.snippet || '', meta: m.sender || '', date: m.received_at });
      }
    } catch { console.error('Search failed'); } finally { setLoading(false); }

    setResults(allResults);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => performSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query, performSearch]);

  const filtered = activeFilter === 'all' ? results : results.filter(r => r.type === activeFilter);

  const typeColors = {
    todo: '#00ff88',
    note: '#00f2ff',
    event: '#ffaa00',
    email: '#ff4488',
  };

  const typeLabels = {
    todo: '◊ TODO',
    note: '◉ NOTE',
    event: '◐ EVENT',
    email: '◎ EMAIL',
  };

  return (
    <main className="w-full min-h-screen text-jarvis-cyan p-6 font-mono bg-jarvis-ambient">
      <div className="max-w-xl mx-auto">
        <div className="mb-8">
          <h1 className="text-lg font-bold tracking-widest text-glow mb-1">GLOBAL SEARCH</h1>
          <p className="text-[9px] tracking-[4px] text-jarvis-cyan/40">NEURAL KNOWLEDGE RETRIEVAL</p>
        </div>

        <div className="glass-strong neon-border rounded-xl p-1 mb-6 flex items-center gap-2">
          <span className="text-jarvis-cyan/40 pl-3 text-sm">◈</span>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search across all data..."
            className="flex-1 bg-transparent border-none outline-none text-sm font-mono placeholder:text-gray-600 py-3 px-2"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-gray-500 hover:text-jarvis-cyan text-xs pr-3 transition-colors">✕</button>
          )}
        </div>

        {!query && (
          <div className="grid grid-cols-4 gap-3 mb-8">
            {[
              { type: 'todos' as const, label: 'TODOS', count: stats.todos, icon: '◊', color: '#00ff88', href: '/todos' },
              { type: 'notes' as const, label: 'NOTES', count: stats.notes, icon: '◉', color: '#00f2ff', href: '/notes' },
              { type: 'events' as const, label: 'EVENTS', count: stats.events, icon: '◐', color: '#ffaa00', href: '/calendar' },
              { type: 'emails' as const, label: 'EMAILS', count: stats.emails, icon: '◎', color: '#ff4488', href: '/emails' },
            ].map((s) => (
              <Link key={s.type} href={s.href}
                className="glass-base neon-border p-3 rounded-xl text-center hover:border-jarvis-cyan/40 transition-all duration-300"
              >
                <div className="text-xl mb-1" style={{ color: s.color, textShadow: `0 0 10px ${s.color}40` }}>{s.icon}</div>
                <div className="text-[10px] tracking-wider opacity-60">{s.label}</div>
                <div className="text-lg font-bold text-glow" style={{ color: s.color }}>{s.count}</div>
              </Link>
            ))}
          </div>
        )}

        {query && (
          <div className="flex gap-2 mb-4 flex-wrap">
            {([['all', 'ALL', results.length], ['todo', 'TODOS', results.filter(r => r.type === 'todo').length], ['note', 'NOTES', results.filter(r => r.type === 'note').length], ['event', 'EVENTS', results.filter(r => r.type === 'event').length], ['email', 'EMAILS', results.filter(r => r.type === 'email').length]] as [string, string, number][]).map(([key, label, count]) => (
              <button
                key={key}
                onClick={() => setActiveFilter(key as typeof activeFilter)}
                className={`px-3 py-1.5 text-[10px] tracking-wider rounded-lg transition-all duration-300 ${
                  activeFilter === key
                    ? 'glass-strong neon-border glow-cyan text-jarvis-cyan'
                    : 'glass-base text-gray-500 hover:text-jarvis-cyan/60'
                }`}
              >{label} ({count})</button>
            ))}
          </div>
        )}

        {loading && (
          <div className="text-center py-12 opacity-50">
            <div className="w-32 h-[1px] bg-jarvis-cyan/20 mx-auto mb-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 h-full bg-jarvis-cyan animate-[loadbar_1.5s_ease-in-out_infinite]" />
            </div>
            <span className="text-xs tracking-widest">SEARCHING NEURAL INDEX...</span>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {filtered.map((r) => (
            <Link key={`${r.type}-${r.id}`} href={`/${r.type === 'event' ? 'calendar' : r.type === 'email' ? 'emails' : r.type + 's'}`}
              className="glass-base neon-border p-4 rounded-xl hover:border-jarvis-cyan/40 transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,242,255,0.1)]"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: typeColors[r.type], border: `1px solid ${typeColors[r.type]}40`, boxShadow: `0 0 6px ${typeColors[r.type]}20` }}>{typeLabels[r.type]}</span>
                  <h3 className="text-sm font-semibold text-glow">{r.title}</h3>
                </div>
                {r.date && <span className="text-[9px] opacity-40">{r.date?.slice(0, 16)}</span>}
              </div>
              {r.snippet && <p className="text-xs opacity-60 mb-1 line-clamp-2">{r.snippet}</p>}
              <span className="text-[9px] opacity-40">{r.meta}</span>
            </Link>
          ))}
        </div>

        {query && filtered.length === 0 && !loading && (
          <div className="text-center py-16 opacity-30">
            <div className="text-3xl mb-4">◈</div>
            <p className="text-xs tracking-widest">NO RESULTS</p>
            <p className="text-[10px] mt-2 opacity-60">Neural index returned 0 matches for "{query}"</p>
          </div>
        )}
      </div>
    </main>
  );
}
