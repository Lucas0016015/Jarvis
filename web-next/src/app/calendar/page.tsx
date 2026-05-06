'use client';

import { useEffect, useState, useCallback } from 'react';

interface Event {
  id: string;
  title: string;
  start_datetime: string;
  end_datetime: string;
  description: string;
  location: string;
}

export default function CalendarPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState<Event | null>(null);
  const [form, setForm] = useState({
    title: '',
    start: '',
    end: '',
    description: '',
    location: '',
  });

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/calendar?upcoming_only=true');
      const data = await res.json();
      setEvents(data);
    } catch {
      console.error('Failed to load events');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const formatDate = (dt: string) => {
    try {
      const d = new Date(dt);
      return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
    } catch {
      return dt;
    }
  };

  const formatTime = (dt: string) => (dt?.length >= 16 ? dt.slice(11, 16) : dt);

  const toIso = (dt: string) => new Date(dt).toISOString();

  const handleCreate = async () => {
    if (!form.title.trim() || !form.start || !form.end) return;
    try {
      await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          start_datetime: toIso(form.start),
          end_datetime: toIso(form.end),
          description: form.description || undefined,
          location: form.location || undefined,
        }),
      });
      setForm({ title: '', start: '', end: '', description: '', location: '' });
      setIsCreating(false);
      loadEvents();
    } catch {
      console.error('Failed to create event');
    }
  };

  const handleUpdate = async () => {
    if (!isEditing || !form.title.trim() || !form.start || !form.end) return;
    try {
      await fetch(`/api/calendar/${isEditing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          start_datetime: toIso(form.start),
          end_datetime: toIso(form.end),
          description: form.description || undefined,
          location: form.location || undefined,
        }),
      });
      setIsEditing(null);
      setForm({ title: '', start: '', end: '', description: '', location: '' });
      loadEvents();
    } catch {
      console.error('Failed to update event');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await fetch(`/api/calendar/${id}`, { method: 'DELETE' });
      loadEvents();
    } catch {
      console.error('Failed to delete event');
    }
  };

  const openEdit = (e: Event) => {
    setIsEditing(e);
    setForm({
      title: e.title,
      start: e.start_datetime?.slice(0, 16) || '',
      end: e.end_datetime?.slice(0, 16) || '',
      description: e.description || '',
      location: e.location || '',
    });
  };

  const openCreate = () => {
    const now = new Date();
    const inHour = new Date(now.getTime() + 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().slice(0, 16);
    setForm({ title: '', start: fmt(now), end: fmt(inHour), description: '', location: '' });
    setIsCreating(true);
  };

  return (
    <main className="w-full min-h-screen text-jarvis-cyan p-6 font-mono bg-jarvis-ambient">
      <div className="max-w-xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-lg font-bold tracking-widest text-glow">CALENDAR</h1>
            <p className="text-[9px] tracking-[4px] text-jarvis-cyan/40 mt-1">TEMPORAL STREAM INTERFACE</p>
          </div>
          <button onClick={openCreate} className="btn-gradient-cyan px-4 py-1.5 rounded-xl text-xs tracking-wider font-semibold glow-cyan">+ NEW</button>
        </div>

        {(isCreating || isEditing) && (
          <div className="glass-strong neon-border p-5 rounded-xl mb-6 space-y-4">
            <h2 className="text-sm font-bold tracking-widest text-glow">{isEditing ? 'EDIT EVENT' : 'NEW EVENT'}</h2>
            <input
              value={form.title}
              onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Event title..."
              className="w-full bg-black/30 border border-jarvis-border/40 rounded-lg px-3 py-2 text-sm font-mono placeholder:text-gray-600"
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] tracking-[3px] uppercase text-jarvis-cyan/50 mb-1 block">Start</label>
                <input
                  type="datetime-local"
                  value={form.start}
                  onChange={(e) => setForm(f => ({ ...f, start: e.target.value }))}
                  className="w-full bg-black/30 border border-jarvis-border/40 rounded-lg px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] tracking-[3px] uppercase text-jarvis-cyan/50 mb-1 block">End</label>
                <input
                  type="datetime-local"
                  value={form.end}
                  onChange={(e) => setForm(f => ({ ...f, end: e.target.value }))}
                  className="w-full bg-black/30 border border-jarvis-border/40 rounded-lg px-3 py-2 text-sm font-mono"
                />
              </div>
            </div>
            <input
              value={form.location}
              onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))}
              placeholder="Location (optional)..."
              className="w-full bg-black/30 border border-jarvis-border/40 rounded-lg px-3 py-2 text-sm font-mono placeholder:text-gray-600"
            />
            <textarea
              value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Description (optional)..."
              rows={3}
              className="w-full bg-black/30 border border-jarvis-border/40 rounded-lg px-3 py-2 text-sm font-mono placeholder:text-gray-600 resize-none"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => { setIsCreating(false); setIsEditing(null); }} className="px-4 py-1.5 text-xs glass-base rounded-lg hover:border-gray-500/40 transition-all">Cancel</button>
              <button onClick={isEditing ? handleUpdate : handleCreate} className="btn-gradient-cyan px-6 py-1.5 rounded-lg text-xs font-semibold glow-cyan tracking-wider">{isEditing ? 'UPDATE' : 'CREATE'}</button>
            </div>
          </div>
        )}

        {loading && (
          <div className="text-center py-12 opacity-50">
            <div className="w-32 h-[1px] bg-jarvis-cyan/20 mx-auto mb-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 h-full bg-jarvis-cyan animate-[loadbar_1.5s_ease-in-out_infinite]" />
            </div>
            <span className="text-xs tracking-widest">SYNCING NEURAL DATA...</span>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {events.map((e) => (
            <div
              key={e.id}
              className="glass-base neon-border p-4 rounded-xl hover:border-jarvis-cyan/40 transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,242,255,0.1)] group"
            >
              <div className="flex items-start gap-4">
                <div className="flex flex-col items-center justify-center w-14 h-14 rounded-lg bg-jarvis-cyan/5 border border-jarvis-cyan/20 shrink-0">
                  <span className="text-[10px] opacity-60">{formatDate(e.start_datetime).split(' ')[0]}</span>
                  <span className="text-sm font-bold text-glow">{formatDate(e.start_datetime).split(' ')[1]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="text-sm font-semibold text-glow">{e.title}</h3>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(e)} className="text-[10px] px-2 py-1 glass-base rounded hover:text-jarvis-cyan transition-colors">Edit</button>
                      <button onClick={() => handleDelete(e.id)} className="text-[10px] px-2 py-1 glass-base rounded hover:text-red-400 transition-colors">Delete</button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] opacity-50 mb-2">
                    <span>{formatTime(e.start_datetime)}</span>
                    <span>→</span>
                    <span>{formatTime(e.end_datetime)}</span>
                  </div>
                  {e.description && <p className="text-xs opacity-60 mb-1">{e.description}</p>}
                  {e.location && <span className="text-[9px] opacity-40">📍 {e.location}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>

        {events.length === 0 && !loading && (
          <div className="text-center py-16 opacity-30">
            <div className="text-3xl mb-4">◐</div>
            <p className="text-xs tracking-widest">NO UPCOMING EVENTS</p>
            <p className="text-[10px] mt-2 opacity-60">Temporal stream clear</p>
          </div>
        )}
      </div>
    </main>
  );
}
