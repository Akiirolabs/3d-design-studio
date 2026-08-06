import React, { useState } from 'react';
import { X, Download, FileCode, Printer, Box, Check } from 'lucide-react';
import * as THREE from 'three';
import { exportToGLTF, exportToOBJ, exportToSTL, exportToJSON } from '../utils/exporters';
import { ProjectData } from '../types';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  scene: THREE.Scene | null;
  project: ProjectData;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, scene, project }) => {
  const [format, setFormat] = useState<'glb' | 'gltf' | 'obj' | 'stl' | 'json'>('glb');
  const [filename, setFilename] = useState(project.name.toLowerCase().replace(/\s+/g, '_'));
  const [downloaded, setDownloaded] = useState(false);

  if (!isOpen) return null;

  const handleExport = () => {
    if (!scene && format !== 'json') return;

    if (format === 'glb' && scene) {
      exportToGLTF(scene, true, `${filename}.glb`);
    } else if (format === 'gltf' && scene) {
      exportToGLTF(scene, false, `${filename}.gltf`);
    } else if (format === 'obj' && scene) {
      exportToOBJ(scene, `${filename}.obj`);
    } else if (format === 'stl' && scene) {
      exportToSTL(scene, `${filename}.stl`);
    } else if (format === 'json') {
      exportToJSON(project, `${filename}.json`);
    }

    setDownloaded(true);
    setTimeout(() => {
      setDownloaded(false);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-sky-400" />
            <h3 className="text-base font-bold text-slate-100">Export Professional 3D Asset</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Target File Format</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'glb', label: 'GLB (Binary 3D Web Standard)', icon: Box, desc: 'Best for web viewer & AR/VR' },
                { id: 'gltf', label: 'GLTF (JSON + Binaries)', icon: FileCode, desc: 'Human readable 3D format' },
                { id: 'obj', label: 'Wavefront OBJ', icon: Box, desc: 'Compatible with Blender, Maya, CAD' },
                { id: 'stl', label: 'STL (3D Printing Ready)', icon: Printer, desc: 'Polygonal format for 3D printers' },
                { id: 'json', label: 'Full Project JSON', icon: FileCode, desc: 'Complete backup with PBR state' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setFormat(item.id as any)}
                  className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                    format === item.id
                      ? 'bg-sky-500/15 border-sky-500 text-sky-200 font-semibold shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <item.icon className="w-4 h-4 text-sky-400" />
                    <span className="text-xs text-slate-100">{item.label}</span>
                  </div>
                  <span className="text-[10px] text-slate-500">{item.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Output Filename</label>
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">
              <input
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                className="w-full bg-transparent text-xs text-slate-100 font-mono focus:outline-none"
              />
              <span className="text-xs font-mono text-slate-500">.{format}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={downloaded}
            className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-sky-500/20 transition-all"
          >
            {downloaded ? (
              <>
                <Check className="w-4 h-4 text-emerald-300" />
                Exported Successfully!
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Download .{format.toUpperCase()}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
