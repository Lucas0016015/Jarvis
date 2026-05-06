'use client';

import { useEffect, useState, useCallback } from 'react';

interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState<Note | null>(null);
  const [form, setForm] = useState({ title: '', content: '', tags: '' });

  const loadNotes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notes');
      const data = await res.json();
      setNotes(data);
    } catch {
      console.error('Failed to load notes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  const handleCreate = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    try {
      await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          content: form.content,
          tags: form.tags.split(',').map((t: string) => t.trim()).filter(Boolean),
        }),
      });
      setForm({ title: '', content: '', tags: '' });
      setIsCreating(false);
      loadNotes();
    } catch {
      console.error('Failed to create note');
    }
  };

  const handleUpdate = async () => {
    if (!isEditing || !form.title.trim() || !form.content.trim()) return;
    try {
      await fetch(`/api/notes/${isEditing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          content: form.content,
          tags: form.tags.split(',').map((t: string) => t.trim()).filter(Boolean),
        }),
      });
      setIsEditing(null);
      setForm({ title: '', content: '', tags: '' });
      loadNotes();
    } catch {
      console.error('Failed to update note');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await fetch(`/api/notes/${id}`, { method: 'DELETE' });
      loadNotes();
    } catch {
      console.error('Failed to delete note');
    }
  };

  const openEdit = (note: Note) => {
    setIsEditing(note);
    setForm({
      title: note.title,
      content: note.content,
      tags: note.tags?.join(', ') || '',
    });
  };

  const openCreate = () => {
    setForm({ title: '', content: '', tags: '' });
    setIsCreating(true);
  };

  return (
    <main className="w-full min-h-screen text-jarvis-cyan p-6 font-mono bg-jarvis-ambient">
      <div className="max-w-xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-lg font-bold tracking-widest text-glow">NOTES</h1>
            <p className="text-[9px] tracking-[4px] text-jarvis-cyan/40 mt-1">KNOWLEDGE BASE INTERFACE</p>
          </div>
          <div className="flex gap-3">
            <span className="text-[10px] opacity-50 glass-base px-3 py-1 rounded-full">{notes.length} entries</span>
            <button onClick={openCreate} className="btn-gradient-cyan px-4 py-1.5 rounded-xl text-xs tracking-wider font-semibold glow-cyan">+ NEW</button>
          </div>
        </div>

        {(isCreating || isEditing) && (
          <div className="glass-strong neon-border p-5 rounded-xl mb-6 space-y-4">
            <h2 className="text-sm font-bold tracking-widest text-glow">{isEditing ? 'EDIT NOTE' : 'NEW NOTE'}</h2>
            <input
              value={form.title}
              onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Title..."
              className="w-full bg-black/30 border border-jarvis-border/40 rounded-lg px-3 py-2 text-sm font-mono placeholder:text-gray-600"
            />
            <textarea
              value={form.content}
              onChange={(e) => setForm(f => ({ ...f, content: e.target.value }))}
              placeholder="Write your note..."
              rows={5}
              className="w-full bg-black/30 border border-jarvis-border/40 rounded-lg px-3 py-2 text-sm font-mono placeholder:text-gray-600 resize-none"
            />
            <input
              value={form.tags}
              onChange={(e) => setForm(f => ({ ...f, tags: e.target.value }))}
              placeholder="Tags (comma separated...)"
              className="w-full bg-black/30 border border-jarvis-border/40 rounded-lg px-3 py-2 text-sm font-mono placeholder:text-gray-600"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setIsCreating(false); setIsEditing(null); }}
                className="px-4 py-1.5 text-xs glass-base rounded-lg hover:border-gray-500/40 transition-all"
              >Cancel</button>
              <button
                onClick={isEditing ? handleUpdate : handleCreate}
                className="btn-gradient-cyan px-6 py-1.5 rounded-lg text-xs font-semibold glow-cyan tracking-wider"
              >{isEditing ? 'UPDATE' : 'CREATE'}</button>
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
          {notes.map((n: Note) => (
            <div
              key={n.id}
              className="glass-base neon-border p-4 rounded-xl hover:border-jarvis-cyan/40 transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,242,255,0.1)] group"
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-sm font-semibold text-glow">{n.title}</h3>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(n)} className="text-[10px] px-2 py-1 glass-base rounded hover:text-jarvis-cyan transition-colors">Edit</button>
                  <button onClick={() => handleDelete(n.id)} className="text-[10px] px-2 py-1 glass-base rounded hover:text-red-400 transition-colors">Delete</button>
                </div>
              </div>
              <p className="text-xs opacity-70 mb-3 leading-relaxed">{n.content}</p>
              <div className="flex gap-2">
                {n.tags?.map((t: string) => (
                  <span
                    key={t}
                    className="text-[9px] px-2 py-0.5 rounded-full border border-jarvis-cyan/30 text-jarvis-cyan/70 hover:border-jarvis-cyan/60 hover:text-jarvis-cyan transition-colors"
                    style={{ boxShadow: '0 0 6px rgba(0,242,255,0.08)' }}
                  >{t}</span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {notes.length === 0 && !loading && (
          <div className="text-center py-16 opacity-30">
            <div className="text-3xl mb-4">◉</div>
            <p className="text-xs tracking-widest">NO ENTRIES FOUND</p>
            <p className="text-[10px] mt-2 opacity-60">Knowledge base awaiting input</p>
          </div>
        )}
      </div>
    </main>
  );
}
