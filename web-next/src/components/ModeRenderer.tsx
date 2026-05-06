'use client';

import React from 'react';
import { useJarvisStore } from '@/store/jarvisStore';

/* Lazy panel imports */
const ChatPanel  = React.lazy(() => import('./panels/ChatModePanel'));
const TasksPanel = React.lazy(() => import('./panels/TasksModePanel'));
const NotesPanel = React.lazy(() => import('./panels/NotesModePanel'));
const VoicePanel = React.lazy(() => import('./panels/VoiceModePanel'));
const TimerPanel = React.lazy(() => import('./panels/TimerModePanel'));
const EmailPanel = React.lazy(() => import('./panels/EmailModePanel'));
const SettingsPanel = React.lazy(() => import('./panels/SettingsPanel'));
const PersonalitiesPanel = React.lazy(() => import('./panels/PersonalitiesPanel'));

export default function ModeRenderer() {
  const { panelMode } = useJarvisStore();

  switch (panelMode) {
    case 'chat':           return <ChatPanel />;
    case 'tasks':          return <TasksPanel />;
    case 'notes':          return <NotesPanel />;
    case 'voice':          return <VoicePanel />;
    case 'timer':          return <TimerPanel />;
    case 'email':          return <EmailPanel />;
    case 'settings':       return <SettingsPanel />;
    case 'personalities':    return <PersonalitiesPanel />;
    default:               return <ChatPanel />;
  }
}
