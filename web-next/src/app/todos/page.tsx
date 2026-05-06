'use client';

import { useEffect, useState, useCallback } from 'react';

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  due_date: string | null;
  created_at: string;
}

const priorityConfig = {
  low:    { color: '#00ff88', glow: 'shadow-[0_0_8px_rgba(0,255,136,0.3)]', label: 'LOW' },
  medium: { color: '#ffaa00', glow: 'shadow-[0_0_8px_rgba(255,170,0,0.3)]', label: 'MED' },
  high:   { color: '#ff4444', glow: 'shadow-[0_0_8px_rgba(255,68,68,0.3)]', label: 'HIGH' },
};

export default function TodosPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('active');
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState<Todo | null>(null);
  const [form, setForm] = useState({ text: '', priority: 'medium' as Todo['priority'], due_date: '' });

  const loadTodos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/todos?show_completed=${filter === 'completed'}`);
      const data = await res.json();
      setTodos(data);
    } catch {
      console.error('Failed to load todos');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { loadTodos(); }, [loadTodos]);

  const handleCreate = async () => {
    if (!form.text.trim()) return;
    try {
      await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, due_date: form.due_date || null }),
      });
      setForm({ text: '', priority: 'medium', due_date: '' });
      setIsCreating(false);
      loadTodos();
    } catch {
      console.error('Failed to create todo');
    }
  };

  const handleUpdate = async () => {
    if (!isEditing || !form.text.trim()) return;
    try {
      await fetch(`/api/todos/${isEditing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, due_date: form.due_date || null }),
      });
      setIsEditing(null);
      setForm({ text: '', priority: 'medium', due_date: '' });
      loadTodos();
    } catch {
      console.error('Failed to update todo');
    }
  };

  const toggleComplete = async (id: string) => {
    try {
      await fetch(`/api/todos/${id}/complete`, { method: 'PATCH' });
      loadTodos();
    } catch {
      console.error('Failed to toggle todo');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await fetch(`/api/todos/${id}`, { method: 'DELETE' });
      loadTodos();
    } catch {
      console.error('Failed to delete todo');
    }
  };

  const openEdit = (todo: Todo) => {
    setIsEditing(todo);
    setForm({
      text: todo.text,
      priority: todo.priority,
      due_date: todo.due_date?.slice(0, 10) || '',
    });
  };

  const allTodos = todos;
  const activeCount = allTodos.filter(t => !t.completed).length;
  const completedCount = allTodos.filter(t => t.completed).length;

  return (
    <main className="w-full min-h-screen text-jarvis-cyan p-6 font-mono bg-jarvis-ambient">
      <div className="max-w-xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-lg font-bold tracking-widest text-glow">TAREAS</h1>
            <p className="text-[9px] tracking-[4px] text-jarvis-cyan/40 mt-1">NEURAL TASK MANAGER</p>
          </div>
          <button onClick={() => setIsCreating(true)} className="btn-gradient-cyan px-4 py-1.5 rounded-xl text-xs tracking-wider font-semibold glow-cyan">
            + NEW
          </button>
        </div>

        <div className="flex gap-2 mb-6">
          {[['all', 'ALL', allTodos.length], ['active', 'ACTIVE', activeCount], ['completed', 'DONE', completedCount]].map(([key, label, count]) => (
            <button
              key={key}
              onClick={() => setFilter(key as typeof filter)}
              className={`flex-1 py-2 text-[10px] tracking-widest font-semibold rounded-lg transition-all duration-300 ${
                filter === key
                  ? 'glass-strong neon-border text-jarvis-cyan glow-cyan'
                  : 'glass-base text-gray-500 hover:text-jarvis-cyan/60'
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </div>

        {(isCreating || isEditing) && (
          <div className="glass-strong neon-border p-5 rounded-xl mb-6 space-y-4">
            <h2 className="text-sm font-bold tracking-widest text-glow">{isEditing ? 'EDIT TASK' : 'NEW TASK'}</h2>
            <input
              value={form.text}
              onChange={(e) => setForm(f => ({ ...f, text: e.target.value }))}
              placeholder="Task description..."
              className="w-full bg-black/30 border border-jarvis-border/40 rounded-lg px-3 py-2 text-sm font-mono placeholder:text-gray-600"
            />
            <div className="flex gap-3">
              <select
                value={form.priority}
                onChange={(e) => setForm(f => ({ ...f, priority: e.target.value as Todo['priority'] }))}
                className="flex-1 bg-black/30 border border-jarvis-border/40 rounded-lg px-3 py-2 text-sm font-mono"
              >
                <option value="low">LOW PRIORITY</option>
                <option value="medium">MEDIUM PRIORITY</option>
                <option value="high">HIGH PRIORITY</option>
              </select>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm(f => ({ ...f, due_date: e.target.value }))}
                className="bg-black/30 border border-jarvis-border/40 rounded-lg px-3 py-2 text-sm font-mono"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setIsCreating(false); setIsEditing(null); }} className="px-4 py-1.5 text-xs glass-base rounded-lg hover:border-gray-500/40 transition-all">Cancel</button>
              <button onClick={isEditing ? handleUpdate : handleCreate} className="btn-gradient-cyan px-6 py-1.5 rounded-lg text-xs font-semibold glow-cyan tracking-wider">
                {isEditing ? 'UPDATE' : 'CREATE'}
              </button>
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
          {todos.map((t) => {
            const cfg = priorityConfig[t.priority];
            return (
              <div
                key={t.id}
                className={`group flex items-center gap-4 glass-base neon-border p-4 rounded-xl hover:border-jarvis-cyan/40 transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,242,255,0.1)] ${
                  t.completed ? 'opacity-50' : ''
                }`}
              >
                <button
                  onClick={() => toggleComplete(t.id)}
                  className="shrink-0"
                >
                  <div
                    className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${
                      t.completed
                        ? 'bg-jarvis-green border-jarvis-green'
                        : 'border-jarvis-cyan/40 hover:border-jarvis-cyan'
                    }`}
                    style={t.completed ? { boxShadow: '0 0 8px rgba(0,255,136,0.5)' } : {}}
                  >
                    {t.completed && <svg className="w-2.5 h-2.5 mx-auto mt-0.5" viewBox="0 0 20 20"><path fill="currentColor" d="M0 11l2-2 5 5L18 3l2 2L7 18z"/></svg>}
                  </div>
                </button>

                <div className="flex-1 min-w-0">
                  <div className={`text-sm mb-1.5 ${t.completed ? 'line-through opacity-40' : ''}`}>
                    {t.text}
                  </div>
                  <div className="flex items-center gap-3 text-[10px]">
                    <span
                      className={`px-2 py-0.5 rounded-full ${cfg.glow}`}
                      style={{ color: cfg.color, border: `1px solid ${cfg.color}40` }}
                    >
                      {cfg.label}
                    </span>
                    {t.due_date && (
                      <span className="opacity-40" style={new Date(t.due_date) < new Date() ? { color: '#ff4444' } : {}}>
                        {new Date(t.due_date) < new Date() ? 'OVERDUE: ' : ''}{t.due_date.slice(0, 10)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => openEdit(t)} className="text-[10px] px-2 py-1 glass-base rounded hover:text-jarvis-cyan transition-colors">Edit</button>
                  <button onClick={() => handleDelete(t.id)} className="text-[10px] px-2 py-1 glass-base rounded hover:text-red-400 transition-colors">Delete</button>
                </div>
              </div>
            );
          })}
        </div>

        {todos.length === 0 && !loading && (
          <div className="text-center py-16 opacity-30">
            <div className="text-3xl mb-4">◊</div>
            <p className="text-xs tracking-widest">NO ACTIVE TASKS</p>
            <p className="text-[10px] mt-2 opacity-60">Neural queue empty — system idle</p>
          </div>
        )}
      </div>
    </main>
  );
}
