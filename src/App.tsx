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
  loadSavedProjects,
  getInitialCloudSession,
  generateRoomCode,
} from './utils/storage';
import { captureRenderSnapshot } from './utils/exporters';
import { canPersistProject, objectsWithPreview } from './utils/projectPreview';
import { normalizeAndValidateProjectData } from './utils/projectValidation';
import { Header } from './components/Header';
import { SidebarLeft } from './components/SidebarLeft';
import { SidebarRight } from './components/SidebarRight';
import { Canvas3D } from './components/Canvas3D';
import { ExportModal } from './components/ExportModal';CopilotModal } from './components/AICopilotModal';
import { CloudSyncModal } from './components/CloudSyncModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { SettingsModal } from './components/SettingsModal';
import {
  accountApi,
  getGuestPreferences,
  saveGuestPreferences,
  type AccountPreferences,
  type AccountUser,
} from './utils/accountApi';
import { createLatestAsyncRunner, createPreferenceUpdateQueue, persistPreferenceChange } from './utils/accountState';
import { alignSelectedObjectPivots, getAlignmentIssue, reconcileSelection, resolvePrimaryActionId, selectObject, type SelectionState } from './utils/multiSelection';
import { applyBooleanSubtraction, hasBooleanDependency, removeBooleanSubtraction, updateTransformWithBooleanGuard } from './utils/booleanGeometry';

