import React, { useEffect, useRef, useState } from 'react';
import {
  Sliders,
  FolderTree,
  SunMedium,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Trash2,
  Copy,
  RotateCcw,
  Palette,
} from 'lucide-react';
import { SceneObject, EnvironmentSettings, ParametricExtrusionGeometry } from '../types';
import { minimumTwistSteps } from '../utils/parametricExtrusion';
import { createExtrusionInteraction, handleExtrusionRangeKeyDown } from '../utils/extrusionInteraction';
import { MATERIAL_PRESETS } from '../data/materialPresets';

interface SidebarRightProps {
  objects: SceneObject[];
  selectedObjectId: string | null;
  selectedObjectIds: string[];
  onSelectObject: (id: string | null, additive?: boolean) => void;
  onAlignObjects: (axis: 0 | 1 | 2, mode: 'min' | 'center' | 'max') => void;
  onApplyBoolean: (targetId: string, cutterId: string) => void;
  onRemoveBoolean: (targetId: string) => void;
  alignmentIssue: string | null;
  onUpdateObject: (updated: SceneObject) => void;
  onPreviewObject?: (updated: SceneObject | null) => void;
  onDeleteObject: (id: string) => void;
  onDuplicateObject: (id: string) => void;
  environment: EnvironmentSettings;
  onUpdateEnvironment: (updated: EnvironmentSettings) => void;
}

