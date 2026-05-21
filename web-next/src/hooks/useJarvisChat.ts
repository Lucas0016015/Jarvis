'use client';

import { useEffect, useState, useCallback } from 'react';
import { useJarvisStore } from '@/store/jarvisStore';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  toolCalls?: Array<{
    tool: string;
    input: Record<string, unknown>;
    output?: string;
  }>;
}

interface AppSettings {
  apiUrl: string;
  autoConnect: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001',
  autoConnect: true,
};

function loadSettings(): AppSettings {
  try {
    const stored = localStorage.getItem('jarvis_settings');
    return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/* ── Global WebSocket ──────────────────────────────────────────────── */
let globalWs: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export function useJarvisChat() {
  const store = useJarvisStore();
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [settings] = useState<AppSettings>(loadSettings);

  // Abrir WebSocket al montar (SOLO en browser)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    setStatus('connecting');
    store.setBackendStatus('connecting');

    const connect = () => {
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      if (globalWs) { globalWs.close(); globalWs = null; }

      const apiUrl = settings.apiUrl;
      const wsProtocol = apiUrl.startsWith('https') ? 'wss' : 'ws';
      const wsHost = apiUrl.replace(/^https?:\/\//, '');
      const wsUrl = `${wsProtocol}://${wsHost}/api/v1/ws/chat`;
      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl);
      } catch (e) {
        setStatus('error');
        store.setBackendStatus('error');
        return;
      }

      ws.onopen = () => {
        globalWs = ws;
        setStatus('connected');
        store.setBackendStatus('connected');
      };

      ws.onclose = () => {
        globalWs = null;
        setStatus('disconnected');
        store.setBackendStatus('disconnected');
        if (settings.autoConnect) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => {
        setStatus('error');
        store.setBackendStatus('error');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'token' && data.content) {
            const msgs = useJarvisStore.getState().chatMessages;
            const last = msgs[msgs.length - 1];
            if (last && last.isStreaming && last.role === 'assistant') {
              const updated = { ...last, content: last.content + data.content };
              useJarvisStore.setState({ chatMessages: [...msgs.slice(0, -1), updated] });
              store.setLastAssistantText(updated.content);
            } else {
              const newMsg: ChatMessage = { id: makeId(), role: 'assistant', content: data.content, isStreaming: true };
              useJarvisStore.setState({ chatMessages: [...msgs, newMsg] });
              store.setLastAssistantText(data.content);
            }
          }

          if (data.type === 'tool_start') {
            store.setActivityState('thinking');
            const msgs = useJarvisStore.getState().chatMessages;
            const last = msgs[msgs.length - 1];
            if (last && last.role === 'assistant') {
              useJarvisStore.setState({
                chatMessages: [...msgs.slice(0, -1), {
                  ...last,
                  toolCalls: [...(last.toolCalls || []), { tool: data.tool_name, input: data.tool_input }],
                }]
              });
            }
          }

          if (data.type === 'tool_end') {
            const msgs = useJarvisStore.getState().chatMessages;
            const last = msgs[msgs.length - 1];
            if (last && last.role === 'assistant') {
              useJarvisStore.setState({
                chatMessages: [...msgs.slice(0, -1), {
                  ...last,
                  toolCalls: last.toolCalls?.map((tc, i) =>
                    i === (last.toolCalls?.length || 0) - 1
                      ? { ...tc, output: typeof data.tool_output === 'string' ? data.tool_output : JSON.stringify(data.tool_output) }
                      : tc
                  ),
                }]
              });
            }
          }

          if (data.type === 'done') {
            const msgs = useJarvisStore.getState().chatMessages;
            const last = msgs[msgs.length - 1];
            if (last && last.isStreaming) {
              useJarvisStore.setState({ chatMessages: [...msgs.slice(0, -1), { ...last, isStreaming: false }] });
              store.setLastAssistantText(last.content);
              store.setActivityState('idle');
              // Auto-TTS: hablar la respuesta si el panel de voz esta activo
              if (window.speechSynthesis && (window as any).__jarvisVoiceActive) {
                const utter = new SpeechSynthesisUtterance(last.content);
                utter.lang = 'es-ES';
                utter.rate = 1.0;
                const voices = window.speechSynthesis.getVoices();
                const es = voices.find((v) => v.lang?.startsWith('es'));
                if (es) utter.voice = es;
                window.speechSynthesis.cancel();
                window.speechSynthesis.speak(utter);
              }
            }
          }

          if (data.type === 'error') {
            const msgs = useJarvisStore.getState().chatMessages;
            const last = msgs[msgs.length - 1];
            if (last && last.isStreaming) {
              useJarvisStore.setState({
                chatMessages: [...msgs.slice(0, -1), {
                  ...last,
                  isStreaming: false,
                  content: last.content + `\n[Error: ${data.content}]`,
                }]
              });
            }
            store.setActivityState('error');
          }
        } catch (e) {
          console.error('[WS] Parse error:', e);
        }
      };
    };

    connect();

    // Fetch personas
    fetch(`${settings.apiUrl}/api/v1/personas`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) store.setAvailablePersonas(data);
      })
      .catch(() => {});

    return () => {
      globalWs?.close();
      globalWs = null;
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [settings.apiUrl]);

  // Enviar mensaje (opcional con attachments)
  const sendMessage = useCallback((text: string, attachments?: Array<{key: string; filename: string}>) => {
    const msg = text.trim();
    if (!msg && (!attachments || attachments.length === 0)) return;

    store.setLastUserText(msg);
    store.setChatInput('');

    if (!globalWs || globalWs.readyState !== WebSocket.OPEN) {
      store.setActivityState('thinking');
      setTimeout(() => {
        store.appendChatMessage({
          id: makeId(),
          role: 'assistant',
          content: `[Backend offline] I received: "${msg}"\n\nPlease start the backend to get real AI responses.\n\nRun: .\\INICIAR_BACKEND.bat`,
          isStreaming: false,
        });
        store.setActivityState('idle');
      }, 1000);
      return;
    }

    store.setActivityState('thinking');
    globalWs.send(JSON.stringify({
      message: msg,
      session_id: store.chatSessionId,
      persona: store.persona?.name || 'profesional',
      attachments: attachments || [],
    }));
  }, [store]);

  const retryConnection = useCallback(() => {
    globalWs?.close();
  }, []);

  const clearChat = useCallback(() => {
    store.clearChat();
  }, [store]);

  return {
    messages: store.chatMessages,
    input: store.chatInput,
    setInput: store.setChatInput,
    status,
    sendMessage,
    retryConnection,
    clearChat,
    isConnected: status === 'connected',
    isConnecting: status === 'connecting',
    hasError: status === 'error',
  };
}
