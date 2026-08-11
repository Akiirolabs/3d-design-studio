import React, { useState } from 'react';
import { Sparkles, X, Loader2, Wand2, Compass, Layers } from 'lucide-react';
import { SceneObject, EnvironmentSettings } from '../types';
import { isEnvironmentTheme, validateSceneObjects } from '../utils/projectValidation';
import { getAssetCategory } from '../utils/assetCatalog';

interface AICopilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyGeneratedScene: (
    objects: SceneObject[],
    title: string,
    environmentTheme?: EnvironmentSettings['theme']
  ) => void;
}

export const AICopilotModal: React.FC<AICopilotModalProps> = ({
  isOpen,
  onClose,
  onApplyGeneratedScene,
}) => {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('modern');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async (customPrompt?: string) => {
    const finalPrompt = customPrompt || prompt;
    if (!finalPrompt.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/generate-3d', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: finalPrompt, style }),
      });

      const resData = await response.json();

      if (!response.ok || !resData.success) {
        throw new Error(resData.error || 'Failed to generate scene with Gemini AI');
      }

      const generatedData = resData.data;

      // Transform raw output to SceneObjects array
      if (!Array.isArray(generatedData.objects)) throw new Error('Generated scene objects must be an array.');
      const newObjects: SceneObject[] = generatedData.objects.map((item: any, idx: number) => {
        const category = typeof item?.type === 'string' ? getAssetCategory(item.type) : undefined;
        if (!category) throw new Error(`Generated scene was invalid: object ${idx + 1} has an unsupported asset type.`);
        return ({
        id: `ai_obj_${Date.now()}_${idx}`,
        name: item.name || `Asset ${idx + 1}`,
        category,
        type: item.type,
        position: item.position || [0, 0, 0],
        rotation: item.rotation || [0, 0, 0],
        scale: item.scale || [1, 1, 1],
        color: item.color || '#3b82f6',
        materialPreset: item.materialPreset || 'brushed_steel',
        roughness: item.roughness ?? 0.4,
        metalness: item.metalness ?? 0.2,
        transmission: item.transmission ?? 0,
        visible: true,
        locked: false,
        });
      });

      const validation = validateSceneObjects(newObjects);
      if ('error' in validation) {
        throw new Error(`Generated scene was invalid: ${validation.error}`);
      }

      if (generatedData.environmentTheme !== undefined && !isEnvironmentTheme(generatedData.environmentTheme)) {
        throw new Error('Generated scene was invalid: environmentTheme is not supported.');
      }

      if (generatedData.sceneTitle !== undefined && typeof generatedData.sceneTitle !== 'string') {
        throw new Error('Generated scene was invalid: sceneTitle must be text.');
      }

      onApplyGeneratedScene(validation.data, generatedData.sceneTitle || finalPrompt, generatedData.environmentTheme);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error communicating with server-side Gemini AI');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 bg-gradient-to-r from-sky-950/60 to-indigo-950/60 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <Sparkles className="w-4 h-4 animate-spin-slow" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">AI Architectural & Scene Generator</h3>
              <p className="text-[11px] text-slate-400">Powered by Gemini 3.6 Flash Server Engine</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Natural Language Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., A minimalist glass pavilion with walnut floor, leather sofa, marble coffee table, and warm lighting..."
              rows={3}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-colors resize-none"
            />
          </div>

          {/* Quick Presets */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 flex items-center gap-1">
              <Compass className="w-3.5 h-3.5 text-sky-400" /> Inspired Design Ideas
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { title: 'Scandinavian Lounge', p: 'Minimalist Scandinavian lounge with dark walnut wood, navy sofa, and brass floor lamp' },
                { title: 'Cyber Sky Pavilion', p: 'Futuristic glass pavilion with floating concrete columns, neon toruses, and dark granite floor' },
                { title: 'Zen Courtyard', p: 'Zen landscape with granite boulders, terracotta archway, birch tree, and polished concrete floor' },
                { title: 'Modern Executive Desk', p: 'Executive office layout with anodized aluminum desk, glass panel partition, and potted monstera' },
              ].map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setPrompt(item.p);
                    handleGenerate(item.p);
                  }}
                  className="p-2.5 rounded-xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800/80 text-left text-xs transition-all text-slate-300 hover:text-white group"
                >
                  <span className="font-semibold block text-slate-200 group-hover:text-sky-300">{item.title}</span>
                  <span className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{item.p}</span>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300">
              {error}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={() => handleGenerate()}
            disabled={loading || !prompt.trim()}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-600 hover:brightness-110 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-500/20 disabled:opacity-40 transition-all"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Architecting 3D Scene...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                Generate Scene
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