export const SidebarRight: React.FC<SidebarRightProps> = ({
  objects,
  selectedObjectId,
  selectedObjectIds,
  onSelectObject,
  onAlignObjects,
  onApplyBoolean,
  onRemoveBoolean,
  alignmentIssue,
  onUpdateObject,
  onPreviewObject,
  onDeleteObject,
  onDuplicateObject,
  environment,
  onUpdateEnvironment,
}) => {
  const [rightTab, setRightTab] = useState<'inspector' | 'outliner' | 'environment'>('inspector');
  const [markedCutterId, setMarkedCutterId] = useState<string | null>(null);

  const selectedObject = objects.find((o) => o.id === selectedObjectId);
  const [extrusionDraft, setExtrusionDraft] = useState<ParametricExtrusionGeometry | null>(null);
  const selectedRef = useRef(selectedObject);
  const draftRef = useRef(extrusionDraft);
  const previewCallbackRef = useRef(onPreviewObject);
  const commitCallbackRef = useRef(onUpdateObject);
  selectedRef.current = selectedObject;
  draftRef.current = extrusionDraft;
  previewCallbackRef.current = onPreviewObject;
  commitCallbackRef.current = onUpdateObject;
  const interactionRef = useRef<ReturnType<typeof createExtrusionInteraction> | null>(null);
  if (!interactionRef.current) interactionRef.current = createExtrusionInteraction({
    getSelected: () => selectedRef.current,
    getDraft: () => draftRef.current,
    setDraft: draft => { draftRef.current = draft; setExtrusionDraft(draft); },
    preview: object => previewCallbackRef.current?.(object),
    commit: object => commitCallbackRef.current(object),
    requestFrame: callback => requestAnimationFrame(callback),
    cancelFrame: handle => cancelAnimationFrame(handle),
  });
  useEffect(() => () => interactionRef.current?.dispose(), []);
  useEffect(() => {
    const next = selectedObject?.geometry ?? null;
    draftRef.current = next;
    setExtrusionDraft(next);
  }, [selectedObject?.id, selectedObject?.geometry]);

  const previewExtrusion = (patch: Partial<ParametricExtrusionGeometry>) => interactionRef.current?.preview(patch);
  const commitExtrusion = () => interactionRef.current?.commit();
  const cancelExtrusion = () => interactionRef.current?.cancel();

  const handlePositionChange = (axisIndex: number, val: number) => {
    if (!selectedObject) return;
    const newPos = [...selectedObject.position] as [number, number, number];
    newPos[axisIndex] = val;
    onUpdateObject({ ...selectedObject, position: newPos });
  };

  const handleRotationChange = (axisIndex: number, val: number) => {
    if (!selectedObject) return;
    const newRot = [...selectedObject.rotation] as [number, number, number];
    newRot[axisIndex] = val;
    onUpdateObject({ ...selectedObject, rotation: newRot });
  };

  const handleScaleChange = (axisIndex: number, val: number) => {
    if (!selectedObject) return;
    const newScl = [...selectedObject.scale] as [number, number, number];
    newScl[axisIndex] = Math.max(0.01, val);
    onUpdateObject({ ...selectedObject, scale: newScl });
  };

  const applyMaterialPreset = (presetId: string) => {
    if (!selectedObject) return;
    const preset = MATERIAL_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      onUpdateObject({
        ...selectedObject,
        materialPreset: preset.id,
        color: preset.color,
        metalness: preset.metalness,
        roughness: preset.roughness,
        transmission: preset.transmission,
        clearcoat: preset.clearcoat || 0,
        emission: preset.emission || '',
      });
    }
  };

  return (
    <aside className="w-80 bg-slate-900/95 border-l border-slate-800/80 flex flex-col h-[calc(100vh-3.5rem)] select-none z-20">
      {/* Tab Switcher */}
      <div className="flex items-center border-b border-slate-800/80 p-1.5 bg-slate-950/60">
        <button
          onClick={() => setRightTab('inspector')}
          className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 text-xs font-semibold transition-all ${
            rightTab === 'inspector'
              ? 'bg-slate-800 text-sky-400 border border-slate-700 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          Inspector
        </button>
        <button
          onClick={() => setRightTab('outliner')}
          className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 text-xs font-semibold transition-all ${
            rightTab === 'outliner'
              ? 'bg-slate-800 text-sky-400 border border-slate-700 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FolderTree className="w-3.5 h-3.5" />
          Outliner ({objects.length})
        </button>
        <button
          onClick={() => setRightTab('environment')}
          className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 text-xs font-semibold transition-all ${
            rightTab === 'environment'
              ? 'bg-slate-800 text-sky-400 border border-slate-700 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <SunMedium className="w-3.5 h-3.5" />
          Studio
        </button>
      </div>

      {/* TAB 1: INSPECTOR */}
      {rightTab === 'inspector' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-5 no-scrollbar">
          {selectedObject ? (
            <div className="space-y-4">
              {selectedObjectIds.length >= 2 && (
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-2" aria-label="Align selected object pivots">
                  <div className="flex justify-between text-[10px] uppercase tracking-wide text-slate-400">
                    <span>Align pivots</span><span>{selectedObjectIds.length} selected</span>
                  </div>
                  {[0, 1, 2].map(axis => (
                    <div key={axis} className="grid grid-cols-4 gap-1 text-[10px]">
                      <span className="py-1 text-slate-500">{'XYZ'[axis]}</span>
                      {(['min', 'center', 'max'] as const).map(mode => (
                        <button key={mode} disabled={Boolean(alignmentIssue)} onClick={() => onAlignObjects(axis as 0 | 1 | 2, mode)} className="rounded bg-slate-800 px-1 py-1 text-slate-300 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40" title={alignmentIssue ?? `Align ${mode} ${'XYZ'[axis]} pivots`}>
                          {mode === 'center' ? 'Ctr' : mode[0].toUpperCase() + mode.slice(1)}
                        </button>
                      ))}
                    </div>
                  ))}
                  {alignmentIssue && <p role="status" className="text-[10px] text-amber-300">{alignmentIssue}</p>}
                </div>
              )}
              {/* Object Header & Controls */}
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-slate-400">
                <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 font-semibold text-cyan-300">Primary</span>
                <span>Inspector edits this object</span>
              </div>
              <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <input
                  type="text"
                  value={selectedObject.name}
                  onChange={(e) => onUpdateObject({ ...selectedObject, name: e.target.value })}
                  className="bg-transparent text-sm font-bold text-slate-100 focus:outline-none w-36 truncate"
                />
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onUpdateObject({ ...selectedObject, visible: !selectedObject.visible })}
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                    aria-label={`${selectedObject.visible ? 'Hide' : 'Show'} ${selectedObject.name}`}
                    title={`${selectedObject.visible ? 'Hide' : 'Show'} ${selectedObject.name}`}
                  >
                    {selectedObject.visible ? <Eye className="w-4 h-4 text-emerald-400" /> : <EyeOff className="w-4 h-4 text-slate-600" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateObject({ ...selectedObject, locked: !selectedObject.locked })}
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                    aria-label={`${selectedObject.locked ? 'Unlock' : 'Lock'} ${selectedObject.name}`}
                    title={`${selectedObject.locked ? 'Unlock' : 'Lock'} ${selectedObject.name}`}
                  >
                    {selectedObject.locked ? <Lock className="w-4 h-4 text-amber-400" /> : <Unlock className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDuplicateObject(selectedObject.id)}
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                    aria-label={`Duplicate ${selectedObject.name}`}
                    title={`Duplicate ${selectedObject.name} (Ctrl+D)`}
                  >
                    <Copy className="w-4 h-4 text-sky-400" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteObject(selectedObject.id)}
                    className="p-1.5 rounded hover:bg-slate-800 text-rose-400 hover:text-rose-300"
                    aria-label={`Delete ${selectedObject.name}`}
                    title={`Delete ${selectedObject.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Position Inputs */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span>Position (XYZ)</span>
                  <button
                    onClick={() => onUpdateObject({ ...selectedObject, position: [0, 0, 0] })}
                    className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1"
                  >
                    <RotateCcw className="w-2.5 h-2.5" /> Reset
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {['X', 'Y', 'Z'].map((axis, i) => (
                    <div key={axis} className="flex items-center bg-slate-950 rounded-lg border border-slate-800 px-2 py-1">
                      <span className={`text-xs font-bold mr-1.5 ${i === 0 ? 'text-rose-400' : i === 1 ? 'text-emerald-400' : 'text-sky-400'}`}>
                        {axis}
                      </span>
                      <input
                        type="number"
                        step="0.1"
                        value={selectedObject.position[i]}
                        onChange={(e) => handlePositionChange(i, parseFloat(e.target.value) || 0)}
                        className="w-full bg-transparent text-xs text-slate-200 font-mono focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Rotation Inputs */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span>Rotation (deg)</span>
                  <button
                    onClick={() => onUpdateObject({ ...selectedObject, rotation: [0, 0, 0] })}
                    className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1"
                  >
                    <RotateCcw className="w-2.5 h-2.5" /> Reset
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {['RX', 'RY', 'RZ'].map((axis, i) => (
                    <div key={axis} className="flex items-center bg-slate-950 rounded-lg border border-slate-800 px-2 py-1">
                      <span className="text-xs font-bold text-slate-500 mr-1.5">{axis}</span>
                      <input
                        type="number"
                        step="5"
                        value={selectedObject.rotation[i]}
                        onChange={(e) => handleRotationChange(i, parseFloat(e.target.value) || 0)}
                        className="w-full bg-transparent text-xs text-slate-200 font-mono focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Scale Inputs */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span>Scale Multipliers</span>
                  <button
                    onClick={() => onUpdateObject({ ...selectedObject, scale: [1, 1, 1] })}
                    className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1"
                  >
                    <RotateCcw className="w-2.5 h-2.5" /> Reset (1:1)
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {['SX', 'SY', 'SZ'].map((axis, i) => (
                    <div key={axis} className="flex items-center bg-slate-950 rounded-lg border border-slate-800 px-2 py-1">
                      <span className="text-xs font-bold text-slate-500 mr-1.5">{axis}</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0.01"
                        value={selectedObject.scale[i]}
                        onChange={(e) => handleScaleChange(i, parseFloat(e.target.value) || 1)}
                        className="w-full bg-transparent text-xs text-slate-200 font-mono focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* PBR Material & Color Section */}
              <div className="space-y-2 pt-3 border-t border-slate-800/80">
                <span className="text-xs font-bold text-slate-200">Boolean Hole</span>
                {selectedObject.boolean ? (
                  <>
                    <p className="text-[10px] text-slate-400">One editable hole/cutter is supported per target. Remove this hole to restore the cutter before choosing a replacement.</p>
                    <button aria-label="Remove Boolean hole" onClick={() => onRemoveBoolean(selectedObject.id)} className="w-full rounded-lg border border-amber-600/60 px-2 py-1.5 text-xs text-amber-300">Remove Hole & Restore Cutter</button>
                  </>
                ) : selectedObjectIds.length === 2 ? (
                  <>
                    <p className="text-[10px] text-slate-400">Primary: {selectedObject.name}. The other selected solid becomes the recoverable cutter.</p>
                    <button aria-label="Mark secondary selection as hole" onClick={() => setMarkedCutterId(selectedObjectIds.find(id => id !== selectedObject.id) ?? null)} className="w-full rounded-lg border border-sky-700 px-2 py-1.5 text-xs text-sky-300">Mark as Hole</button>
                    <button aria-label="Apply Boolean subtraction" disabled={!markedCutterId || !selectedObjectIds.includes(markedCutterId)} onClick={() => { if(markedCutterId) { onApplyBoolean(selectedObject.id, markedCutterId); setMarkedCutterId(null); } }} className="w-full rounded-lg bg-sky-600 disabled:opacity-40 px-2 py-1.5 text-xs font-semibold text-white">Apply Subtraction</button>
                  </>
                ) : <p className="text-[10px] text-slate-500">Shift-select exactly two supported solids. The primary object is the target.</p>}
              </div>

              {/* PBR Material & Color Section */}
              {selectedObject.geometry?.kind === 'parametric-extrusion' && extrusionDraft && (
                <div className="space-y-3 pt-3 border-t border-slate-800/80">
                  <span className="text-xs font-bold text-slate-200">Parametric Extrusion</span>
                  {([
                    ['Height', 'height', 0.1, 1000, 0.1],
                    ['Base Scale', 'baseScale', 0.1, 5, 0.05],
                    ['Top Scale', 'topScale', 0.1, 5, 0.05],
                    ['Twist', 'twistAngle', -360, 360, 1],
                    ['Twist Steps', 'twistSteps', minimumTwistSteps(extrusionDraft.twistAngle), 128, 1],
                  ] as const).map(([label,key,min,max,step]) => (
                    <label key={key} className="block text-[11px] text-slate-400">
                      <span className="flex justify-between"><span>{label}</span><span className="font-mono">{extrusionDraft[key]}</span></span>
                      <input aria-label={label} aria-valuetext={String(extrusionDraft[key])} type="range" min={min} max={max} step={step} value={extrusionDraft[key]}
                        onChange={e=>previewExtrusion({[key]: key==='twistSteps'?Math.round(Number(e.target.value)):Number(e.target.value)})}
                        onPointerUp={commitExtrusion} onPointerCancel={cancelExtrusion} onBlur={commitExtrusion}
                        onKeyDown={event=>handleExtrusionRangeKeyDown(event, cancelExtrusion)}
                        className="w-full accent-sky-500" />
                    </label>
                  ))}
                  <label className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Surface shading</span>
                    <select aria-label="Twist Mode" value={extrusionDraft.twistMode} onChange={e=>{
                      const next={...extrusionDraft,twistMode:e.target.value as 'steps'|'smooth'}; setExtrusionDraft(next); onUpdateObject({...selectedObject,geometry:next});
                    }} className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200">
                      <option value="smooth">Smooth</option><option value="steps">Steps</option>
                    </select>
                  </label>
                </div>
              )}

              {/* PBR Material & Color Section */}
              <div className="space-y-3 pt-3 border-t border-slate-800/80">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-sky-400" />
                    PBR Material Engine
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono capitalize">
                    {selectedObject.materialPreset.replace('_', ' ')}
                  </span>
                </div>

                {/* Base Color Picker */}
                <div className="flex items-center justify-between bg-slate-950 p-2 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-300">Albedo Tint</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={selectedObject.color}
                      onChange={(e) => onUpdateObject({ ...selectedObject, color: e.target.value })}
                      className="w-7 h-7 rounded-lg bg-transparent border-0 cursor-pointer"
                    />
                    <span className="text-xs font-mono text-slate-400 uppercase">{selectedObject.color}</span>
                  </div>
                </div>

                {/* Preset Materials Grid */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-400">PBR Architectural Presets</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {MATERIAL_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => applyMaterialPreset(preset.id)}
                        className={`flex items-center gap-2 p-1.5 rounded-lg border text-left text-xs transition-all ${
                          selectedObject.materialPreset === preset.id
                            ? 'bg-sky-500/10 border-sky-500 text-sky-300 font-semibold'
                            : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <span className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm" style={{ backgroundColor: preset.color }} />
                        <span className="truncate">{preset.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Fine Sliders: Roughness, Metalness, Transmission */}
                <div className="space-y-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  <div>
                    <div className="flex justify-between text-xs text-slate-300 mb-1">
                      <span>Roughness</span>
                      <span className="font-mono text-slate-400">{selectedObject.roughness.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={selectedObject.roughness}
                      onChange={(e) => onUpdateObject({ ...selectedObject, roughness: parseFloat(e.target.value) })}
                      className="w-full accent-sky-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-300 mb-1">
                      <span>Metalness</span>
                      <span className="font-mono text-slate-400">{selectedObject.metalness.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={selectedObject.metalness}
                      onChange={(e) => onUpdateObject({ ...selectedObject, metalness: parseFloat(e.target.value) })}
                      className="w-full accent-sky-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-300 mb-1">
                      <span>Transmission (Glass Opacity)</span>
                      <span className="font-mono text-slate-400">{selectedObject.transmission.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={selectedObject.transmission}
                      onChange={(e) => onUpdateObject({ ...selectedObject, transmission: parseFloat(e.target.value) })}
                      className="w-full accent-sky-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-16 text-slate-500 text-xs space-y-2">
              <Sliders className="w-8 h-8 mx-auto stroke-1 text-slate-600" />
              <p>Select any object in the 3D viewport or outliner to inspect and modify properties.</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: OUTLINER (SCENE GRAPH TREE) */}
      {rightTab === 'outliner' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 no-scrollbar">
          <p id="outliner-selection-help" className="px-1 pb-1 text-[10px] text-slate-500">Shift-click or use Shift+Enter/Space to select multiple. Cyan is primary; purple is additional.</p>
          {objects.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-500">Scene is currently empty.</div>
          ) : (
            objects.map((obj) => (
              <div
                key={obj.id}
                className={`flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer transition-all ${
                  selectedObjectIds.includes(obj.id)
                    ? 'bg-sky-500/15 border-sky-500 text-sky-200 font-semibold shadow-sm'
                    : 'bg-slate-950/50 border-slate-800/80 text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <button
                  type="button"
                  aria-label={`${obj.name}${obj.id === selectedObjectId ? ', primary object' : ''}`}
                  aria-describedby="outliner-selection-help"
                  aria-pressed={selectedObjectIds.includes(obj.id)}
                  onClick={(event) => onSelectObject(obj.id, event.shiftKey)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    onSelectObject(obj.id, event.shiftKey);
                  }}
                  title={`Select ${obj.name}${selectedObjectIds.includes(obj.id) ? ' (selected)' : ''}`}
                  className="flex min-w-0 flex-1 items-center gap-2 truncate text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: obj.color }} />
                  <span className="truncate">{obj.name}</span>
                  {obj.id === selectedObjectId && <span className="rounded bg-cyan-500/20 px-1 text-[9px] uppercase text-cyan-300">Primary</span>}
                </button>
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => onUpdateObject({ ...obj, visible: !obj.visible })}
                    className="p-1 text-slate-400 hover:text-slate-100"
                    aria-label={`${obj.visible ? 'Hide' : 'Show'} ${obj.name}`}
                    title={`${obj.visible ? 'Hide' : 'Show'} ${obj.name}`}
                  >
                    {obj.visible ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-600" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateObject({ ...obj, locked: !obj.locked })}
                    className="p-1 text-slate-400 hover:text-slate-100"
                    aria-label={`${obj.locked ? 'Unlock' : 'Lock'} ${obj.name}`}
                    title={`${obj.locked ? 'Unlock' : 'Lock'} ${obj.name}`}
                  >
                    {obj.locked ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Unlock className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteObject(obj.id)}
                    className="p-1 text-rose-400 hover:text-rose-300"
                    aria-label={`Delete ${obj.name}`}
                    title={`Delete ${obj.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 3: ENVIRONMENT & LIGHTING SETTINGS */}
      {rightTab === 'environment' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-200 block">Studio Environment Preset</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'studio', label: 'Clean Studio', bg: '#0f172a' },
                { key: 'sunset', label: 'Sunset Warmth', bg: '#451a03' },
                { key: 'midnight', label: 'Cyber Midnight', bg: '#020617' },
                { key: 'daylight', label: 'Soft Daylight', bg: '#1e293b' },
              ].map((theme) => (
                <button
                  key={theme.key}
                  onClick={() => onUpdateEnvironment({ ...environment, theme: theme.key as any, backgroundColor: theme.bg })}
                  className={`p-2 rounded-xl border text-left text-xs transition-all ${
                    environment.theme === theme.key
                      ? 'bg-sky-500/10 border-sky-500 text-sky-300 font-semibold'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  {theme.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sun Positioning */}
          <div className="space-y-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
            <span className="text-xs font-semibold text-slate-200">Sun Elevation & Direction</span>

            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Elevation</span>
                <span className="font-mono text-slate-400">{environment.sunElevation}°</span>
              </div>
              <input
                type="range"
                min="5"
                max="85"
                value={environment.sunElevation}
                onChange={(e) => onUpdateEnvironment({ ...environment, sunElevation: parseFloat(e.target.value) })}
                className="w-full accent-sky-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Azimuth Angle</span>
                <span className="font-mono text-slate-400">{environment.sunAzimuth}°</span>
              </div>
              <input
                type="range"
                min="0"
                max="360"
                value={environment.sunAzimuth}
                onChange={(e) => onUpdateEnvironment({ ...environment, sunAzimuth: parseFloat(e.target.value) })}
                className="w-full accent-sky-500"
              />
            </div>
          </div>

          {/* Shadow & Grid Toggles */}
          <div className="space-y-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 text-xs">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-slate-200">Real-time Soft Shadows</span>
              <input
                type="checkbox"
                checked={environment.shadows}
                onChange={(e) => onUpdateEnvironment({ ...environment, shadows: e.target.checked })}
                className="w-4 h-4 accent-sky-500"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-slate-800/60">
              <span className="text-slate-200">Viewport Grid</span>
              <input
                type="checkbox"
                checked={environment.gridVisible}
                onChange={(e) => onUpdateEnvironment({ ...environment, gridVisible: e.target.checked })}
                className="w-4 h-4 accent-sky-500"
              />
            </label>
          </div>
        </div>
      )}
    </aside>
  );
};
