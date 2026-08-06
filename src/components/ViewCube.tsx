import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Target, Home, RotateCw, RotateCcw } from 'lucide-react';

interface ViewCubeProps {
  mainCamera: THREE.PerspectiveCamera | null;
  orbitControls: OrbitControls | null;
  selectedObjectPosition?: [number, number, number] | null;
}

interface CubePart {
  id: string;
  name: string;
  type: 'face' | 'edge' | 'corner';
  normal: THREE.Vector3;
  mesh: THREE.Mesh;
}

export const ViewCube: React.FC<ViewCubeProps> = ({
  mainCamera,
  orbitControls,
  selectedObjectPosition,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cubeSceneRef = useRef<THREE.Scene | null>(null);
  const cubeCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const cubeGroupRef = useRef<THREE.Group | null>(null);

  const partsRef = useRef<CubePart[]>([]);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());

  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });
  const [hoveredPartName, setHoveredPartName] = useState<string | null>(null);

  // Helper to create texture for cube face
  const createFaceTexture = (text: string, isHovered: boolean) => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    // Dark sleek backdrop
    ctx.fillStyle = isHovered ? '#0284c7' : '#0f172a';
    ctx.fillRect(0, 0, 256, 256);

    // Bevel outer border
    ctx.strokeStyle = isHovered ? '#38bdf8' : '#334155';
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, 242, 242);

    // Subtle inner grid highlight
    ctx.strokeStyle = isHovered ? 'rgba(255,255,255,0.4)' : 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, 216, 216);

    // Text Label
    ctx.fillStyle = isHovered ? '#ffffff' : '#cbd5e1';
    ctx.font = 'bold 44px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 128);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const size = 124;
    const container = containerRef.current;
    container.innerHTML = '';

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    cubeSceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 3.4);
    cubeCameraRef.current = camera;

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight1.position.set(3, 4, 5);
    const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 0.4);
    dirLight2.position.set(-3, -2, -4);
    scene.add(ambientLight, dirLight1, dirLight2);

    // 4. Outer Compass Ring
    const ringGeo = new THREE.RingGeometry(1.42, 1.48, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x334155,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    scene.add(ringMesh);

    // 5. Construct Modular Chamfered ViewCube Parts
    const cubeGroup = new THREE.Group();
    scene.add(cubeGroup);
    cubeGroupRef.current = cubeGroup;

    const parts: CubePart[] = [];

    // Face definitions
    const facesDef = [
      { id: 'RIGHT', name: 'RIGHT VIEW', normal: new THREE.Vector3(1, 0, 0), pos: [0.5, 0, 0], rot: [0, Math.PI / 2, 0] },
      { id: 'LEFT', name: 'LEFT VIEW', normal: new THREE.Vector3(-1, 0, 0), pos: [-0.5, 0, 0], rot: [0, -Math.PI / 2, 0] },
      { id: 'TOP', name: 'TOP VIEW', normal: new THREE.Vector3(0, 1, 0), pos: [0, 0.5, 0], rot: [-Math.PI / 2, 0, 0] },
      { id: 'BOTTOM', name: 'BOTTOM VIEW', normal: new THREE.Vector3(0, -1, 0), pos: [0, -0.5, 0], rot: [Math.PI / 2, 0, 0] },
      { id: 'FRONT', name: 'FRONT VIEW', normal: new THREE.Vector3(0, 0, 1), pos: [0, 0, 0.5], rot: [0, 0, 0] },
      { id: 'BACK', name: 'BACK VIEW', normal: new THREE.Vector3(0, 0, -1), pos: [0, 0, -0.5], rot: [0, Math.PI, 0] },
    ];

    // Create 6 Main Face Meshes
    facesDef.forEach((f) => {
      const geo = new THREE.PlaneGeometry(0.74, 0.74);
      const mat = new THREE.MeshStandardMaterial({
        map: createFaceTexture(f.id, false),
        roughness: 0.2,
        metalness: 0.1,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(f.pos[0], f.pos[1], f.pos[2]);
      mesh.rotation.set(f.rot[0], f.rot[1], f.rot[2]);
      mesh.userData = { id: f.id, name: f.name, type: 'face' };
      cubeGroup.add(mesh);
      parts.push({ id: f.id, name: f.name, type: 'face', normal: f.normal, mesh });
    });

    // Create 12 Flat Chamfered Edge Strips
    const edgesDef = [
      { id: 'TOP-FRONT', name: 'TOP-FRONT EDGE', normal: new THREE.Vector3(0, 1, 1).normalize(), pos: [0, 0.44, 0.44], rot: [Math.PI / 4, 0, 0], size: [0.72, 0.16, 0.04] },
      { id: 'TOP-BACK', name: 'TOP-BACK EDGE', normal: new THREE.Vector3(0, 1, -1).normalize(), pos: [0, 0.44, -0.44], rot: [-Math.PI / 4, 0, 0], size: [0.72, 0.16, 0.04] },
      { id: 'TOP-RIGHT', name: 'TOP-RIGHT EDGE', normal: new THREE.Vector3(1, 1, 0).normalize(), pos: [0.44, 0.44, 0], rot: [0, 0, -Math.PI / 4], size: [0.16, 0.72, 0.04] },
      { id: 'TOP-LEFT', name: 'TOP-LEFT EDGE', normal: new THREE.Vector3(-1, 1, 0).normalize(), pos: [-0.44, 0.44, 0], rot: [0, 0, Math.PI / 4], size: [0.16, 0.72, 0.04] },

      { id: 'BOTTOM-FRONT', name: 'BOTTOM-FRONT EDGE', normal: new THREE.Vector3(0, -1, 1).normalize(), pos: [0, -0.44, 0.44], rot: [-Math.PI / 4, 0, 0], size: [0.72, 0.16, 0.04] },
      { id: 'BOTTOM-BACK', name: 'BOTTOM-BACK EDGE', normal: new THREE.Vector3(0, -1, -1).normalize(), pos: [0, -0.44, -0.44], rot: [Math.PI / 4, 0, 0], size: [0.72, 0.16, 0.04] },
      { id: 'BOTTOM-RIGHT', name: 'BOTTOM-RIGHT EDGE', normal: new THREE.Vector3(1, -1, 0).normalize(), pos: [0.44, -0.44, 0], rot: [0, 0, Math.PI / 4], size: [0.16, 0.72, 0.04] },
      { id: 'BOTTOM-LEFT', name: 'BOTTOM-LEFT EDGE', normal: new THREE.Vector3(-1, -1, 0).normalize(), pos: [-0.44, -0.44, 0], rot: [0, 0, -Math.PI / 4], size: [0.16, 0.72, 0.04] },

      { id: 'FRONT-RIGHT', name: 'FRONT-RIGHT EDGE', normal: new THREE.Vector3(1, 0, 1).normalize(), pos: [0.44, 0, 0.44], rot: [0, Math.PI / 4, 0], size: [0.16, 0.72, 0.04] },
      { id: 'FRONT-LEFT', name: 'FRONT-LEFT EDGE', normal: new THREE.Vector3(-1, 0, 1).normalize(), pos: [-0.44, 0, 0.44], rot: [0, -Math.PI / 4, 0], size: [0.16, 0.72, 0.04] },
      { id: 'BACK-RIGHT', name: 'BACK-RIGHT EDGE', normal: new THREE.Vector3(1, 0, -1).normalize(), pos: [0.44, 0, -0.44], rot: [0, -Math.PI / 4, 0], size: [0.16, 0.72, 0.04] },
      { id: 'BACK-LEFT', name: 'BACK-LEFT EDGE', normal: new THREE.Vector3(-1, 0, -1).normalize(), pos: [-0.44, 0, -0.44], rot: [0, Math.PI / 4, 0], size: [0.16, 0.72, 0.04] },
    ];

    edgesDef.forEach((e) => {
      const geo = new THREE.BoxGeometry(e.size[0], e.size[1], e.size[2]);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.3,
        metalness: 0.4,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(e.pos[0], e.pos[1], e.pos[2]);
      mesh.rotation.set(e.rot[0], e.rot[1], e.rot[2]);
      mesh.userData = { id: e.id, name: e.name, type: 'edge' };
      cubeGroup.add(mesh);
      parts.push({ id: e.id, name: e.name, type: 'edge', normal: e.normal, mesh });
    });

    // Create 8 Chamfered Corner Blocks
    const cornersDef = [
      { id: 'TOP-FRONT-RIGHT', name: 'ISOMETRIC T-F-R', normal: new THREE.Vector3(1, 1, 1).normalize(), pos: [0.44, 0.44, 0.44] },
      { id: 'TOP-FRONT-LEFT', name: 'ISOMETRIC T-F-L', normal: new THREE.Vector3(-1, 1, 1).normalize(), pos: [-0.44, 0.44, 0.44] },
      { id: 'TOP-BACK-RIGHT', name: 'ISOMETRIC T-B-R', normal: new THREE.Vector3(1, 1, -1).normalize(), pos: [0.44, 0.44, -0.44] },
      { id: 'TOP-BACK-LEFT', name: 'ISOMETRIC T-B-L', normal: new THREE.Vector3(-1, 1, -1).normalize(), pos: [-0.44, 0.44, -0.44] },

      { id: 'BOTTOM-FRONT-RIGHT', name: 'ISOMETRIC B-F-R', normal: new THREE.Vector3(1, -1, 1).normalize(), pos: [0.44, -0.44, 0.44] },
      { id: 'BOTTOM-FRONT-LEFT', name: 'ISOMETRIC B-F-L', normal: new THREE.Vector3(-1, -1, 1).normalize(), pos: [-0.44, -0.44, 0.44] },
      { id: 'BOTTOM-BACK-RIGHT', name: 'ISOMETRIC B-B-R', normal: new THREE.Vector3(1, -1, -1).normalize(), pos: [0.44, -0.44, -0.44] },
      { id: 'BOTTOM-BACK-LEFT', name: 'ISOMETRIC B-B-L', normal: new THREE.Vector3(-1, -1, -1).normalize(), pos: [-0.44, -0.44, -0.44] },
    ];

    cornersDef.forEach((c) => {
      const geo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x475569,
        roughness: 0.2,
        metalness: 0.5,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(c.pos[0], c.pos[1], c.pos[2]);
      mesh.userData = { id: c.id, name: c.name, type: 'corner' };
      cubeGroup.add(mesh);
      parts.push({ id: c.id, name: c.name, type: 'corner', normal: c.normal, mesh });
    });

    partsRef.current = parts;

    // Inner Core Box
    const coreGeo = new THREE.BoxGeometry(0.86, 0.86, 0.86);
    const coreMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    cubeGroup.add(coreMesh);

    // Render loop syncing cube rotation with main viewport camera
    let animationId: number;
    const renderCube = () => {
      animationId = requestAnimationFrame(renderCube);

      if (mainCamera && cubeGroupRef.current) {
        // Sync ViewCube orientation perfectly with main camera orientation
        cubeGroupRef.current.quaternion.copy(mainCamera.quaternion).invert();
      }

      renderer.render(scene, camera);
    };
    renderCube();

    return () => {
      cancelAnimationFrame(animationId);
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [mainCamera]);

  // Align camera smoothly to part normal direction
  const alignCameraToPart = (part: CubePart) => {
    if (!mainCamera || !orbitControls) return;

    const target = orbitControls.target.clone();
    const distance = mainCamera.position.distanceTo(target);

    // Multiply normal vector by distance from target
    const offset = part.normal.clone().multiplyScalar(distance);
    // Prevent exactly zero up vector issues when looking straight top/bottom
    if (Math.abs(part.normal.y) > 0.99) {
      offset.z += 0.001;
    }

    const startPos = mainCamera.position.clone();
    const endPos = target.clone().add(offset);

    let progress = 0;
    const animateTransition = () => {
      progress += 0.1;
      if (progress < 1) {
        mainCamera.position.lerpVectors(startPos, endPos, progress);
        orbitControls.update();
        requestAnimationFrame(animateTransition);
      } else {
        mainCamera.position.copy(endPos);
        orbitControls.update();
      }
    };
    animateTransition();
  };

  // Roll camera around viewing axis by degrees
  const handleRollCamera = (angleDeg: number) => {
    if (!mainCamera || !orbitControls) return;
    const angleRad = THREE.MathUtils.degToRad(angleDeg);

    const forward = new THREE.Vector3();
    mainCamera.getWorldDirection(forward);
    const up = mainCamera.up.clone();
    up.applyAxisAngle(forward, angleRad);

    mainCamera.up.copy(up);
    orbitControls.update();
  };

  // Direct Interactive Pointer Drag & Hover Raycasting
  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    isDraggingRef.current = false;
    previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!containerRef.current || !cubeCameraRef.current || !cubeGroupRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    // Raycast parts for hover feedback
    raycasterRef.current.setFromCamera(mouseRef.current, cubeCameraRef.current);
    const intersects = raycasterRef.current.intersectObjects(cubeGroupRef.current.children);

    let hitPart: CubePart | null = null;
    if (intersects.length > 0) {
      const hitObj = intersects[0].object;
      hitPart = partsRef.current.find((p) => p.mesh === hitObj) || null;
    }

    if (hitPart) {
      setHoveredPartName(hitPart.name);
    } else {
      setHoveredPartName(null);
    }

    // Update material highlighting for all parts
    partsRef.current.forEach((part) => {
      const isHovered = hitPart?.id === part.id;
      const mat = part.mesh.material as THREE.MeshStandardMaterial;

      if (part.type === 'face') {
        if (mat.map) mat.map.dispose();
        mat.map = createFaceTexture(part.id, isHovered);
      } else if (part.type === 'edge') {
        mat.color.setHex(isHovered ? 0x0284c7 : 0x334155);
        mat.emissive.setHex(isHovered ? 0x0284c7 : 0x000000);
        mat.emissiveIntensity = isHovered ? 0.5 : 0;
      } else if (part.type === 'corner') {
        mat.color.setHex(isHovered ? 0x38bdf8 : 0x475569);
        mat.emissive.setHex(isHovered ? 0x38bdf8 : 0x000000);
        mat.emissiveIntensity = isHovered ? 0.6 : 0;
      }
    });

    // Fluid Orbit Dragging directly on ViewCube
    if (e.buttons === 1 && orbitControls && mainCamera) {
      const deltaX = e.clientX - previousMousePositionRef.current.x;
      const deltaY = e.clientY - previousMousePositionRef.current.y;

      if (Math.abs(deltaX) > 1.5 || Math.abs(deltaY) > 1.5) {
        isDraggingRef.current = true;
      }

      if (isDraggingRef.current) {
        const rotateSpeed = 0.006;
        const spherical = new THREE.Spherical();
        const offset = mainCamera.position.clone().sub(orbitControls.target);
        spherical.setFromVector3(offset);

        spherical.theta -= deltaX * rotateSpeed;
        spherical.phi -= deltaY * rotateSpeed;
        spherical.phi = Math.max(0.01, Math.min(Math.PI - 0.01, spherical.phi));

        offset.setFromSpherical(spherical);
        mainCamera.position.copy(orbitControls.target).add(offset);
        orbitControls.update();
      }

      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (!isDraggingRef.current && cubeGroupRef.current && cubeCameraRef.current) {
      raycasterRef.current.setFromCamera(mouseRef.current, cubeCameraRef.current);
      const intersects = raycasterRef.current.intersectObjects(cubeGroupRef.current.children);
      if (intersects.length > 0) {
        const hitObj = intersects[0].object;
        const hitPart = partsRef.current.find((p) => p.mesh === hitObj);
        if (hitPart) {
          alignCameraToPart(hitPart);
        }
      }
    }
    isDraggingRef.current = false;
  };

  const handleResetCamera = () => {
    if (!mainCamera || !orbitControls) return;
    orbitControls.target.set(0, 1, 0);
    mainCamera.position.set(8, 6, 10);
    mainCamera.up.set(0, 1, 0);
    orbitControls.update();
  };

  const handleFocusSelected = () => {
    if (!mainCamera || !orbitControls || !selectedObjectPosition) return;
    const [x, y, z] = selectedObjectPosition;
    orbitControls.target.set(x, y, z);
    mainCamera.position.set(x + 5, y + 4, z + 6);
    orbitControls.update();
  };

  return (
    <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-2 select-none group">
      {/* ViewCube Outer HUD Card */}
      <div className="relative bg-slate-900/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-2.5 shadow-2xl flex flex-col items-center transition-all hover:border-slate-700">
        {/* Roll View Ring Controls */}
        <div className="absolute -left-3 top-1/2 -translate-y-1/2 flex flex-col gap-1 z-10">
          <button
            onClick={() => handleRollCamera(-90)}
            className="p-1 rounded-full bg-slate-800/90 hover:bg-sky-600 text-slate-300 hover:text-white border border-slate-700/80 shadow transition-all hover:scale-110"
            title="Roll View 90° Counter-Clockwise"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleRollCamera(90)}
            className="p-1 rounded-full bg-slate-800/90 hover:bg-sky-600 text-slate-300 hover:text-white border border-slate-700/80 shadow transition-all hover:scale-110"
            title="Roll View 90° Clockwise"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* ViewCube 3D Render Canvas */}
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="w-[124px] h-[124px] cursor-grab active:cursor-grabbing touch-none relative"
          title="Click face, edge, or corner to align camera, or drag to orbit viewport freely"
        />

        {/* Active Hover Target Badge */}
        {hoveredPartName && (
          <div className="absolute -bottom-2 bg-sky-500 text-slate-950 font-extrabold text-[9px] font-mono px-2 py-0.5 rounded-full shadow-lg tracking-wider border border-sky-300 animate-fade-in">
            {hoveredPartName}
          </div>
        )}
      </div>

      {/* CAD Quick View Toolbar */}
      <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-800 text-xs shadow-xl">
        {selectedObjectPosition && (
          <button
            onClick={handleFocusSelected}
            className="px-2 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 font-semibold text-[11px] flex items-center gap-1 border border-sky-500/30 transition-all"
            title="Focus Camera Target on Selected 3D Object"
          >
            <Target className="w-3.5 h-3.5 text-sky-400" />
            Focus
          </button>
        )}
        <button
          onClick={handleResetCamera}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          title="Reset Camera Viewport Perspective"
        >
          <Home className="w-3.5 h-3.5" />
        </button>

        {/* Quick Face Presets */}
        <button
          onClick={() => {
            const part = partsRef.current.find((p) => p.id === 'TOP');
            if (part) alignCameraToPart(part);
          }}
          className="px-1.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors font-mono text-[10px] font-bold"
          title="Top Down View"
        >
          TOP
        </button>
        <button
          onClick={() => {
            const part = partsRef.current.find((p) => p.id === 'FRONT');
            if (part) alignCameraToPart(part);
          }}
          className="px-1.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors font-mono text-[10px] font-bold"
          title="Front Elevation View"
        >
          FRONT
        </button>
        <button
          onClick={() => {
            const part = partsRef.current.find((p) => p.id === 'TOP-FRONT-RIGHT');
            if (part) alignCameraToPart(part);
          }}
          className="px-1.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 hover:text-sky-200 transition-colors font-mono text-[10px] font-bold border border-sky-500/30"
          title="Isometric View"
        >
          ISO
        </button>
      </div>
    </div>
  );
};
