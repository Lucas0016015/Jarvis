'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
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
  llmProvider: string;
  modelName: string;
  theme: string;
  autoConnect: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  apiUrl: 'http://localhost:8000',
  llmProvider: 'ollama',
  modelName: 'llama3.2',
  theme: 'dark',
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

export function useJarvisChat() {
  const { setActivityState, persona, setAvailablePersonas } = useJarvisStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [errorRetry, setErrorRetry] = useState(0);
  const [settings] = useState<AppSettings>(loadSettings);
  const wsRef = useRef<WebSocket | null>(null);
  const sessionId = useRef<string>(makeId());
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorRetryRef = useRef(0);

  useEffect(() => { errorRetryRef.current = errorRetry; }, [errorRetry]);

  useEffect(() => {
    fetch(`${settings.apiUrl}/api/v1/personas`)
      .then(r => r.json())
      .then(setAvailablePersonas)
      .catch(() => {});
  }, [settings.apiUrl, setAvailablePersonas]);

  const connect = useCallback(() => {
    if (reconnectTimer.current) { clearTimeout(reconnectTimer.current); reconnectTimer.current = null; }
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }

    setStatus('connecting');

    let wsUrl: string;
    try {
      const wsBase = settings.apiUrl.replace(/^http/, 'ws');
      wsUrl = `${wsBase}/api/v1/ws/chat`;
    } catch {
      wsUrl = 'ws://localhost:8000/ws/chat';
    }

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch {
      setStatus('error');
      setErrorRetry((prev) => prev + 1);
      return;
    }

    const handleClose = () => {
      wsRef.current = null;
      setStatus((currentStatus) => {
        if (currentStatus !== 'disconnected') {
          if (settings.autoConnect) {
            const delay = Math.min(1000 * Math.pow(2, errorRetryRef.current), 30000);
            reconnectTimer.current = setTimeout(connect, delay);
          }
        }
        return 'disconnected';
      });
    };

    const handleError = () => {
      setStatus('error');
      setErrorRetry((prev) => prev + 1);
    };

    ws.onopen = () => {
      wsRef.current = ws;
      setStatus('connected');
      setErrorRetry(0);
    };
    ws.onclose = handleClose;
    ws.onerror = handleError;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'tool_start') {
          setActivityState('thinking');
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.role === 'assistant') {
              return [
                ...prev.slice(0, -1),
                { ...last, toolCalls: [...(last.toolCalls || []), { tool: data.tool_name, input: data.tool_input }] },
              ];
            }
            return prev;
          });
        }

        if (data.type === 'tool_end') {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.role === 'assistant') {
              return [
                ...prev.slice(0, -1),
                {
                  ...last,
                  toolCalls: last.toolCalls?.map((tc, i) =>
                    i === (last.toolCalls?.length || 0) - 1
                      ? { ...tc, output: typeof data.tool_output === 'string' ? data.tool_output : JSON.stringify(data.tool_output) }
                      : tc
                  ),
                },
              ];
            }
            return prev;
          });
        }

        if (data.type === 'token' && data.content) {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.isStreaming) {
              return [...prev.slice(0, -1), { ...last, content: last.content + data.content }];
            }
            return [...prev, { id: makeId(), role: 'assistant', content: data.content, isStreaming: true }];
          });
        }

        if (data.type === 'done') {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.isStreaming) return [...prev.slice(0, -1), { ...last, isStreaming: false }];
            return prev;
          });
        }

        if (data.type === 'error') {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.isStreaming) {
              return [
                ...prev.slice(0, -1),
                { ...last, isStreaming: false, content: last.content + `\n[Error: ${data.content}]` },
              ];
            }
            return prev;
          });
        }
      } catch { /* ignore malformed messages */ }
    };
  }, [setActivityState, settings.autoConnect, settings.apiUrl]);

  const sendMessage = useCallback((text?: string) => {
    const msg = text || input;
    if (!msg.trim()) return;

    const userMessage: ChatMessage = { id: makeId(), role: 'user', content: msg };
    setMessages((prev) => [...prev, userMessage]);
    if (!text) setInput('');

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setActivityState('thinking');
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: makeId(),
            role: 'assistant',
            content: `[Backend offline] I received: "${msg}"\n\nPlease start the backend to get real AI responses.\n\nRun: .\INICIAR_BACKEND.bat`,
            isStreaming: false,
          },
        ]);
        setActivityState('idle');
      }, 1000);
      return;
    }

    setActivityState('thinking');
    wsRef.current.send(JSON.stringify({
      message: msg,
      session_id: sessionId.current,
      persona: persona?.name || 'default',
    }));
  }, [input, setActivityState, persona]);

  const retryConnection = useCallback(() => {
    setErrorRetry(0);
    wsRef.current?.close();
    connect();
  }, [connect]);

  useEffect(() => {
    if (settings.autoConnect) connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect, settings.autoConnect]);

  return {
    messages,
    input,
    setInput,
    status,
    sendMessage,
    retryConnection,
    isConnected: status === 'connected',
    isConnecting: status === 'connecting',
    hasError: status === 'error',
  };
}