export default function App() {
  // Main Project State
  const [project, setProject] = useState<ProjectData>(getInitialProject);
  const [previewObject, setPreviewObject] = useState<SceneObject | null>(null);

  // Undo / Redo Stack
  const [history, setHistory] = useState<ProjectData[]>([getInitialProject()]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Selection & Tools
  const [selection, setSelection] = useState<SelectionState>(() => reconcileSelection(getInitialProject().objects, { ids: ['obj_sofa'], primaryId: 'obj_sofa' }, true));
  const selectedObjectId = selection.primaryId;
  const selectedObjectIds = selection.ids;
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accountUser, setAccountUser] = useState<AccountUser | null>(null);
  const [preferences, setPreferences] = useState<AccountPreferences>(getGuestPreferences);
  const [cloudProjects, setCloudProjects] = useState<ProjectData[]>([]);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountNotice, setAccountNotice] = useState<string | null>(null);
  const [modelingNotice, setModelingNotice] = useState<string | null>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const accountUserRef = useRef<AccountUser | null>(null);
  const authSessionRef = useRef(0);
  const autosaveRunnerRef = useRef(createLatestAsyncRunner<{ project: ProjectData; userId: string; session: number }>(async (pending, signal) => {
    if (pending.session !== authSessionRef.current || pending.userId !== accountUserRef.current?.id) return;
    const result = await accountApi.saveProject(pending.project, signal);
    if (signal.aborted || pending.session !== authSessionRef.current || pending.userId !== accountUserRef.current?.id) return;
    setCloudProjects(current => current.map(saved => saved.id === result.project.id ? result.project : saved));
  }));
  const preferenceQueueRef = useRef(createPreferenceUpdateQueue(
    preferences,
    async desired => persistPreferenceChange(desired, desired, accountUserRef.current, accountApi.preferences, saveGuestPreferences),
    setPreferences,
  ));
  const beginAccountSession = useCallback((user: AccountUser | null, nextPreferences: AccountPreferences) => {
    authSessionRef.current += 1;
    autosaveRunnerRef.current.reset();
    accountUserRef.current = user;
    setAccountUser(user);
    preferenceQueueRef.current.reset(nextPreferences);
  }, []);
  const currentProjectStored = cloudProjects.some(saved => saved.id === project.id);
  const handleSelectObject = useCallback((id: string | null, additive = false) => {
    setPreviewObject(null);
    setSelection(current => selectObject(current, id, additive));
  }, []);

  const handleAlignObjects = (axis: 0 | 1 | 2, mode: 'min' | 'center' | 'max') => {
    const issue = getAlignmentIssue(project.objects, selectedObjectIds);
    if (issue) return;
    const objects = alignSelectedObjectPivots(project.objects, selectedObjectIds, axis, mode);
    if (objects) pushStateToHistory({ ...project, objects });
  };

  const handleApplyBoolean = (targetId: string, cutterId: string) => {
    try {
      const objects = applyBooleanSubtraction(project.objects, targetId, cutterId);
      pushStateToHistory({ ...project, objects });
      setSelection({ ids: [targetId], primaryId: targetId });
      setModelingNotice('Hole applied. The cutter remains hidden and recoverable.');
    } catch (error) {
      setModelingNotice(error instanceof Error ? error.message : 'Could not create the hole.');
    }
  };

  const handleRemoveBoolean = (targetId: string) => {
    const objects = removeBooleanSubtraction(project.objects, targetId);
    if (objects !== project.objects) {
      pushStateToHistory({ ...project, objects });
      setModelingNotice('Hole removed. The cutter was restored and is editable again.');
    }
  };

  const accountAction = useCallback(async (action: () => Promise<void>) => {
    setAccountBusy(true); setAccountError(null); setAccountNotice(null);
    try { await action(); } catch (error) { setAccountError(error instanceof Error ? error.message : 'Something went wrong.'); }
    finally { setAccountBusy(false); }
  }, []);

  const refreshCloudProjects = useCallback(async () => {
    const result = await accountApi.projects();
    setCloudProjects(result.projects);
  }, []);

  useEffect(() => {
    void accountApi.session().then(session => {
      if (session.authenticated && session.user && session.preferences) {
        beginAccountSession(session.user, session.preferences);
        void refreshCloudProjects().catch(() => setAccountError('Could not load cloud designs.'));
      }
    }).catch(() => setAccountError('Account services are unavailable. Guest designs still work.'));
  }, [beginAccountSession, refreshCloudProjects]);

  useEffect(() => {
    document.documentElement.dataset.appTheme = preferences.theme;
    document.documentElement.dataset.reducedMotion = String(preferences.reducedMotion);
  }, [preferences.theme, preferences.reducedMotion]);

  useEffect(() => {
    if (!accountUser || !preferences.autosave || !currentProjectStored || !canPersistProject(previewObject)) return;
    const timer = window.setTimeout(() => {
      void autosaveRunnerRef.current({ project, userId: accountUser.id, session: authSessionRef.current }).catch(error => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setAccountError('Cloud autosave failed. Your local design is safe.');
      });
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [project, previewObject, accountUser, preferences.autosave, currentProjectStored, refreshCloudProjects]);

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
      setSelection(current => reconcileSelection(prev.objects, current));
      saveProjectToStorage(prev);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      setProject(next);
      setSelection(current => reconcileSelection(next.objects, current));
      saveProjectToStorage(next);
    }
  };

  // Add Asset from Library
  const handleAddAsset = (template: AssetTemplate) => {
    const count = project.objects.length;
    const offsetX = count > 0 ? ((count * 1.5) % 6) - 2 : 0;
    const offsetZ = count > 0 ? (Math.floor(count / 4) * 1.5) % 6 - 2 : 0;

    const newObj: SceneObject = {
      id: `obj_${Date.now()}`,
      name: `${template.name} ${count + 1}`,
      category: template.category,
      type: template.type,
      position: [offsetX, 1, offsetZ],
      rotation: [0, 0, 0],
      scale: template.defaultScale,
      color: template.defaultColor,
      materialPreset: template.defaultMaterial,
      metalness: 0.1,
      roughness: 0.4,
      transmission: 0,
      visible: true,
      locked: false,
      ...(template.type === 'parametric-extrusion' ? {
        geometry: {
          kind: 'parametric-extrusion' as const,
          profile: [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]] as [number, number][],
          height: 1,
          baseScale: 1,
          topScale: 1,
          twistAngle: 0,
          twistSteps: 12,
          twistMode: 'smooth' as const,
        },
      } : {}),
    };

    const updatedObjects = [...project.objects, newObj];
    const updatedProject = { ...project, objects: updatedObjects };
    pushStateToHistory(updatedProject);
    setSelection({ ids: [newObj.id], primaryId: newObj.id });
  };

  // Update Object (Transform or Material)
  const handleUpdateObject = (updatedObj: SceneObject) => {
    setPreviewObject(null);
    const updatedObjects = project.objects.map((o) => (o.id === updatedObj.id ? updatedObj : o));
    const updatedProject = { ...project, objects: updatedObjects };
    pushStateToHistory(updatedProject);
  };

  const handlePreviewObject = (updatedObj: SceneObject | null) => {
    setPreviewObject(updatedObj);
  };

  // Real-time live update for continuous Gizmo drag (updates project state smoothly without history overhead)
  const handleLiveUpdateObjectTransform = useCallback(
    (
      id: string,
      position: [number, number, number],
      rotation: [number, number, number],
      scale: [number, number, number]
    ) => {
      setProject((prev) => {
        const target = prev.objects.find((o) => o.id === id);
        if (!target) return prev;
        // Applied Boolean solids are recomputed only once, after the gizmo drag
        // commits. Their live Three.js preview must never enter persisted state.
        if (hasBooleanDependency(prev.objects, id)) return prev;

        if (
          target.position[0] === position[0] &&
          target.position[1] === position[1] &&
          target.position[2] === position[2] &&
          target.rotation[0] === rotation[0] &&
          target.rotation[1] === rotation[1] &&
          target.rotation[2] === rotation[2] &&
          target.scale[0] === scale[0] &&
          target.scale[1] === scale[1] &&
          target.scale[2] === scale[2]
        ) {
          return prev;
        }

        const updatedObj = { ...target, position, rotation, scale };
        const updatedObjects = prev.objects.map((o) => (o.id === id ? updatedObj : o));
        return { ...prev, objects: updatedObjects };
      });
    },
    []
  );

  // Update Object Transform directly from Gizmo drag (commits transform state to history & localStorage)
  const handleUpdateObjectTransform = (
    id: string,
    position: [number, number, number],
    rotation: [number, number, number],
    scale: [number, number, number]
  ) => {
    const target = project.objects.find((o) => o.id === id);
    if (target) {
      const result=updateTransformWithBooleanGuard(project.objects,id,position,rotation,scale);
      if(result.error){
        setProject(project);
        setModelingNotice(result.error);
        return;
      }
      pushStateToHistory({ ...project, objects: result.objects });
    }
  };

  // Duplicate Object
  const handleDuplicateObject = (id: string) => {
    const target = project.objects.find((o) => o.id === id);
    if (!target) return;
    if (hasBooleanDependency(project.objects, id)) {
      setModelingNotice('Remove the Boolean hole before duplicating its target or cutter.');
      return;
    }

    const dup: SceneObject = {
      ...target,
      id: `obj_dup_${Date.now()}`,
      name: `${target.name} Copy`,
      position: [target.position[0] + 0.5, target.position[1], target.position[2] + 0.5],
    };

    const updatedObjects = [...project.objects, dup];
    const updatedProject = { ...project, objects: updatedObjects };
    pushStateToHistory(updatedProject);
    setSelection({ ids: [dup.id], primaryId: dup.id });
  };

  // Delete Object
  const handleDeleteObject = (id: string) => {
    if (preferences.confirmDelete && !window.confirm('Delete this object?')) return;
    const target = project.objects.find(o => o.id === id);
    if (target?.boolean || target?.holeForId || project.objects.some(o => o.boolean?.cutterId === id)) {
      setModelingNotice('Remove the Boolean hole before deleting its target or cutter.');
      return;
    }
    const updatedObjects = project.objects.filter((o) => o.id !== id);
    const updatedProject = { ...project, objects: updatedObjects };
    pushStateToHistory(updatedProject);
    setSelection(current => reconcileSelection(updatedObjects, current));
  };

  // Update Environment Settings
  const handleUpdateEnvironment = (env: EnvironmentSettings) => {
    const updatedProject = { ...project, environment: env };
    pushStateToHistory(updatedProject);
  };

  // Import JSON Project
  const handleImportProjectJSON = (jsonData: string) => {
    try {
      const result = normalizeAndValidateProjectData(JSON.parse(jsonData));
      if ('error' in result) {
        alert(`Could not import project: ${result.error}`);
        return;
      }
      pushStateToHistory(result.data);
      setSelection(current => reconcileSelection(result.data.objects, current, true));
    } catch (e) {
      alert('Could not import project: the selected file is not valid JSON.');
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
    setSelection(reconcileSelection(newObjects, { ids: [], primaryId: null }, true));
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
      if (settingsOpen) return;
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
        const primaryId = resolvePrimaryActionId(project.objects, selection);
        if (primaryId) handleDuplicateObject(primaryId);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        const primaryId = resolvePrimaryActionId(project.objects, selection);
        if (primaryId) handleDeleteObject(primaryId);
      } else if (e.key.toLowerCase() === 'g' || e.key.toLowerCase() === 't') {
        setTransformMode('translate');
      } else if (e.key.toLowerCase() === 'r') {
        setTransformMode('rotate');
      } else if (e.key.toLowerCase() === 's') {
        setTransformMode('scale');
      } else if (e.key === 'Escape') {
        setSelection({ ids: [], primaryId: null });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selection, project.objects, historyIndex, history, settingsOpen]);

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <div role="status" aria-live="polite" className="sr-only">{modelingNotice}</div>
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
        onOpenSettings={() => {
          setExportModalOpen(false); setAiCopilotOpen(false); setCloudSyncOpen(false); setShortcutsOpen(false);
          setSettingsOpen(true);
        }}
        settingsButtonRef={settingsButtonRef}
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
            objects={objectsWithPreview(project, previewObject)}
            selectedObjectId={selectedObjectId}
            selectedObjectIds={selectedObjectIds}
            onSelectObject={handleSelectObject}
            onUpdateObjectTransform={handleUpdateObjectTransform}
            onLiveUpdateObjectTransform={handleLiveUpdateObjectTransform}
            environment={project.environment}
            transformMode={transformMode}
            renderMode={renderMode}
            onRegisterRenderer={handleRegisterRenderer}
            shortcutsDisabled={settingsOpen}
            onModelingNotice={setModelingNotice}
          />
        </main>

        {/* Right Inspector & Hierarchy Panel */}
        <SidebarRight
          objects={project.objects}
          selectedObjectId={selectedObjectId}
          selectedObjectIds={selectedObjectIds}
          onSelectObject={handleSelectObject}
          onAlignObjects={handleAlignObjects}
          onApplyBoolean={handleApplyBoolean}
          onRemoveBoolean={handleRemoveBoolean}
          alignmentIssue={getAlignmentIssue(project.objects, selectedObjectIds)}
          onUpdateObject={handleUpdateObject}
          onPreviewObject={handlePreviewObject}
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

      <SettingsModal
        isOpen={settingsOpen}
        onClose={closeSettings}
        returnFocusRef={settingsButtonRef}
        user={accountUser}
        preferences={preferences}
        projects={cloudProjects}
        busy={accountBusy}
        error={accountError}
        notice={accountNotice}
        onAuthenticate={async (mode, username, password) => accountAction(async () => {
          const result = mode === 'signup' ? await accountApi.signup(username, password) : await accountApi.signin(username, password);
          beginAccountSession(result.user, result.preferences); await refreshCloudProjects();
          setAccountNotice(mode === 'signup' ? 'Account created. Import guest designs when you are ready.' : 'Signed in. Import guest designs when you are ready.');
        })}
        onSignout={async () => accountAction(async () => {
          autosaveRunnerRef.current.reset();
          await accountApi.signout(); setCloudProjects([]);
          const guestPreferences = getGuestPreferences(); beginAccountSession(null, guestPreferences); setAccountNotice('Signed out. You are using guest mode.');
        })}
        onChangeUsername={async username => accountAction(async () => {
          const result = await accountApi.changeUsername(username); setAccountUser(result.user); setAccountNotice('Username changed.');
        })}
        onChangePassword={async (currentPassword, newPassword) => accountAction(async () => {
          await accountApi.changePassword(currentPassword, newPassword); setAccountNotice('Password changed. Other sessions were signed out.');
        })}
        onPreferences={async next => accountAction(async () => { await preferenceQueueRef.current.update(next); })}
        onSave={async () => accountAction(async () => {
          await accountApi.saveProject(project); await refreshCloudProjects(); setAccountNotice('Design saved to your account.');
        })}
        onLoad={cloudProject => {
          setProject(cloudProject); setHistory([cloudProject]); setHistoryIndex(0); saveProjectToStorage(cloudProject);
          setSelection(current => reconcileSelection(cloudProject.objects, current, true)); setAccountNotice(`Loaded ${cloudProject.name}.`); setSettingsOpen(false);
        }}
        onDelete={async cloudProject => accountAction(async () => {
          if (preferences.confirmDelete && !window.confirm(`Delete ${cloudProject.name} from your account?`)) return;
          await accountApi.deleteProject(cloudProject.id); await refreshCloudProjects(); setAccountNotice('Cloud design deleted.');
        })}
        onImportGuest={async () => accountAction(async () => {
          const result = await accountApi.importProjects(loadSavedProjects()); await refreshCloudProjects();
          setAccountNotice(`Imported ${result.imported.length}; skipped ${result.skipped.length} already stored.`);
        })}
      />
    </div>
  );
}
