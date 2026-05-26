'use client';

import React, { useState, useEffect, useRef, ChangeEvent } from 'react';
import { Upload, FileText, Trash2, HelpCircle, AlertCircle, Sparkles, CheckCircle, RefreshCw } from 'lucide-react';
import { useJarvisStore } from '@/store/jarvisStore';
import { cn } from '@/lib/utils';

interface RailwayFile {
  key: string;
  size: number;
  last_modified: string;
  filename?: string;
}

export default function FilesModePanel() {
  const [files, setFiles] = useState<RailwayFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { setScreen, setChatInput } = useJarvisStore();

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/files/list');
      if (!res.ok) throw new Error('No se pudo conectar al almacenamiento de Railway');
      const data = await res.json();
      setFiles(data.files || []);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Error al listar archivos');
      // Mock data fallback if Railway Bucket is not connected
      setFiles([
        { key: 'chat_attachments/2026/05/25/ejemplo_reporte.pdf', size: 1245000, last_modified: new Date().toISOString() },
        { key: 'chat_attachments/2026/05/25/datos_ventas.csv', size: 45000, last_modified: new Date().toISOString() },
        { key: 'chat_attachments/2026/05/25/prompt_system.txt', size: 8500, last_modified: new Date().toISOString() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    setUploading(true);
    setUploadSuccess(null);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', 'railway_uploads');
    formData.append('generate_url', 'true');

    try {
      const res = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Error al subir archivo');
      }

      setUploadSuccess(`¡${file.name} subido con éxito!`);
      await fetchFiles();
      setTimeout(() => setUploadSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Error al subir archivo. Verifica tu bucket de Railway.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteFile = async (key: string) => {
    if (!confirm('¿Estás seguro de eliminar este archivo del bucket de Railway?')) return;
    
    try {
      const res = await fetch(`/api/files/${encodeURIComponent(key)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Error al eliminar archivo');
      
      setFiles(prev => prev.filter(f => f.key !== key));
    } catch (err: any) {
      alert(err.message || 'No se pudo eliminar el archivo');
    }
  };

  const handleAnalyzeFile = (file: RailwayFile) => {
    const filename = file.key.split('/').pop() || file.key;
    
    // Switch to Chat Screen
    setScreen('chat');
    
    // Put prompt in input to analyze it
    setChatInput(`Por favor, analiza este archivo: "${filename}". Haz un resumen de sus puntos clave y explícamelo.`);
    
    // We add the file as attachment in the Zustand store by getting current session
    // Since attachments are bound during send, we can put it in the store or simulate it.
    // In our ChatModePanel, it uploads files from state.
    // Let's make sure the chat input lets the AI know which file key to use.
    // We can also prepend the file context directly or trigger the AI.
    // Let's set a temporary attachment context in the store or let the user know.
    // To make it super robust, we pass the file key so the backend picks it up.
    // We can add a message about analyzing the uploaded file.
    const mockAttachment = {
      key: file.key,
      filename: filename,
      size: file.size,
      content_type: 'application/octet-stream'
    };
    
    // Store attachments in Zustand store if needed, or prefill chat input
    // To make it easy, since we pre-fill the chat input asking about it,
    // let's also save this file as a temporary attachment in localStorage so ChatModePanel can pick it up!
    localStorage.setItem('jarvis_pending_attachment', JSON.stringify(mockAttachment));
  };

  const getFileIcon = (key: string) => {
    return <FileText className="w-5 h-5 text-cyan-400" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="flex flex-col h-full p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 shrink-0">
        <div>
          <h2 className="text-base font-bold text-white tracking-wide">Archivos de Railway</h2>
          <p className="text-[10px] text-white/40">Importa documentos para análisis de la IA</p>
        </div>
        <button 
          onClick={fetchFiles}
          className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] text-white/50 active:scale-95 transition-all"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Upload Box */}
      <div 
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "border border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2",
          uploading 
            ? "border-cyan-400/50 bg-cyan-400/[0.02]" 
            : "border-white/[0.1] bg-white/[0.02] hover:border-cyan-400/30 hover:bg-white/[0.04]"
        )}
      >
        <input 
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileUpload}
          accept=".pdf,.txt,.md,.csv,.json,.py,.js,.ts,.html,.css,.xml,.yaml,.yml"
          disabled={uploading}
        />
        {uploading ? (
          <>
            <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mb-1" />
            <p className="text-xs text-cyan-300 font-medium">Subiendo al bucket de Railway...</p>
            <p className="text-[10px] text-white/30">Procesando metadatos de almacenamiento</p>
          </>
        ) : (
          <>
            <div className="p-3 bg-cyan-400/10 rounded-full text-cyan-400">
              <Upload className="w-6 h-6 animate-pulse" />
            </div>
            <p className="text-xs text-white/80 font-semibold">Subir nuevo documento</p>
            <p className="text-[10px] text-white/30">PDF, TXT, MD, CSV, JSON (Máx. 50MB)</p>
          </>
        )}
      </div>

      {/* Messages */}
      {uploadSuccess && (
        <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl p-3 text-xs animate-fade-in">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{uploadSuccess}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl p-3 text-xs animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1 leading-snug">{error}</span>
        </div>
      )}

      {/* Files List */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5">
        <h3 className="text-[10px] tracking-wider uppercase text-white/30 font-semibold px-1">
          Archivos Disponibles ({files.length})
        </h3>

        {loading ? (
          <div className="space-y-2 py-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 rounded-xl bg-white/[0.02] border border-white/[0.04] animate-pulse" />
            ))}
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-12 border border-white/[0.04] rounded-2xl bg-white/[0.01]">
            <HelpCircle className="w-8 h-8 text-white/10 mx-auto mb-2" />
            <p className="text-xs text-white/30">No hay archivos en el bucket de Railway.</p>
            <p className="text-[10px] text-white/20 mt-1">Sube un archivo para habilitar el análisis de IA.</p>
          </div>
        ) : (
          files.map((file) => {
            const filename = file.key.split('/').pop() || file.key;
            return (
              <div 
                key={file.key}
                className="glass-base rounded-2xl p-3 flex items-center justify-between gap-3 group hover:glass-hover transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 bg-white/[0.03] rounded-xl border border-white/[0.06] shrink-0">
                    {getFileIcon(file.key)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white/90 truncate pr-2" title={filename}>
                      {filename}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-white/30 mt-0.5">
                      <span>{formatSize(file.size)}</span>
                      <span>•</span>
                      <span className="truncate max-w-[100px]">
                        {new Date(file.last_modified).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button 
                    onClick={() => handleAnalyzeFile(file)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-bold text-cyan-300 bg-cyan-400/10 hover:bg-cyan-400/20 active:scale-95 transition-all border border-cyan-400/20"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Analizar</span>
                  </button>
                  <button 
                    onClick={() => handleDeleteFile(file.key)}
                    className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-red-500/10 hover:border-red-500/20 text-white/20 hover:text-red-400 active:scale-95 transition-all"
                    title="Eliminar archivo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
