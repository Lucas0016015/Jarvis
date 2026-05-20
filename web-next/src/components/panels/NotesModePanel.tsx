'use client';

import React, { useState, useEffect } from 'react';
import { FileText, Trash2, Plus, Download } from 'lucide-react';
import { NoteCardSkeleton } from '@/components/Skeleton';

/* ── NotesModePanel ────────────────────────────────────────────────
   Card grid for notes with add/delete and Obsidian import.
   ───────────────────────────────────────────────────────────────────── */

interface Note {
  id: string; title: string; content: string; tags: string[]
}

const API = '/api';

export default function NotesModePanel() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotes = async () => {
    try {
      const res = await fetch(`${API}/notes`);
      if (!res.ok) throw new Error('Failed to fetch notes');
      const data = await res.json();
      if (!Array.isArray(data)) {
        throw new Error('Invalid response format');
      }
      setNotes(data);
      setError(null);
    } catch (e) {
      setError('Could not connect to backend');
      setNotes([
        { id: '1', title: 'Hologram Specs', content: 'Bloom threshold: 0, intensity: 2.0', tags: ['3d'] },
        { id: '2', title: 'API Endpoints', content: '/api/todos, /api/notes', tags: ['backend'] },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNotes(); }, []);

  const addNote = () => {
    if (!newTitle.trim()) return;
    const note = { id: crypto.randomUUID(), title: newTitle, content: newContent || '', tags: ['general'] };
    setNotes(prev => [...prev, note]);
    setNewTitle(''); setNewContent(''); setIsCreating(false);
    fetch(`${API}/notes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle, content: newContent || 'No content', tags: ['general'] }),
    }).catch(() => {});
  };

  const deleteNote = (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    fetch(`${API}/notes/${id}`, { method: 'DELETE' }).catch(() => {});
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header actions */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
        <span className="text-[9px] tracking-[0.2em] uppercase text-white/30">Neural Notes</span>
        <button
          onClick={() => {
            const path = prompt('Enter Obsidian vault path:');
            if (path) {
              fetch(`${API}/notes/import/obsidian`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vault_path: path }),
              }).then(r => r.json()).then(() => {
                alert('Import complete. Refreshing...');
                window.location.reload();
              });
            }
          }}
          className="flex items-center gap-1 text-[9px] text-cyan-400/60 hover:text-cyan-300 transition-colors"
        >
          <Download className="w-3 h-3" />
          Import Obsidian
        </button>
      </div>

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 scrollbar-hide">
        {loading && (
          <>
            <NoteCardSkeleton />
            <NoteCardSkeleton />
            <NoteCardSkeleton />
          </>
        )}
        {!loading && error && (
          <div className="text-center py-8 text-red-400/60 text-xs">{error}</div>
        )}
        {!loading && !error && notes.length === 0 && (
          <p className="text-xs text-white/20 text-center mt-8">No notes yet. Create your first neural note.</p>
        )}

        {notes.map((note) => (
          <div
            key={note.id}
            className="glass-base rounded-xl p-3.5 group transition-all hover:glass-hover"
          >
            <div className="flex items-start justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-cyan-400/50 shrink-0" />
                <h4 className="text-[13px] font-semibold text-cyan-300/90 truncate">{note.title}</h4>
              </div>
              <button
                onClick={() => deleteNote(note.id)}
                className="opacity-0 group-hover:opacity-100 p-1 text-white/15 hover:text-red-400 transition-all shrink-0"
                aria-label="Delete note"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[11px] text-white/40 leading-relaxed line-clamp-2 mb-2">{note.content}</p>
            <div className="flex gap-1.5 flex-wrap">
              {note.tags.map(tag => (
                <span
                  key={tag}
                  className="text-[9px] tracking-wider uppercase px-2 py-0.5 rounded-full border border-cyan-400/10 text-cyan-300/50"
                  style={{ background: 'rgba(0,212,255,0.04)' }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ))}

        {/* Add note form */}
        {isCreating ? (
          <div className="glass-strong rounded-xl p-3.5 space-y-2.5">
            <input
              value={newTitle} onChange={e=> setNewTitle(e.target.value)}
              placeholder="Note title..."
              autoFocus
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-white/90 outline-none placeholder:text-white/20 focus:border-cyan-400/30 btn-focus transition-all"
            />
            <textarea
              value={newContent} onChange={e=> setNewContent(e.target.value)}
              placeholder="Content..."
              rows={2}
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white/80 outline-none placeholder:text-white/15 focus:border-cyan-400/30 btn-focus resize-none transition-all"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setIsCreating(false)} className="px-3 py-1.5 rounded-lg text-[11px] text-white/30 hover:text-white/50 transition-colors">Cancel</button>
              <button onClick={addNote} className="px-3 py-1.5 rounded-lg text-[11px] btn-cyan">Save</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsCreating(true)}
            className="w-full py-3 rounded-xl border border-dashed border-white/[0.08] text-white/20 hover:text-cyan-300/60 hover:border-cyan-400/20 transition-all text-[12px] tracking-wider flex items-center justify-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Add Neural Note
          </button>
        )}
      </div>
    </div>
  );
}
