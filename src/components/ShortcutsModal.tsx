import React from 'react';
import { X, Keyboard } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcutGroups = [
    {
      title: '3D Transform & Gizmo',
      items: [
        { key: 'G / T', desc: 'Translate Mode (Move on X/Y/Z)' },
        { key: 'R', desc: 'Rotate Mode' },
        { key: 'S', desc: 'Scale Mode' },
        { key: 'Esc', desc: 'Deselect Active Object' },
      ],
    },
    {
      title: 'Scene Editing & History',
      items: [
        { key: 'Ctrl + D', desc: 'Duplicate Selected Object' },
        { key: 'Delete / Backspace', desc: 'Delete Selected Object' },
        { key: 'Ctrl + Z', desc: 'Undo Action' },
        { key: 'Ctrl + Y', desc: 'Redo Action' },
      ],
    },
    {
      title: 'Navigation & Viewport',
      items: [
        { key: 'Left Click + Drag', desc: 'Orbit 360° Viewport Camera' },
        { key: 'Right Click + Drag', desc: 'Pan Camera Position' },
        { key: 'Scroll Wheel', desc: 'Zoom Camera In / Out' },
        { key: 'Double Click Mesh', desc: 'Select Object in 3D Space' },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-sky-400" />
            <h3 className="text-base font-bold text-slate-100">Professional Hotkey Reference</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto no-scrollbar">
          {shortcutGroups.map((group, idx) => (
            <div key={idx} className="space-y-2">
              <span className="text-xs font-bold text-sky-400 uppercase tracking-wider block">
                {group.title}
              </span>
              <div className="bg-slate-950 rounded-xl border border-slate-800 p-2 space-y-1">
                {group.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1 px-2">
                    <span className="text-slate-300">{item.desc}</span>
                    <kbd className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-sky-300 font-mono text-[11px] font-semibold">
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold shadow-md transition-all"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
