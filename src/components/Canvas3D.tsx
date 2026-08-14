import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { ViewCube } from './ViewCube';
import {
  SceneObject,
  EnvironmentSettings,
  TransformMode,
  ViewportRenderMode,
  ObjectGroup,
} from '../types';
import { disposeMaterials, disposeObject3DResources } from '../utils/threeResources';
import { canTransformSelection, configureTransformSnapping, createFrameCoalescer, getDragTransition, restoreRejectedTransform } from '../utils/transformControls';
import { viewportInputPolicy } from '../utils/modalKeyboard';
import { createExpandedAsset, isExpandedAssetType } from '../utils/expandedAssetGeometry';
import { createParametricExtrusionGeometry, parametricExtrusionKey } from '../utils/parametricExtrusion';
import { syncExtrusionGeometry } from '../utils/extrusionSceneSync';
import { booleanGeometryKey, createSubtractedGeometry } from '../utils/booleanGeometry';
import {canTransformGroup} from '../utils/objectGrouping';

interface Canvas3DProps {
  objects: SceneObject[];
  selectedObjectId: string | null;
  selectedObjectIds: string[];
  groups:ObjectGroup[];
  onSelectObject: (id: string | null, additive?: boolean) => void;
  onUpdateObjectTransform: (
    id: string,
    position: [number, number, number],
    rotation: [number, number, number],
    scale: [number, number, number]
  ) => boolean;
  onLiveUpdateObjectTransform?: (
    id: string,
    position: [number, number, number],
    rotation: [number, number, number],
    scale: [number, number, number]
  ) => void;
  onTransformingChange?:(dragging:boolean)=>void;
  onUpdateGroupTransform?:(groupId:string,position:[number,number,number],rotation:[number,number,number],scale:[number,number,number])=>void;
  environment: EnvironmentSettings;
  transformMode: TransformMode;
  renderMode: ViewportRenderMode;
  onRegisterRenderer: (renderer: THREE.WebGLRenderer, scene: THREE.Scene) => void;
  shortcutsDisabled?: boolean;
  onModelingNotice?: (message: string) => void;
}

