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
import { ExportModal } from './components/ExportModal';
import { AICopilotModal } from './components/AICopilotModal';
import { CloudSyncModal } from './components/CloudSyncModal';
import { SavedVersionsModal } from './components/SavedVersionsModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { SettingsModal } from './components/SettingsModal';
import {
  accountApi,
  getGuestPreferences,
  saveGuestPreferences,
  type AccountPreferences,
  type AccountUser,
  type NamedSnapshot,
} from './utils/accountApi';
import { commitWithNonfatalRefresh, createLatestAsyncRunner, createPreferenceUpdateQueue, persistPreferenceChange, removeSnapshot, upsertSnapshot } from './utils/accountState';
import { alignSelectedObjectPivots, getAlignmentIssue, reconcileSelection, resolvePrimaryActionId, selectObject, type SelectionState } from './utils/multiSelection';
import { applyBooleanSubtraction, hasBooleanDependency, removeBooleanSubtraction, updateTransformWithBooleanGuard } from './utils/booleanGeometry';
import {canAutosaveCurrentWorkspace,editorShortcutsDisabled,isActiveHydration,isActiveHydrationOperation,type WorkspaceHydrationStatus} from './utils/accountHydration';

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

  // Three.js References for Exporting & Snapshots
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);

  // Modal Visibility
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [aiCopilotOpen, setAiCopilotOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [cloudSyncOpen,setCloudSyncOpen]=useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accountUser, setAccountUser] = useState<AccountUser | null>(null);
  const [preferences, setPreferences] = useState<AccountPreferences>(getGuestPreferences);
  const [snapshots,setSnapshots]=useState<NamedSnapshot[]>([]);
  const [autosaveStatus,setAutosaveStatus]=useState('Waiting to sync…');
  const [workspaceHydration,setWorkspaceHydration]=useState<WorkspaceHydrationStatus>('idle');
  const [cloudSession,setCloudSession]=useState<CloudSession>(()=>getInitialCloudSession(generateRoomCode(),project.name));
  const [snapshotsLoading,setSnapshotsLoading]=useState(false);const [snapshotCorruptCount,setSnapshotCorruptCount]=useState(0);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountNotice, setAccountNotice] = useState<string | null>(null);
  const [modelingNotice, setModelingNotice] = useState<string | null>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const cloudButtonRef=useRef<HTMLButtonElement>(null);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const accountUserRef = useRef<AccountUser | null>(null);
  const authSessionRef = useRef(0);
  const hydrationOperationRef=useRef(0);
  const autosaveRunnerRef = useRef(createLatestAsyncRunner<{ project: ProjectData; userId: string; session: number }>(async (pending, signal) => {
    if (pending.session !== authSessionRef.current || pending.userId !== accountUserRef.current?.id) return;
    setAutosaveStatus('Saving current version…');
    const result = await accountApi.saveCurrentWorkspace(pending.project, signal);
    if (signal.aborted || pending.session !== authSessionRef.current || pending.userId !== accountUserRef.current?.id) return;
    setAutosaveStatus(`Saved ${new Date(result.updatedAt).toLocaleTimeString()}`);
  }));
  const preferenceQueueRef = useRef(createPreferenceUpdateQueue(
    preferences,
    async desired => persistPreferenceChange(desired, desired, accountUserRef.current, accountApi.preferences, saveGuestPreferences),
    setPreferences,
  ));
  const beginAccountSession = useCallback((user: AccountUser | null, nextPreferences: AccountPreferences) => {
    authSessionRef.current += 1;
    hydrationOperationRef.current+=1;
    autosaveRunnerRef.current.reset();
    accountUserRef.current = user;
    setAccountUser(user);
    setWorkspaceHydration(user?'loading':'idle');
    preferenceQueueRef.current.reset(nextPreferences);
  }, []);
  const applyWorkspace = useCallback((loaded:ProjectData) => {
    setProject(loaded);setHistory([loaded]);setHistoryIndex(0);saveProjectToStorage(loaded);
    setSelection(reconcileSelection(loaded.objects,{ids:[],primaryId:null},true));setPreviewObject(null);
  },[]);
  const hydrateCurrentWorkspace = useCallback(async(user:AccountUser) => {
    const session=authSessionRef.current;
    const operation=++hydrationOperationRef.current;
    setWorkspaceHydration('loading');setAutosaveStatus('Loading current version…');
    try{
      const result=await accountApi.currentWorkspace();
      if(!isActiveHydration(session,user.id,authSessionRef.current,accountUserRef.current?.id)||!isActiveHydrationOperation(operation,hydrationOperationRef.current))return false;
      if(result.project)applyWorkspace(result.project);
      setAutosaveStatus(result.project?(result.updatedAt?`Saved ${new Date(result.updatedAt).toLocaleTimeString()}`:'Current version loaded'):'Ready to save current version');
      setWorkspaceHydration('ready');setAccountError(null);return true;
    }catch{
      if(!isActiveHydration(session,user.id,authSessionRef.current,accountUserRef.current?.id)||!isActiveHydrationOperation(operation,hydrationOperationRef.current))return false;
      setWorkspaceHydration('failed');setAutosaveStatus('Current version could not be loaded');
      setAccountError('Could not load Current Version. Cloud autosave is paused to protect your saved work. Retry when ready.');return false;
    }
  },[applyWorkspace]);
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
    setSnapshotsLoading(true);
    try{const snapshotsResult=await accountApi.snapshots();
    setSnapshots(snapshotsResult.snapshots);setSnapshotCorruptCount(snapshotsResult.skippedCorrupt?.length??0);}finally{setSnapshotsLoading(false);}
  }, []);

  useEffect(() => {
    void accountApi.session().then(session => {
      if (session.authenticated && session.user && session.preferences) {
        beginAccountSession(session.user, session.preferences);
        void hydrateCurrentWorkspace(session.user);
        void refreshCloudProjects().catch(() => setAccountError('Could not load saved versions.'));
      }
    }).catch(() => setAccountError('Account services are unavailable. Guest designs still work.'));
  }, [beginAccountSession, hydrateCurrentWorkspace, refreshCloudProjects]);

  useEffect(() => {
    document.documentElement.dataset.appTheme = preferences.theme;
    document.documentElement.dataset.reducedMotion = String(preferences.reducedMotion);
  }, [preferences.theme, preferences.reducedMotion]);

  useEffect(() => {
    if (!canAutosaveCurrentWorkspace(accountUser?.id,workspaceHydration) || !accountUser || !canPersistProject(previewObject)) return;
    const timer = window.setTimeout(() => {
      void autosaveRunnerRef.current({ project, userId: accountUser.id, session: authSessionRef.current }).catch(error => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {setAutosaveStatus('Autosave failed — local recovery is safe');setAccountError('Cloud autosave failed. Your local design is safe.');}
      });
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [project, previewObject, accountUser,workspaceHydration]);

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
        return false;
      }
      pushStateToHistory({ ...project, objects: result.objects });
      return true;
    }
    return false;
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
      if (editorShortcutsDisabled(settingsOpen,cloudSyncOpen)) return;
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
  }, [selection, project.objects, historyIndex, history, settingsOpen,cloudSyncOpen]);

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
        onOpenCloudSync={()=>{setCloudSyncOpen(true);setSettingsOpen(false);if(workspaceHydration!=='failed')setAccountError(null);setAccountNotice(null);if(accountUser)void refreshCloudProjects().catch(()=>setAccountError('Could not load saved versions.'));}}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        onTakeSnapshot={handleTakeSnapshot}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onOpenSettings={() => {
          setExportModalOpen(false); setAiCopilotOpen(false); setCloudSyncOpen(false);setShortcutsOpen(false);
          setSettingsOpen(true);
        }}
        settingsButtonRef={settingsButtonRef}
        cloudButtonRef={cloudButtonRef}
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
            shortcutsDisabled={editorShortcutsDisabled(settingsOpen,cloudSyncOpen)}
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
        busy={accountBusy}
        error={accountError}
        notice={accountNotice}
        onAuthenticate={async (mode, username, password) => accountAction(async () => {
          const result = mode === 'signup' ? await accountApi.signup(username, password) : await accountApi.signin(username, password);
          beginAccountSession(result.user, result.preferences); await Promise.all([hydrateCurrentWorkspace(result.user),refreshCloudProjects()]);
          setAccountNotice(mode === 'signup' ? 'Account created. Import guest designs when you are ready.' : 'Signed in. Import guest designs when you are ready.');
        })}
        onSignout={async () => accountAction(async () => {
          autosaveRunnerRef.current.reset();
          await accountApi.signout(); setSnapshots([]);
          const guestPreferences = getGuestPreferences(); beginAccountSession(null, guestPreferences); setAccountNotice('Signed out. You are using guest mode.');
        })}
        onChangeUsername={async username => accountAction(async () => {
          const result = await accountApi.changeUsername(username); setAccountUser(result.user); setAccountNotice('Username changed.');
        })}
        onChangePassword={async (currentPassword, newPassword) => accountAction(async () => {
          await accountApi.changePassword(currentPassword, newPassword); setAccountNotice('Password changed. Other sessions were signed out.');
        })}
        onPreferences={async next => accountAction(async () => { await preferenceQueueRef.current.update(next); })}
        onImportGuest={async () => accountAction(async () => {
          const result = await accountApi.importProjects(loadSavedProjects()); await refreshCloudProjects();
          setAccountNotice(`Imported ${result.imported.length}; skipped ${result.skipped.length} already stored.`);
        })}
        cloudSection={<CloudSyncModal embedded isOpen onClose={()=>undefined} returnFocusRef={settingsButtonRef} cloudSession={cloudSession} onUpdateCloudSession={setCloudSession}/>}
      />
      <SavedVersionsModal isOpen={cloudSyncOpen} onClose={()=>setCloudSyncOpen(false)} returnFocusRef={cloudButtonRef} authenticated={Boolean(accountUser)} snapshots={snapshots} loading={snapshotsLoading} corruptCount={snapshotCorruptCount} busy={accountBusy} error={accountError} notice={accountNotice} currentProjectName={project.name} autosaveStatus={autosaveStatus} workspaceReady={workspaceHydration==='ready'} canRetryHydration={workspaceHydration==='failed'} onRetryHydration={async()=>{if(accountUser)await hydrateCurrentWorkspace(accountUser);}}
        onCreateSnapshot={async name=>{if(workspaceHydration!=='ready')return false;setAccountBusy(true);setAccountError(null);setAccountNotice(null);try{if(workspaceHydration!=='ready')return false;await commitWithNonfatalRefresh(()=>accountApi.createSnapshot(name,structuredClone(project)),result=>setSnapshots(current=>upsertSnapshot(current,result.snapshot)),refreshCloudProjects);setAccountNotice('Version saved.');return true;}catch(error){setAccountError(error instanceof Error?error.message:'Could not save version.');return false;}finally{setAccountBusy(false);}}}
        onLoadSnapshot={async snapshot=>{if(workspaceHydration!=='ready')return;await accountAction(async()=>{if(workspaceHydration!=='ready')return;const session=authSessionRef.current;const userId=accountUserRef.current?.id;if(!userId)return;const operation=++hydrationOperationRef.current;setWorkspaceHydration('loading');setAutosaveStatus('Finishing current autosave…');try{await autosaveRunnerRef.current.awaitIdle();if(!isActiveHydration(session,userId,authSessionRef.current,accountUserRef.current?.id)||!isActiveHydrationOperation(operation,hydrationOperationRef.current))return;const result=await accountApi.loadSnapshot(snapshot.id);if(!isActiveHydration(session,userId,authSessionRef.current,accountUserRef.current?.id)||!isActiveHydrationOperation(operation,hydrationOperationRef.current))return;autosaveRunnerRef.current.reset();const loaded=structuredClone(result.project);applyWorkspace(loaded);setAutosaveStatus(`Saved ${new Date(result.updatedAt).toLocaleTimeString()}`);setAccountNotice(`${snapshot.name} loaded into Current Version.`);}finally{if(isActiveHydration(session,userId,authSessionRef.current,accountUserRef.current?.id)&&isActiveHydrationOperation(operation,hydrationOperationRef.current))setWorkspaceHydration('ready');}})}}
        onDeleteSnapshot={async snapshot=>accountAction(async()=>{if(preferences.confirmDelete&&!window.confirm(`Delete saved version ${snapshot.name}?`))return;await commitWithNonfatalRefresh(()=>accountApi.deleteSnapshot(snapshot.id),()=>setSnapshots(current=>removeSnapshot(current,snapshot.id)),refreshCloudProjects);setAccountNotice('Saved version deleted.');})}/>
    </div>
  );
}
