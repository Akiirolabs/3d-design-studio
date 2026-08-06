import React, { useState } from 'react';
import {
  Search,
  Plus,
  Move,
  RotateCw,
  Maximize,
  Box,
  Columns,
  Armchair,
  Trees,
  Sun,
  Upload,
  Layers,
} from 'lucide-react';
import { AssetCategory, AssetTemplate, TransformMode } from '../types';
import { ASSET_LIBRARY } from '../data/assetsLibrary';

interface SidebarLeftProps {
  onAddAsset: (template: AssetTemplate) => void;
  transformMode: TransformMode;
  onChangeTransformMode: (mode: TransformMode) => void;
  onImportProjectJSON: (jsonData: string) => void;
}

export const SidebarLeft: React.FC<SidebarLeftProps> = ({
  onAddAsset,
  transformMode,
  onChangeTransformMode,
  onImportProjectJSON,
}) => {
  const [activeTab, setActiveTab] = useState<AssetCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAssets = ASSET_LIBRARY.filter((asset) => {
    const matchesCategory = activeTab === 'all' || asset.category === activeTab;
    const matchesSearch =
      asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onImportProjectJSON(event.target.result as string);
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <aside className="w-72 bg-slate-900/95 border-r border-slate-800/80 flex flex-col h-[calc(100vh-3.5rem)] select-none z-20">
      {/* 3D Gizmo Tool Switcher (Translate / Rotate / Scale) */}
      <div className="p-3 border-b border-slate-800/80 bg-slate-950/60">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-2">
          Transform Controls (Gizmo)
        </label>
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-900 rounded-lg border border-slate-800">
          <button
            onClick={() => onChangeTransformMode('translate')}
            className={`py-1.5 rounded-md flex items-center justify-center gap-1 text-xs font-medium transition-all ${
              transformMode === 'translate'
                ? 'bg-sky-500 text-white font-semibold shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
            title="Translate (Key: G / T)"
          >
            <Move className="w-3.5 h-3.5" />
            Move
          </button>
          <button
            onClick={() => onChangeTransformMode('rotate')}
            className={`py-1.5 rounded-md flex items-center justify-center gap-1 text-xs font-medium transition-all ${
              transformMode === 'rotate'
                ? 'bg-sky-500 text-white font-semibold shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
            title="Rotate (Key: R)"
          >
            <RotateCw className="w-3.5 h-3.5" />
            Rotate
          </button>
          <button
            onClick={() => onChangeTransformMode('scale')}
            className={`py-1.5 rounded-md flex items-center justify-center gap-1 text-xs font-medium transition-all ${
              transformMode === 'scale'
                ? 'bg-sky-500 text-white font-semibold shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
            title="Scale (Key: S)"
          >
            <Maximize className="w-3.5 h-3.5" />
            Scale
          </button>
        </div>
      </div>

      {/* Asset Library Search & Filter */}
      <div className="p-3 border-b border-slate-800/80 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold tracking-tight text-slate-200 uppercase">Asset Library</span>
          <span className="text-[10px] text-slate-400 font-mono">{filteredAssets.length} Preset Items</span>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search shapes, architecture, lights..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar text-[11px] font-medium text-slate-400">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-2.5 py-1 rounded-md whitespace-nowrap transition-colors ${
              activeTab === 'all'
                ? 'bg-slate-800 text-sky-400 font-semibold border border-slate-700'
                : 'hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setActiveTab('primitives')}
            className={`px-2.5 py-1 rounded-md whitespace-nowrap flex items-center gap-1 transition-colors ${
              activeTab === 'primitives'
                ? 'bg-slate-800 text-sky-400 font-semibold border border-slate-700'
                : 'hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Box className="w-3 h-3" /> Shapes
          </button>
          <button
            onClick={() => setActiveTab('architecture')}
            className={`px-2.5 py-1 rounded-md whitespace-nowrap flex items-center gap-1 transition-colors ${
              activeTab === 'architecture'
                ? 'bg-slate-800 text-sky-400 font-semibold border border-slate-700'
                : 'hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Columns className="w-3 h-3" /> Arch
          </button>
          <button
            onClick={() => setActiveTab('interior')}
            className={`px-2.5 py-1 rounded-md whitespace-nowrap flex items-center gap-1 transition-colors ${
              activeTab === 'interior'
                ? 'bg-slate-800 text-sky-400 font-semibold border border-slate-700'
                : 'hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Armchair className="w-3 h-3" /> Furniture
          </button>
          <button
            onClick={() => setActiveTab('environment')}
            className={`px-2.5 py-1 rounded-md whitespace-nowrap flex items-center gap-1 transition-colors ${
              activeTab === 'environment'
                ? 'bg-slate-800 text-sky-400 font-semibold border border-slate-700'
                : 'hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Trees className="w-3 h-3" /> Foliage
          </button>
          <button
            onClick={() => setActiveTab('lights')}
            className={`px-2.5 py-1 rounded-md whitespace-nowrap flex items-center gap-1 transition-colors ${
              activeTab === 'lights'
                ? 'bg-slate-800 text-sky-400 font-semibold border border-slate-700'
                : 'hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Sun className="w-3 h-3" /> Lights
          </button>
        </div>
      </div>

      {/* Asset Grid List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar">
        {filteredAssets.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500">
            No 3D assets found matching "{searchQuery}"
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filteredAssets.map((asset) => (
              <button
                key={asset.id}
                onClick={() => onAddAsset(asset)}
                className="group flex flex-col items-start p-2.5 bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800/80 hover:border-slate-700 rounded-xl transition-all text-left shadow-sm relative overflow-hidden"
              >
                <div className="w-full flex items-center justify-between mb-1.5">
                  <div className="w-7 h-7 rounded-lg bg-slate-900 group-hover:bg-sky-500/20 text-slate-300 group-hover:text-sky-400 flex items-center justify-center transition-colors">
                    <Box className="w-4 h-4" />
                  </div>
                  <span className="w-5 h-5 rounded-full bg-slate-900 group-hover:bg-sky-500 text-slate-400 group-hover:text-white flex items-center justify-center transition-colors">
                    <Plus className="w-3 h-3" />
                  </span>
                </div>
                <span className="text-xs font-semibold text-slate-200 group-hover:text-white truncate w-full">
                  {asset.name}
                </span>
                <span className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                  {asset.description}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Custom File Import */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/60">
        <label className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-xl text-xs font-semibold text-slate-300 hover:text-white cursor-pointer transition-colors">
          <Upload className="w-3.5 h-3.5 text-sky-400" />
          Import Project / Scene (JSON)
          <input
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
      </div>
    </aside>
  );
};