export const Canvas3D: React.FC<Canvas3DProps> = ({
  objects,
  selectedObjectId,
  selectedObjectIds,
  groups,
  onSelectObject,
  onUpdateObjectTransform,
  onLiveUpdateObjectTransform,
  onTransformingChange,
  onUpdateGroupTransform,
  environment,
  transformMode,
  renderMode,
  onRegisterRenderer,
  shortcutsDisabled = false,
  onModelingNotice,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const orbitControlsRef = useRef<OrbitControls | null>(null);
  const transformControlsRef = useRef<TransformControls | null>(null);
  const meshMapRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const isTransformingRef = useRef<boolean>(false);
  const dirLightRef = useRef<THREE.DirectionalLight | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const selectionBoxesRef = useRef<Map<string, THREE.BoxHelper>>(new Map());
  const groupProxyRef=useRef<THREE.Object3D|null>(null);
  const shortcutsDisabledRef = useRef(shortcutsDisabled);
  const gridSnapRef = useRef(environment.gridSnap);

  // Keep fresh references to transform callbacks to avoid stale listeners
  const onUpdateTransformRef = useRef(onUpdateObjectTransform);
  const onLiveTransformRef = useRef(onLiveUpdateObjectTransform);
  const onModelingNoticeRef = useRef(onModelingNotice);
  const onTransformingChangeRef=useRef(onTransformingChange);
  const onUpdateGroupTransformRef=useRef(onUpdateGroupTransform);

  useEffect(() => {
    onUpdateTransformRef.current = onUpdateObjectTransform;
  }, [onUpdateObjectTransform]);

  useEffect(() => {
    onLiveTransformRef.current = onLiveUpdateObjectTransform;
  }, [onLiveUpdateObjectTransform]);

  useEffect(() => { onModelingNoticeRef.current=onModelingNotice; }, [onModelingNotice]);
  useEffect(()=>{onTransformingChangeRef.current=onTransformingChange;},[onTransformingChange]);
  useEffect(()=>{onUpdateGroupTransformRef.current=onUpdateGroupTransform;},[onUpdateGroupTransform]);

  useEffect(() => {
    shortcutsDisabledRef.current = shortcutsDisabled;
    const orbitControls = orbitControlsRef.current;
    const transformControls = transformControlsRef.current;
    const policy = viewportInputPolicy(shortcutsDisabled, isTransformingRef.current);
    if (orbitControls) {
      orbitControls.mouseButtons.RIGHT = policy.rightButton === 'pan' ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
      orbitControls.enabled = policy.orbitEnabled;
    }
    if (transformControls) transformControls.enabled = policy.transformEnabled;
    if(shortcutsDisabled&&transformControls)configureTransformSnapping(transformControls,gridSnapRef.current,false);
  }, [shortcutsDisabled]);

  // States to trigger ViewCube binding once initialized
  const [controlsReady, setControlsReady] = useState(false);

  const selectedObject = objects.find((o) => o.id === selectedObjectId);

  // Initialize Three.js Engine
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(environment.backgroundColor);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(8, 6, 10);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = environment.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    onRegisterRenderer(renderer, scene);

    // 4. Orbit Controls
    const orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.05;
    orbitControls.target.set(0, 1, 0);
    orbitControls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
    orbitControlsRef.current = orbitControls;
    setControlsReady(true);

    // 5. Transform Controls (Gizmo)
    const transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.size = 0.85;
    transformControls.space = 'world';
    scene.add(transformControls.getHelper());
    transformControlsRef.current = transformControls;
    const groupProxy=new THREE.Object3D();groupProxy.userData.isGroupProxy=true;scene.add(groupProxy);groupProxyRef.current=groupProxy;

    type TransformUpdate = {
      id: string;
      position: [number, number, number];
      rotation: [number, number, number];
      scale: [number, number, number];
    };
    let dragStart:TransformUpdate|null=null;
    let groupMemberStarts:Map<string,THREE.Matrix4>|null=null;
    const readTransform = (obj: THREE.Object3D): TransformUpdate | null => {
      const id = obj.userData.id;
      if (!id) return null;
      obj.updateMatrix();
      obj.updateMatrixWorld(true);
      return {
        id,
        position: [
          Number(obj.position.x.toFixed(3)),
          Number(obj.position.y.toFixed(3)),
          Number(obj.position.z.toFixed(3)),
        ],
        rotation: [
          Number(THREE.MathUtils.radToDeg(obj.rotation.x).toFixed(2)),
          Number(THREE.MathUtils.radToDeg(obj.rotation.y).toFixed(2)),
          Number(THREE.MathUtils.radToDeg(obj.rotation.z).toFixed(2)),
        ],
        scale: [
          Number(obj.scale.x.toFixed(3)),
          Number(obj.scale.y.toFixed(3)),
          Number(obj.scale.z.toFixed(3)),
        ],
      };
    };
    const liveUpdates = createFrameCoalescer<TransformUpdate>(
      requestAnimationFrame,
      cancelAnimationFrame,
      ({ id, position, rotation, scale }) => {
        onLiveTransformRef.current?.(id, position, rotation, scale);
      }
    );
    const handleObjectChange = () => {
      if (!isTransformingRef.current || !transformControls.object) return;
      if(transformControls.object.userData.isGroupProxy&&groupMemberStarts){
        transformControls.object.updateMatrix();
        groupMemberStarts.forEach((start,id)=>{const member=meshMapRef.current.get(id);if(!member)return;const matrix=transformControls.object!.matrix.clone().multiply(new THREE.Matrix4().makeTranslation(...(transformControls.object!.userData.startPivot as [number,number,number])).invert()).multiply(start);matrix.decompose(member.position,member.quaternion,member.scale);member.updateMatrix();member.updateMatrixWorld(true);});
        return;
      }
      const update = readTransform(transformControls.object);
      if (update) liveUpdates.schedule(update);
    };
    transformControls.addEventListener('objectChange', handleObjectChange);

    // Disable OrbitControls while using Gizmo & commit state on drag finish
    const handleDraggingChanged = (event: { value: unknown }) => {
      const transition = getDragTransition(isTransformingRef.current, event.value);
      orbitControls.enabled = !transition.isDragging;
      isTransformingRef.current = transition.isDragging;
      onTransformingChangeRef.current?.(transition.isDragging);
      if(transition.started&&transformControls.object){dragStart=readTransform(transformControls.object);if(transformControls.object.userData.isGroupProxy){groupMemberStarts=new Map();(transformControls.object.userData.memberIds as string[]).forEach(id=>{const member=meshMapRef.current.get(id);if(member){member.updateMatrix();groupMemberStarts!.set(id,member.matrix.clone());}});}}

      if (transition.ended) {
        liveUpdates.cancel();
        if(transformControls.object?.userData.isGroupProxy){const proxy=transformControls.object;onUpdateGroupTransformRef.current?.(proxy.userData.groupId,proxy.position.toArray() as [number,number,number],[proxy.rotation.x,proxy.rotation.y,proxy.rotation.z].map(THREE.MathUtils.radToDeg) as [number,number,number],proxy.scale.toArray() as [number,number,number]);groupMemberStarts=null;dragStart=null;return;}
        const update = transformControls.object ? readTransform(transformControls.object) : null;
        if (update) {
          const accepted=onUpdateTransformRef.current(update.id, update.position, update.rotation, update.scale);
          if(!accepted&&dragStart&&transformControls.object)restoreRejectedTransform(transformControls.object,dragStart);
        }
        dragStart=null;
      }
    };
    transformControls.addEventListener('dragging-changed', handleDraggingChanged);

    // Handle Ctrl + Right-Click Orbiting Navigation
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handlePointerDownGlobal = (e: PointerEvent) => {
      if (shortcutsDisabledRef.current) return;
      if (orbitControlsRef.current && e.button === 2) {
        if (e.ctrlKey || e.metaKey) {
          orbitControlsRef.current.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
        } else {
          orbitControlsRef.current.mouseButtons.RIGHT = THREE.MOUSE.PAN;
        }
      }
    };

    const handlePointerMoveGlobal = (e: PointerEvent) => {
      if (shortcutsDisabledRef.current) return;
      if (orbitControlsRef.current && (e.buttons === 2 || e.buttons === 3)) {
        if (e.ctrlKey || e.metaKey) {
          orbitControlsRef.current.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
        }
      }
    };

    const handleKeyDownGlobal = (e: KeyboardEvent) => {
      if (shortcutsDisabledRef.current) return;
      if ((e.key === 'Control' || e.key === 'Meta') && orbitControlsRef.current) {
        orbitControlsRef.current.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
        if (transformControlsRef.current) configureTransformSnapping(transformControlsRef.current, gridSnapRef.current, true);
      }
    };

    const handleKeyUpGlobal = (e: KeyboardEvent) => {
      if (shortcutsDisabledRef.current) return;
      if ((e.key === 'Control' || e.key === 'Meta') && orbitControlsRef.current) {
        orbitControlsRef.current.mouseButtons.RIGHT = THREE.MOUSE.PAN;
        if (transformControlsRef.current) configureTransformSnapping(transformControlsRef.current, gridSnapRef.current, false);
      }
    };
    const resetPrecision=()=>{if(transformControlsRef.current)configureTransformSnapping(transformControlsRef.current,gridSnapRef.current,false);};
    const handleVisibility=()=>{if(document.hidden)resetPrecision();};

    const domEl = renderer.domElement;
    domEl.addEventListener('contextmenu', handleContextMenu);
    domEl.addEventListener('pointerdown', handlePointerDownGlobal, true); // Capture phase before OrbitControls!
    domEl.addEventListener('pointermove', handlePointerMoveGlobal, true);
    window.addEventListener('keydown', handleKeyDownGlobal, true);
    window.addEventListener('keyup', handleKeyUpGlobal, true);
    window.addEventListener('blur',resetPrecision);
    window.addEventListener('pointerup',resetPrecision,true);
    document.addEventListener('visibilitychange',handleVisibility);

    // 6. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    const dirLight = new THREE.DirectionalLight(0xfffaed, environment.intensity);
    dirLight.position.set(10, 15, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.bias = -0.0001;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 50;
    dirLight.shadow.camera.left = -15;
    dirLight.shadow.camera.right = 15;
    dirLight.shadow.camera.top = 15;
    dirLight.shadow.camera.bottom = -15;
    scene.add(dirLight);
    dirLightRef.current = dirLight;

    // Secondary fill light for architectural contrast
    const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.4);
    fillLight.position.set(-10, 8, -10);
    scene.add(fillLight);

    // 7. Grid Helper
    const gridHelper = new THREE.GridHelper(30, 30, 0x3b82f6, 0x334155);
    gridHelper.position.y = -0.001;
    scene.add(gridHelper);
    gridHelperRef.current = gridHelper;

    // 8. Animation & Render Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      orbitControls.update();
      selectionBoxesRef.current.forEach(box => box.update());
      renderer.render(scene, camera);
    };
    animate();

    // 9. Resize Observer
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(container);

    // Clean up
    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      domEl.removeEventListener('contextmenu', handleContextMenu);
      domEl.removeEventListener('pointerdown', handlePointerDownGlobal, true);
      domEl.removeEventListener('pointermove', handlePointerMoveGlobal, true);
      window.removeEventListener('keydown', handleKeyDownGlobal, true);
      window.removeEventListener('keyup', handleKeyUpGlobal, true);
      window.removeEventListener('blur',resetPrecision);
      window.removeEventListener('pointerup',resetPrecision,true);
      document.removeEventListener('visibilitychange',handleVisibility);
      transformControls.removeEventListener('dragging-changed', handleDraggingChanged);
      transformControls.removeEventListener('objectChange', handleObjectChange);
      liveUpdates.cancel();
      transformControls.detach();
      transformControls.dispose();
      scene.remove(groupProxy);groupProxyRef.current=null;
      orbitControls.dispose();
      meshMapRef.current.forEach((object) => {
        scene.remove(object);
        disposeObject3DResources(object);
      });
      meshMapRef.current.clear();
      selectionBoxesRef.current.forEach(box => {
        scene.remove(box);
        box.geometry.dispose();
        disposeMaterials([box.material]);
      });
      selectionBoxesRef.current.clear();
      scene.remove(gridHelper);
      gridHelper.geometry.dispose();
      disposeMaterials(Array.isArray(gridHelper.material) ? gridHelper.material : [gridHelper.material]);
      dirLight.shadow.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Update Gizmo Transform Mode (Translate / Rotate / Scale)
  useEffect(() => {
    gridSnapRef.current = environment.gridSnap;
    if (transformControlsRef.current) {
      transformControlsRef.current.setMode(transformMode);
    }
  }, [transformMode]);

  // Update Environment & Lighting Settings
  useEffect(() => {
    if (!sceneRef.current || !dirLightRef.current || !rendererRef.current) return;

    sceneRef.current.background = new THREE.Color(environment.backgroundColor);

    if (gridHelperRef.current) {
      gridHelperRef.current.visible = environment.gridVisible;
    }

    if (transformControlsRef.current) {
      configureTransformSnapping(transformControlsRef.current, environment.gridSnap, false);
    }

    rendererRef.current.shadowMap.enabled = environment.shadows;

    // Calculate sun position from elevation and azimuth
    const radElev = THREE.MathUtils.degToRad(environment.sunElevation);
    const radAzim = THREE.MathUtils.degToRad(environment.sunAzimuth);
    const distance = 20;

    dirLightRef.current.position.x = distance * Math.cos(radElev) * Math.sin(radAzim);
    dirLightRef.current.position.y = distance * Math.sin(radElev);
    dirLightRef.current.position.z = distance * Math.cos(radElev) * Math.cos(radAzim);
    dirLightRef.current.intensity = environment.intensity;

    if (ambientLightRef.current) {
      if (environment.theme === 'midnight') {
        ambientLightRef.current.color.setHex(0x1e1b4b);
        ambientLightRef.current.intensity = 0.3;
      } else if (environment.theme === 'sunset') {
        ambientLightRef.current.color.setHex(0x7c2d12);
        ambientLightRef.current.intensity = 0.7;
      } else if (environment.theme === 'warm') {
        ambientLightRef.current.color.setHex(0xfef3c7);
        ambientLightRef.current.intensity = 0.8;
      } else {
        ambientLightRef.current.color.setHex(0xffffff);
        ambientLightRef.current.intensity = 0.6;
      }
    }
  }, [environment]);

  // Synchronize Scene Objects
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;

    const existingMap = meshMapRef.current;
    const currentIds = new Set(objects.map((o) => o.id));

    // Remove deleted objects
    existingMap.forEach((mesh, id) => {
      if (!currentIds.has(id)) {
        if (transformControlsRef.current?.object === mesh) {
          transformControlsRef.current.detach();
        }
        scene.remove(mesh);
        disposeObject3DResources(mesh);
        existingMap.delete(id);
      }
    });

    // Add or update objects
    objects.forEach((objData) => {
      let object3D = existingMap.get(objData.id);

      const cutter = objData.boolean ? objects.find(candidate => candidate.id === objData.boolean!.cutterId) : undefined;
      const nextGeometryKey = objData.boolean&&cutter
        ? booleanGeometryKey(objData,cutter)
        : JSON.stringify({ geometry: objData.geometry ? parametricExtrusionKey(objData.geometry) : '', boolean: objData.boolean });
      // Keep the last evaluated solid during a gizmo preview. The committed
      // state update below triggers exactly one Boolean recomputation.
      const geometryKey = isTransformingRef.current&&objData.boolean&&object3D ? object3D.userData.geometryKey : nextGeometryKey;
      if (object3D && object3D.userData.type === 'parametric-extrusion' && objData.geometry && object3D.userData.geometryKey !== geometryKey) {
        syncExtrusionGeometry(object3D, objData.geometry);
      }
      // Recreate if not present, primitive type changed, or procedural parameters changed.
      if (!object3D || object3D.userData.type !== objData.type || object3D.userData.geometryKey !== geometryKey) {
        try {
          const replacement=createProcedural3DObject(objData,renderMode,cutter);
          replacement.userData={id:objData.id,type:objData.type,geometryKey};
          replacement.name=`user_object_${objData.id}`;
          if(object3D){if(transformControlsRef.current?.object===object3D)transformControlsRef.current.detach();scene.remove(object3D);disposeObject3DResources(object3D);}
          object3D=replacement;scene.add(object3D);existingMap.set(objData.id,object3D);
        } catch(error) {
          onModelingNoticeRef.current?.(`Boolean preview retained its last valid shape: ${error instanceof Error?error.message:'evaluation failed.'}`);
          if(!object3D){object3D=createProcedural3DObject({...objData,boolean:undefined},renderMode);object3D.userData={id:objData.id,type:objData.type,geometryKey:'fallback'};object3D.name=`user_object_${objData.id}`;scene.add(object3D);existingMap.set(objData.id,object3D);}
        }
      }

      // Update transform if not actively dragging gizmo
      if (!isTransformingRef.current) {
        object3D.position.set(...objData.position);
        object3D.rotation.set(
          THREE.MathUtils.degToRad(objData.rotation[0]),
          THREE.MathUtils.degToRad(objData.rotation[1]),
          THREE.MathUtils.degToRad(objData.rotation[2])
        );
        object3D.scale.set(...objData.scale);
        object3D.updateMatrix();
        object3D.updateMatrixWorld(true);
      }

      // Update visibility and material properties
      object3D.visible = objData.visible;
      updateObjectMaterials(object3D, objData, renderMode);
    });

    // Attach the gizmo only to the primary object. Every selected object gets a
    // non-invasive helper, so multi-selection never mutates object transforms.
    selectionBoxesRef.current.forEach((box, id) => {
      const data = objects.find(candidate => candidate.id === id);
      if (!selectedObjectIds.includes(id) || !existingMap.has(id) || !data?.visible) {
        scene.remove(box);
        box.geometry.dispose();
        disposeMaterials([box.material]);
        selectionBoxesRef.current.delete(id);
      }
    });
    selectedObjectIds.forEach(id => {
      const object = existingMap.get(id);
      const data = objects.find(candidate => candidate.id === id);
      if (!object || !data?.visible) return;
      let box = selectionBoxesRef.current.get(id);
      if (!box) {
        box = new THREE.BoxHelper(object, id === selectedObjectId ? 0x06b6d4 : 0xa855f7);
        scene.add(box);
        selectionBoxesRef.current.set(id, box);
      } else {
        box.setFromObject(object);
        (box.material as THREE.LineBasicMaterial).color.setHex(id === selectedObjectId ? 0x06b6d4 : 0xa855f7);
      }
      box.update();
    });

    // Attach/Detach Gizmo for the explicit primary selection.
    const selectedGroup=groups.find(group=>group.memberIds.length===selectedObjectIds.length&&group.memberIds.every(id=>selectedObjectIds.includes(id)));
    const exactGroup=selectedGroup&&canTransformGroup(objects,selectedGroup)===null?selectedGroup:null;
    if(selectedGroup&&!exactGroup){transformControlsRef.current?.detach();}
    else if(exactGroup&&groupProxyRef.current){const proxy=groupProxyRef.current;proxy.position.set(...exactGroup.pivot);proxy.rotation.set(0,0,0);proxy.scale.set(1,1,1);proxy.userData={isGroupProxy:true,groupId:exactGroup.id,memberIds:[...exactGroup.memberIds],startPivot:[...exactGroup.pivot]};proxy.updateMatrix();transformControlsRef.current?.detach();transformControlsRef.current?.attach(proxy);
    } else if (selectedObjectId) {
      const selectedMesh = existingMap.get(selectedObjectId);
      const selData = objects.find((o) => o.id === selectedObjectId);
      if (selectedMesh && canTransformSelection(selData)) {
        selectedMesh.updateMatrix();
        selectedMesh.updateMatrixWorld(true);
        if (transformControlsRef.current?.object !== selectedMesh) {
          transformControlsRef.current?.detach();
          transformControlsRef.current?.attach(selectedMesh);
        }

      } else {
        transformControlsRef.current?.detach();
      }
    } else {
      transformControlsRef.current?.detach();
    }
  }, [objects, groups, selectedObjectId, selectedObjectIds, renderMode]);

  // Click & Raycasting Selection
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current || !cameraRef.current || !sceneRef.current) return;

    // ONLY left-click selects/deselects objects (button 0)
    // Right-click (2) and middle-click (1) are reserved for viewport orbiting & panning
    if (event.button !== 0) return;

    // Ignore clicks if actively interacting with or clicking transform gizmo handles
    if (
      transformControlsRef.current?.dragging ||
      isTransformingRef.current ||
      transformControlsRef.current?.axis !== null
    ) {
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);

    const selectableObjects: THREE.Object3D[] = [];
    meshMapRef.current.forEach((mesh) => {
      if (mesh.visible) {
        selectableObjects.push(mesh);
      }
    });

    const intersects = raycaster.intersectObjects(selectableObjects, true);

    if (intersects.length > 0) {
      let topObj = intersects[0].object;
      while (topObj.parent && topObj.parent !== sceneRef.current && !topObj.userData.id) {
        topObj = topObj.parent;
      }
      if (topObj.userData.id) {
        onSelectObject(topObj.userData.id, event.shiftKey);
        return;
      }
    }
    // Deselect if background clicked with left click
    onSelectObject(null, event.shiftKey);
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      className="relative w-full h-full overflow-hidden select-none bg-slate-950 cursor-crosshair"
    >
      {/* Sleek Viewport Orientation Helper / Status Badge */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-3 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800/80 text-xs font-mono text-slate-400 shadow-lg pointer-events-none">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-slate-200 font-semibold tracking-wide">WebGL 2.0 Engine</span>
        </div>
        <span className="text-slate-600">|</span>
        <span className="text-sky-400 capitalize">{renderMode} Mode</span>
        <span className="text-slate-600">|</span>
        <span>{objects.length} Objects</span>
      </div>

      {/* 3D ViewCube Orientation Controller in Upper Right Corner */}
      {controlsReady && (
        <ViewCube
          mainCamera={cameraRef.current}
          orbitControls={orbitControlsRef.current}
          selectedObjectPosition={selectedObject ? selectedObject.position : null}
        />
      )}
    </div>
  );
};

