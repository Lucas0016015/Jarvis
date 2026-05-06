'use client';

import React, { useState, useRef } from 'react';
import { Mic, Square, Play, Pause } from 'lucide-react';
import { useJarvisStore } from '@/store/jarvisStore';

/* ── VoiceModePanel ─────────────────────────────────────────────────────
   STT recording + TTS playback panel with waveform visualization.
   ─────────────────────────────────────────────────────────────────────── */

const API = 'http://localhost:8000/api/v1';

async function webmToWav(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  const wavBuffer = audioBufferToWav(audioBuffer);
  return new Blob([wavBuffer], { type: 'audio/wav' });
}

function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1;
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = buffer.length * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;
  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);
  const channels: Float32Array[] = [];
  for (let i = 0; i < numChannels; i++) channels.push(buffer.getChannelData(i));
  let offset = 0;
  const write = (str: string) => { for (const c of str) view.setUint8(offset++, c.charCodeAt(0)); };
  write('RIFF'); view.setUint32(offset, 36 + dataSize, true); offset += 4;
  write('WAVE'); write('fmt '); view.setUint32(offset, 16, true); offset += 4;
  view.setUint16(offset, format, true); offset += 2;
  view.setUint16(offset, numChannels, true); offset += 2;
  view.setUint32(offset, sampleRate, true); offset += 4;
  view.setUint32(offset, sampleRate * blockAlign, true); offset += 4;
  view.setUint16(offset, blockAlign, true); offset += 2;
  view.setUint16(offset, bitDepth, true); offset += 2;
  write('data'); view.setUint32(offset, dataSize, true); offset += 4;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const s = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }
  }
  return arrayBuffer;
}

export default function VoiceModePanel() {
  const { setActivityState } = useJarvisStore();
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      chunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await sendForSTT(blob);
        setIsRecording(false);
        setActivityState('idle');
        if (timerRef.current) clearInterval(timerRef.current);
        setRecordingTime(0);
      };

      recorder.start(100);
      setIsRecording(true);
      setActivityState('listening');
      setTranscript('');

      timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } catch (e) { console.error('Mic error:', e); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  const sendForSTT = async (blob: Blob) => {
    try {
      setActivityState('thinking');
      const wavBlob = await webmToWav(blob);
      const formData = new FormData();
      formData.append('audio', wavBlob, 'recording.wav');
      formData.append('language', 'es');

      const res = await fetch(`${API}/stt/transcribe`, {
        method: 'POST', body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setTranscript(data.text);
        await synthesize(data.text);
      }
    } catch (e) { console.error('STT error:', e); }
  };

  const synthesize = async (text: string) => {
    try {
      const res = await fetch(`${API}/tts/synthesize`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice_id: 'es_ES-claribel_evans-medium', format: 'wav' }),
      });
      if (res.ok) {
        const audioBlob = await res.blob();
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        setIsPlaying(true);
        const audio = new Audio(url);
        audio.onended = () => { setIsPlaying(false); setActivityState('idle'); };
        audio.onerror = () => setIsPlaying(false);
        setActivityState('speaking');
        audio.play();
      }
    } catch (e) { console.error('TTS error:', e); }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="flex flex-col h-full items-center justify-center gap-6 px-4">
      {/* Recording button */}
      <button
        onClick={isRecording ? stopRecording : startRecording}
        className={`relative w-[88px] h-[88px] rounded-full flex items-center justify-center transition-all duration-300 ${
          isRecording
            ? 'bg-gradient-to-br from-red-500 to-red-600 shadow-[0_0_30px_rgba(255,68,68,0.4)]'
            : 'bg-gradient-to-br from-cyan-500 to-blue-600 shadow-[0_0_30px_rgba(0,212,255,0.4)]'
        }`}
      >
        {isRecording && (
          <span className="absolute inset-0 rounded-full border-2 border-white/20 animate-recording-ring" />
        )}
        {isRecording ? (
          <Square className="w-7 h-7 text-white fill-white" />
        ) : (
          <Mic className="w-8 h-8 text-white" />
        )}
      </button>

      {/* Recording timer */}
      {isRecording && (
        <p className="text-2xl font-mono font-semibold text-red-400 tracking-wider">
          {formatTime(recordingTime)}
        </p>
      )}

      {/* Transcript */}
      {transcript && (
        <div className="w-full glass-strong rounded-xl p-4 text-center">
          <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-400/50 mb-2">You said</p>
          <p className="text-[14px] text-white/80">{transcript}</p>
        </div>
      )}

      {/* Playback controls */}
      {audioUrl && !isRecording && (
        <button
          onClick={() => {
            const audio = new Audio(audioUrl);
            if (isPlaying) { audio.pause(); setIsPlaying(false); }
            else { setIsPlaying(true); audio.play(); audio.onended = () => setIsPlaying(false); }
          }}
          className="flex items-center gap-2 px-4 py-2 glass-base rounded-xl hover:glass-hover transition-all"
        >
          {isPlaying ? <Pause className="w-4 h-4 text-cyan-400" /> : <Play className="w-4 h-4 text-cyan-400" />}
          <span className="text-[12px] text-white/60">{isPlaying ? 'Playing...' : 'Play response'}</span>
        </button>
      )}

      {!isRecording && !transcript && (
        <p className="text-[12px] text-white/20 text-center">Tap the microphone to speak</p>
      )}
    </div>
  );
}
