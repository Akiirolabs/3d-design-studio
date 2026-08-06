import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import {
  ProjectData,
  SceneObject,
  EnvironmentSettings,
  TransformMode,
  ViewportRenderMode,
  AssetTemplate,
  CloudSession,
} from './types';
import {
  getInitialProject,
  saveProjectToStorage,
  getInitialCloudSession,
  generateRoomCode,
} from './utils/storage';
import { captureRenderSnapshot } from './utils/exporters';
import { Header } from './components/Header';
import { SidebarLeft } from './components/SidebarLeft';
import { SidebarRight } from './components/SidebarRight';
import { Canvas3D } from './components/Canvas3D';
import { ExportModal } from './components/ExportModal';
import { AICopilotModal } from './components/AICopilotModal';
import { CloudSyncModal } from './components/CloudSyncModal';
import { ShortcutsModal } from './components/ShortcutsModal';

export default function App() {
  // Main Project State
  const [project, setProject] = useState<ProjectData>(getInitialProject);

  // Undo / Redo Stack
  const [history, setHistory] = useState<ProjectData[]>([getInitialProject()]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Selection & Tools
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>('obj_sofa');
  const [transformMode, setTransformMode] = useState<TransformMode>('translate');
  const [renderMode, setRenderMode] = useState<ViewportRenderMode>('shaded');

  // Cloud Sync Session
  const [cloudSession, setCloudSession] = useState<CloudSession>(() =>
    getInitialCloudSession(generateRoomCode(), project.name)
  );

  // Three.js References for Exporting & Snapshots
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);

  // Modal Visibility
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [aiCopilotOpen, setAiCopilotOpen] = useState(false);
  const [cloudSyncOpen, setCloudSyncOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Save changes to localStorage & update history stack
  const pushStateToHistory = useCallback(
    (newProject: ProjectData) => {
      setProject(newProject);
      saveProjectToStorage(newProject);

      const updatedHistory = history.slice(0, historyIndex + 1);
      updatedHistory.push(newProject);
      if (updatedHistory.length > 50) updatedHistory.shift();

      setHistory(updatedHistory);
      setHistoryIndex(updatedHistory.length - 1);
    },
    [history, historyIndex]
  );

  // Undo & Redo Handlers
  const handleUndo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      setProject(prev);
      saveProjectToStorage(prev);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      setProject(next);
      saveProjectToStorage(next);
    }
  };

  // Add Asset from Library
  const handleAddAsset = (template: AssetTemplate) => {
    const newObj: SceneObject = {
      id: `obj_${Date.now()}`,
      name: `${template.name} ${project.objects.length + 1}`,
      category: template.category,
      type: template.type,
      position: [0, 1, 0],
      rotation: [0, 0, 0],
      scale: template.defaultScale,
      color: template.defaultColor,
      materialPreset: template.defaultMaterial,
      metalness: 0.1,
      roughness: 0.4,
      transmission: 0,
      visible: true,
      locked: false,
    };

    const updatedObjects = [...project.objects, newObj];
    const updatedProject = { ...project, objects: updatedObjects };
    pushStateToHistory(updatedProject);
    setSelectedObjectId(newObj.id);
  };

  // Update Object (Transform or Material)
  const handleUpdateObject = (updatedObj: SceneObject) => {
    const updatedObjects = project.objects.map((o) => (o.id === updatedObj.id ? updatedObj : o));
    const updatedProject = { ...project, objects: updatedObjects };
    pushStateToHistory(updatedProject);
  };

  // Update Object Transform directly from Gizmo drag
  const handleUpdateObjectTransform = (
    id: string,
    position: [number, number, number],
    rotation: [number, number, number],
    scale: [number, number, number]
  ) => {
    const target = project.objects.find((o) => o.id === id);
    if (target) {
      const updatedObj = { ...target, position, rotation, scale };
      const updatedObjects = project.objects.map((o) => (o.id === id ? updatedObj : o));
      const updatedProject = { ...project, objects: updatedObjects };
      pushStateToHistory(updatedProject);
    }
  };

  // Duplicate Object
  const handleDuplicateObject = (id: string) => {
    const target = project.objects.find((o) => o.id === id);
    if (!target) return;

    const dup: SceneObject = {
      ...target,
      id: `obj_dup_${Date.now()}`,
      name: `${target.name} Copy`,
      position: [target.position[0] + 0.5, target.position[1], target.position[2] + 0.5],
    };

    const updatedObjects = [...project.objects, dup];
    const updatedProject = { ...project, objects: updatedObjects };
    pushStateToHistory(updatedProject);
    setSelectedObjectId(dup.id);
  };

  // Delete Object
  const handleDeleteObject = (id: string) => {
    const updatedObjects = project.objects.filter((o) => o.id !== id);
    const updatedProject = { ...project, objects: updatedObjects };
    pushStateToHistory(updatedProject);
    if (selectedObjectId === id) {
      setSelectedObjectId(null);
    }
  };

  // Update Environment Settings
  const handleUpdateEnvironment = (env: EnvironmentSettings) => {
    const updatedProject = { ...project, environment: env };
    pushStateToHistory(updatedProject);
  };

  // Import JSON Project
  const handleImportProjectJSON = (jsonData: string) => {
    try {
      const parsed = JSON.parse(jsonData);
      if (parsed.objects && Array.isArray(parsed.objects)) {
        setProject(parsed);
        pushStateToHistory(parsed);
      }
    } catch (e) {
      alert('Invalid 3D Project JSON file.');
    }
  };

  // Apply AI-Generated Scene
  const handleApplyAIScene = (
    newObjects: SceneObject[],
    title: string,
    theme?: EnvironmentSettings['theme']
  ) => {
    const updatedEnv = theme
      ? { ...project.environment, theme }
      : project.environment;

    const newProject: ProjectData = {
      ...project,
      name: title,
      objects: newObjects,
      environment: updatedEnv,
    };
    pushStateToHistory(newProject);
    if (newObjects.length > 0) {
      setSelectedObjectId(newObjects[0].id);
    }
  };

  // Register WebGL Renderer & Scene refs
  const handleRegisterRenderer = (renderer: THREE.WebGLRenderer, scene: THREE.Scene) => {
    rendererRef.current = renderer;
    sceneRef.current = scene;
  };

  // Snapshot Capture
  const handleTakeSnapshot = () => {
    if (rendererRef.current) {
      captureRenderSnapshot(rendererRef.current, `${project.name.toLowerCase().replace(/\s+/g, '_')}_render.png`);
    }
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        if (selectedObjectId) handleDuplicateObject(selectedObjectId);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (selectedObjectId) handleDeleteObject(selectedObjectId);
      } else if (e.key.toLowerCase() === 'g' || e.key.toLowerCase() === 't') {
        setTransformMode('translate');
      } else if (e.key.toLowerCase() === 'r') {
        setTransformMode('rotate');
      } else if (e.key.toLowerCase() === 's') {
        setTransformMode('scale');
      } else if (e.key === 'Escape') {
        setSelectedObjectId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedObjectId, historyIndex, history]);

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Sleek Header */}
      <Header
        projectName={project.name}
        onUpdateProjectName={(name) => pushStateToHistory({ ...project, name })}
        renderMode={renderMode}
        onChangeRenderMode={setRenderMode}
        onOpenExportModal={() => setExportModalOpen(true)}
        onOpenAICopilot={() => setAiCopilotOpen(true)}
        onOpenCloudSync={() => setCloudSyncOpen(true)}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        onTakeSnapshot={handleTakeSnapshot}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onUndo={handleUndo}
        onRedo={handleRedo}
        cloudSession={cloudSession}
      />

      {/* Main Studio Viewport & Sidebars */}
      <div className="flex flex-1 relative overflow-hidden">
        {/* Left Asset & Primitives Library */}
        <SidebarLeft
          onAddAsset={handleAddAsset}
          transformMode={transformMode}
          onChangeTransformMode={setTransformMode}
          onImportProjectJSON={handleImportProjectJSON}
        />

        {/* Central 3D Interactive Viewport */}
        <main className="flex-1 h-full relative">
          <Canvas3D
            objects={project.objects}
            selectedObjectId={selectedObjectId}
            onSelectObject={setSelectedObjectId}
            onUpdateObjectTransform={handleUpdateObjectTransform}
            environment={project.environment}
            transformMode={transformMode}
            renderMode={renderMode}
            onRegisterRenderer={handleRegisterRenderer}
          />
        </main>

        {/* Right Inspector & Hierarchy Panel */}
        <SidebarRight
          objects={project.objects}
          selectedObjectId={selectedObjectId}
          onSelectObject={setSelectedObjectId}
          onUpdateObject={handleUpdateObject}
          onDeleteObject={handleDeleteObject}
          onDuplicateObject={handleDuplicateObject}
          environment={project.environment}
          onUpdateEnvironment={handleUpdateEnvironment}
        />
      </div>

      {/* Modals */}
      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        scene={sceneRef.current}
        project={project}
      />

      <AICopilotModal
        isOpen={aiCopilotOpen}
        onClose={() => setAiCopilotOpen(false)}
        onApplyGeneratedScene={handleApplyAIScene}
      />

      <CloudSyncModal
        isOpen={cloudSyncOpen}
        onClose={() => setCloudSyncOpen(false)}
        cloudSession={cloudSession}
        onUpdateCloudSession={setCloudSession}
        project={project}
      />

      <ShortcutsModal
        isOpen={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </div>
  );
}
