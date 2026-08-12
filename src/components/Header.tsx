import React from 'react';
import {
  Box,
  Layers,
  Sparkles,
  Download,
  Camera,
  History,
  Undo2,
  Redo2,
  HelpCircle,
  Eye,
  Activity,
  Maximize2,
  Settings,
} from 'lucide-react';
import { ViewportRenderMode } from '../types';

interface HeaderProps {
  projectName: string;
  onUpdateProjectName: (name: string) => void;
  renderMode: ViewportRenderMode;
  onChangeRenderMode: (mode: ViewportRenderMode) => void;
  onOpenExportModal: () => void;
  onOpenAICopilot: () => void;
  onOpenCloudSync:()=>void;
  onOpenShortcuts: () => void;
  onTakeSnapshot: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onOpenSettings: () => void;
  settingsButtonRef?: React.RefObject<HTMLButtonElement | null>;
  cloudButtonRef?:React.RefObject<HTMLButtonElement|null>;
}

export const Header: React.FC<HeaderProps> = ({
  projectName,
  onUpdateProjectName,
  renderMode,
  onChangeRenderMode,
  onOpenExportModal,
  onOpenAICopilot,
  onOpenCloudSync,
  onOpenShortcuts,
  onTakeSnapshot,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onOpenSettings,
  settingsButtonRef,
  cloudButtonRef,
}) => {
  return (
    <header className="h-14 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-4 flex items-center justify-between z-30 select-none">
      {/* Left Branding & Project Title */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-sky-500/20 ring-1 ring-white/20">
            <Box className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div>
            <span className="text-sm font-bold tracking-tight text-slate-100 flex items-center gap-1.5">
              3D Design Studio
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 font-semibold">
                PRO v2.5
              </span>
            </span>
          </div>
        </div>

        <span className="h-4 w-px bg-slate-800" />

        {/* Project Name Input */}
        <input
          type="text"
          value={projectName}
          onChange={(e) => onUpdateProjectName(e.target.value)}
          className="bg-transparent hover:bg-slate-800/50 focus:bg-slate-800/80 px-2 py-1 rounded border border-transparent focus:border-slate-700 text-xs font-medium text-slate-200 focus:outline-none transition-all w-60 truncate"
          placeholder="Untitled Architectural Project"
        />

        {/* Undo / Redo */}
        <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-lg border border-slate-800/60">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Middle Viewport Shading Modes */}
      <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800/80 text-xs font-medium text-slate-400">
        <button
          onClick={() => onChangeRenderMode('shaded')}
          className={`px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all ${
            renderMode === 'shaded'
              ? 'bg-slate-800 text-slate-100 font-semibold shadow-sm border border-slate-700/60'
              : 'hover:text-slate-200'
          }`}
        >
          <Eye className="w-3.5 h-3.5 text-sky-400" />
          Shaded
        </button>

        <button
          onClick={() => onChangeRenderMode('wireframe')}
          className={`px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all ${
            renderMode === 'wireframe'
              ? 'bg-slate-800 text-slate-100 font-semibold shadow-sm border border-slate-700/60'
              : 'hover:text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-emerald-400" />
          Wireframe
        </button>

        <button
          onClick={() => onChangeRenderMode('photoreal')}
          className={`px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all ${
            renderMode === 'photoreal'
              ? 'bg-slate-800 text-slate-100 font-semibold shadow-sm border border-slate-700/60'
              : 'hover:text-slate-200'
          }`}
        >
          <Activity className="w-3.5 h-3.5 text-amber-400" />
          Photoreal
        </button>
      </div>

      {/* Right Action Menu */}
      <div className="flex items-center gap-2">
        {/* Gemini AI Copilot */}
        <button
          onClick={onOpenAICopilot}
          className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-600 hover:brightness-110 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-500/20 transition-all border border-white/20"
        >
          <Sparkles className="w-3.5 h-3.5 animate-pulse text-amber-300" />
          A K I I R O AI
        </button>

        <button ref={cloudButtonRef} aria-label="Open Saved Versions" onClick={onOpenCloudSync} className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-xs font-medium flex items-center gap-1.5 border border-slate-700/60 transition-colors" title="Saved Versions">
          <History className="w-3.5 h-3.5 text-sky-400"/><span className="hidden md:inline">Saved Versions</span>
        </button>

        {/* 4K Render Snapshot */}
        <button
          onClick={onTakeSnapshot}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-slate-100 border border-slate-700/60 transition-colors"
          title="Capture 4K Snapshot"
        >
          <Camera className="w-3.5 h-3.5" />
        </button>

        {/* Export 3D File Modal */}
        <button
          onClick={onOpenExportModal}
          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
        >
          <Download className="w-3.5 h-3.5" />
          Export 3D
        </button>

        {/* Shortcuts */}
        <button
          onClick={onOpenShortcuts}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/60 transition-colors"
          title="Keyboard Shortcuts"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
        <button
          ref={settingsButtonRef}
          onClick={onOpenSettings}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/60 transition-colors"
          title="Account and settings"
          aria-label="Open account and settings"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