/**
 * Creates procedural 3D Three.js Object groups/meshes for rich architectural assets
 */
function createProcedural3DObject(data: SceneObject, renderMode: ViewportRenderMode, cutter?: SceneObject): THREE.Object3D {
  const group = new THREE.Group();
  group.position.set(...data.position);
  group.rotation.set(
    THREE.MathUtils.degToRad(data.rotation[0]),
    THREE.MathUtils.degToRad(data.rotation[1]),
    THREE.MathUtils.degToRad(data.rotation[2])
  );
  group.scale.set(...data.scale);

  const mat = getMaterialForData(data, renderMode);

  if (data.boolean?.kind === 'subtract') {
    if (!cutter) throw new Error('Boolean cutter is missing.');
    const mesh = new THREE.Mesh(createSubtractedGeometry(data, cutter), mat);
    mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); return group;
  }

  switch (data.type) {
    case 'parametric-extrusion': {
      if (!data.geometry) throw new Error('Parametric extrusion data is missing.');
      const mesh = new THREE.Mesh(createParametricExtrusionGeometry(data.geometry), mat);
      mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); break;
    }
    case 'cube': {
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      break;
    }

    case 'sphere': {
      const geo = new THREE.SphereGeometry(0.5, 32, 32);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      break;
    }

    case 'cylinder': {
      const geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      break;
    }

    case 'cone': {
      const geo = new THREE.ConeGeometry(0.5, 1, 32);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      break;
    }

    case 'torus': {
      const geo = new THREE.TorusGeometry(0.5, 0.18, 24, 48);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      break;
    }

    case 'plane': {
      const geo = new THREE.BoxGeometry(1, 0.05, 1);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.receiveShadow = true;
      group.add(mesh);
      break;
    }

    case 'capsule': {
      const geo = new THREE.CapsuleGeometry(0.35, 0.6, 16, 32);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      break;
    }

    case 'wall': {
      // Architectural Wall with subtle top bevel detail
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      break;
    }

    case 'pillar': {
      // Column with cap and base
      const mainCol = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.9, 32), mat);
      const capTop = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.9), mat);
      capTop.position.y = 0.475;
      const capBot = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.9), mat);
      capBot.position.y = -0.475;

      mainCol.castShadow = true;
      mainCol.receiveShadow = true;
      capTop.castShadow = true;
      capBot.castShadow = true;

      group.add(mainCol, capTop, capBot);
      break;
    }

    case 'arch': {
      // Curved Archway Assembly
      const leftPost = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.8), mat);
      leftPost.position.set(-0.4, 0, 0);

      const rightPost = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.8), mat);
      rightPost.position.set(0.4, 0, 0);

      const topTorus = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.12, 16, 32, Math.PI), mat);
      topTorus.position.set(0, 0.4, 0);

      leftPost.castShadow = true;
      rightPost.castShadow = true;
      topTorus.castShadow = true;

      group.add(leftPost, rightPost, topTorus);
      break;
    }

    case 'stair': {
      // Floating Steps
      const stepCount = 6;
      for (let i = 0; i < stepCount; i++) {
        const step = new THREE.Mesh(new THREE.BoxGeometry(1, 0.08, 0.3), mat);
        step.position.set(0, (i - stepCount / 2) * 0.15, (i - stepCount / 2) * 0.25);
        step.castShadow = true;
        step.receiveShadow = true;
        group.add(step);
      }
      break;
    }

    case 'window': {
      // Frame + Glass Center
      const frameMat = new THREE.MeshStandardMaterial({ color: '#18181b', metalness: 0.8, roughness: 0.2 });
      const frameBox = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.05), frameMat);
      frameBox.userData.customMat = true;
      const glassPane = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.92, 0.02), mat);
      frameBox.castShadow = true;
      glassPane.castShadow = true;
      group.add(frameBox, glassPane);
      break;
    }

    case 'door': {
      // Modern Door
      const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1, 0.06), mat);
      const handleMat = new THREE.MeshStandardMaterial({ color: '#e5b94c', metalness: 0.9, roughness: 0.1 });
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.2), handleMat);
      handle.userData.customMat = true;
      handle.rotation.z = Math.PI / 2;
      handle.position.set(0.35, 0, 0.05);

      doorPanel.castShadow = true;
      doorPanel.receiveShadow = true;
      group.add(doorPanel, handle);
      break;
    }

    case 'sofa': {
      // Modular Sofa
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1, 0.3, 0.5), mat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(1, 0.45, 0.15), mat);
      back.position.set(0, 0.35, -0.2);
      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.38, 0.5), mat);
      armL.position.set(-0.55, 0.1, 0);
      const armR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.38, 0.5), mat);
      armR.position.set(0.55, 0.1, 0);

      seat.castShadow = true;
      back.castShadow = true;
      armL.castShadow = true;
      armR.castShadow = true;
      group.add(seat, back, armL, armR);
      break;
    }

    case 'chair': {
      // Designer Accent Chair
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.6), mat);
      seat.position.y = 0.4;
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.08), mat);
      back.position.set(0, 0.65, -0.26);

      const legMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.3 });
      const legPositions = [
        [-0.25, 0.2, -0.25],
        [0.25, 0.2, -0.25],
        [-0.25, 0.2, 0.25],
        [0.25, 0.2, 0.25],
      ];
      legPositions.forEach(([x, y, z]) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.4), legMat);
        leg.userData.customMat = true;
        leg.position.set(x, y, z);
        leg.castShadow = true;
        group.add(leg);
      });

      seat.castShadow = true;
      back.castShadow = true;
      group.add(seat, back);
      break;
    }

    case 'table': {
      // Circular or Rectangular Table
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 32), mat);
      top.position.y = 0.45;

      const legMat = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.8, roughness: 0.3 });
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 16), legMat);
      leg.userData.customMat = true;

      top.castShadow = true;
      top.receiveShadow = true;
      leg.castShadow = true;
      group.add(top, leg);
      break;
    }

    case 'lamp': {
      // Floor Lamp
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04), mat);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1), mat);
      stem.position.y = 0.5;
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.25, 24, 1, true), mat);
      shade.position.y = 0.95;

      base.castShadow = true;
      stem.castShadow = true;
      shade.castShadow = true;
      group.add(base, stem, shade);
      break;
    }

    case 'plant': {
      // Pot + Plant Foliage
      const potMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.3 });
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 0.4, 24), potMat);
      pot.userData.customMat = true;
      pot.position.y = 0.2;

      const leafMat = new THREE.MeshStandardMaterial({ color: '#15803d', roughness: 0.5 });
      for (let i = 0; i < 5; i++) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), leafMat);
        leaf.userData.customMat = true;
        leaf.scale.set(1.5, 0.2, 0.8);
        const angle = (i / 5) * Math.PI * 2;
        leaf.position.set(Math.cos(angle) * 0.15, 0.45 + i * 0.05, Math.sin(angle) * 0.15);
        leaf.rotation.y = angle;
        leaf.rotation.z = 0.3;
        leaf.castShadow = true;
        group.add(leaf);
      }

      pot.castShadow = true;
      group.add(pot);
      break;
    }

    case 'tree': {
      // Stylized Architectural Tree
      const trunkMat = new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.8 });
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 1.2, 12), trunkMat);
      trunk.userData.customMat = true;
      trunk.position.y = 0.6;

      const foliageMat = new THREE.MeshStandardMaterial({ color: '#15803d', roughness: 0.6 });
      const foliage1 = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.0, 16), foliageMat);
      foliage1.userData.customMat = true;
      foliage1.position.y = 1.4;

      const foliage2 = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.8, 16), foliageMat);
      foliage2.userData.customMat = true;
      foliage2.position.y = 1.8;

      trunk.castShadow = true;
      foliage1.castShadow = true;
      foliage2.castShadow = true;
      group.add(trunk, foliage1, foliage2);
      break;
    }

    case 'rock': {
      // Organic Rock Boulder
      const geo = new THREE.DodecahedronGeometry(0.5, 2);
      // Displace vertices slightly for natural rock texture
      const posAttr = geo.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        const vx = posAttr.getX(i);
        const vy = posAttr.getY(i);
        const vz = posAttr.getZ(i);
        const noise = (Math.sin(vx * 5) + Math.cos(vy * 5) + Math.sin(vz * 5)) * 0.08;
        posAttr.setXYZ(i, vx + noise, vy + noise, vz + noise);
      }
      geo.computeVertexNormals();

      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      break;
    }

    case 'spotlight':
    case 'pointlight': {
      // Light Fixture & Helper
      const fixtureMat = new THREE.MeshStandardMaterial({
        color: data.color || '#f59e0b',
        emissive: data.color || '#f59e0b',
        emissiveIntensity: 0.8,
      });
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), fixtureMat);
      bulb.userData.customMat = true;
      group.add(bulb);
      break;
    }

    default: {
      if (!isExpandedAssetType(data.type)) {
        throw new Error(`Unsupported asset type: ${data.type}`);
      }
      const expanded = createExpandedAsset(data.type, mat);
      group.add(...expanded.children);
      break;
    }
  }

  return group;
}

