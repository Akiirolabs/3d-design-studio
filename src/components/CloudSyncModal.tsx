import React, { useState } from 'react';
import { X, Share2, Users, History, Copy, Check, RefreshCw, Lock, Sparkles } from 'lucide-react';
import { CloudSession, ProjectData } from '../types';
import { generateRoomCode } from '../utils/storage';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  cloudSession: CloudSession;
  onUpdateCloudSession: (session: CloudSession) => void;
  project: ProjectData;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  cloudSession,
  onUpdateCloudSession,
  project,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(cloudSession.roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNewRoom = () => {
    const newCode = generateRoomCode();
    onUpdateCloudSession({
      ...cloudSession,
      roomCode: newCode,
      updatedAt: new Date().toISOString(),
      history: [
        { id: `h_${Date.now()}`, timestamp: 'Just now', description: `New Cloud Collaboration Room created (${newCode})` },
        ...cloudSession.history,
      ],
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Collaborative Cloud Syncing</h3>
              <p className="text-[11px] text-slate-400">Live multi-user scene state & versioning</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Room Code Share Card */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <span className="text-xs font-semibold text-slate-400 block">Live Room Code</span>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-mono font-bold tracking-widest text-sky-400">
                {cloudSession.roomCode}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyCode}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy Code'}
                </button>
                <button
                  onClick={handleNewRoom}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200"
                  title="Generate New Session Room"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              Share this code with teammates to sync real-time viewport changes, camera viewpoints, and material tweaks.
            </p>
          </div>

          {/* Active Collaborators */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-sky-400" /> Connected Architects
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {cloudSession.collaborators.filter((c) => c.active).length} online
              </span>
            </div>

            <div className="space-y-1.5">
              {cloudSession.collaborators.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-2.5 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.avatarColor }} />
                    <span className="font-semibold text-slate-200">{c.name}</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${c.active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-500'}`}>
                    {c.active ? 'Active' : 'Offline'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Version History Log */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-amber-400" /> Sync History Log
            </span>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2 max-h-36 overflow-y-auto no-scrollbar">
              {cloudSession.history.map((h) => (
                <div key={h.id} className="flex items-start justify-between text-xs pb-1.5 border-b border-slate-800/60 last:border-0 last:pb-0">
                  <span className="text-slate-300">{h.description}</span>
                  <span className="text-[10px] font-mono text-slate-500 whitespace-nowrap ml-2">{h.timestamp}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold shadow-md transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