/**
 * Generates Three.js Material based on object parameters and render mode
 */
function getMaterialForData(data: SceneObject, renderMode: ViewportRenderMode): THREE.Material {
  if (renderMode === 'wireframe') {
    return new THREE.MeshBasicMaterial({
      color: data.color || '#38bdf8',
      wireframe: true,
    });
  }

  if (renderMode === 'normals') {
    return new THREE.MeshNormalMaterial();
  }

  const isGlass = (data.transmission && data.transmission > 0.05) || data.materialPreset === 'crystal_clear' || data.type === 'window';
  const isEmissive = !!data.emission;

  if (isGlass) {
    const opacityVal = Math.max(0.25, 1 - (data.transmission || 0.8) * 0.7);
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(data.color || '#ffffff'),
      metalness: data.metalness ?? 0.05,
      roughness: data.roughness ?? 0.05,
      transparent: true,
      opacity: opacityVal,
      depthWrite: true,
      clearcoat: data.clearcoat ?? 1.0,
      clearcoatRoughness: 0.1,
      side: THREE.DoubleSide,
    });
  }

  if (isEmissive) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(data.color || '#06b6d4'),
      emissive: new THREE.Color(data.emission || data.color),
      emissiveIntensity: 1.2,
      roughness: data.roughness ?? 0.2,
      metalness: data.metalness ?? 0,
      side: THREE.DoubleSide,
    });
  }

  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(data.color || '#64748b'),
    metalness: data.metalness ?? 0.1,
    roughness: data.roughness ?? 0.4,
    clearcoat: data.clearcoat ?? 0.0,
    side: THREE.DoubleSide,
  });
}

/**
 * Updates material on existing group children
 */
function updateObjectMaterials(group: THREE.Object3D, data: SceneObject, renderMode: ViewportRenderMode) {
  const materialKey = JSON.stringify([
    renderMode,
    data.color,
    data.metalness,
    data.roughness,
    data.transmission,
    data.clearcoat,
    data.emission,
    data.materialPreset,
    data.type,
  ]);
  if (group.userData.materialKey === materialKey) return;

  const newMat = getMaterialForData(data, renderMode);
  const replacedMaterials = new Set<THREE.Material>();
  group.traverse((child) => {
    if (child instanceof THREE.Mesh && !child.userData.customMat) {
      const oldMaterials = Array.isArray(child.material) ? child.material : [child.material];
      oldMaterials.forEach((material) => replacedMaterials.add(material));
      child.material = newMat;
    }
  });
  replacedMaterials.delete(newMat);
  disposeMaterials(replacedMaterials);
  group.userData.materialKey = materialKey;
}
