import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type Part = {
  name?: string;
  shape: 'box' | 'roundedBox' | 'cylinder' | 'tube' | 'sphere' | 'hemisphere' | 'cone' | 'torus' | 'ring' | 'capsule' | 'wedge' | 'star' | 'tetrahedron' | 'octahedron' | 'dodecahedron' | 'icosahedron';
  size?: [number, number, number];
  position?: [number, number, number];
  rotation?: [number, number, number];
};

const box = (size: [number, number, number], position: [number, number, number] = [0, 0, 0], name?: string): Part => ({ shape: 'box', size, position, name });
const screen = (): Part[] => [box([1, 1, 1])];
const frame = (w = 1, h = 1): Part[] => {
  const bezel = 0.02;
  return [
  box([w, bezel, 1], [0, (h - bezel) / 2, 0]), box([w, bezel, 1], [0, -(h - bezel) / 2, 0]),
  box([bezel, h - bezel * 2, 1], [-(w - bezel) / 2, 0, 0]), box([bezel, h - bezel * 2, 1], [(w - bezel) / 2, 0, 0]),
  ];
};
const back = (): Part[] => [box([1, 1, 1])];

export const RPI4_PORT_CLEARANCES = Object.freeze([
  { name: 'USB', min: [0.34, 0, -0.18], max: [0.51, 0.105, -0.045] },
  { name: 'Ethernet', min: [0.34, 0, 0.04], max: [0.51, 0.105, 0.16] },
  { name: 'HDMI', min: [-0.245, 0, -0.33], max: [-0.06, 0.105, -0.24] },
  { name: 'Power', min: [0.035, 0, -0.33], max: [0.17, 0.105, -0.245] },
] as const);

export const EXPANDED_ASSET_RECIPES: Readonly<Record<string, readonly Part[]>> = {
  'rounded-box': [{ shape: 'roundedBox', size: [1, 1, 1] }],
  pyramid: [{ shape: 'cone', size: [0.7, 1, 4] }],
  tetrahedron: [{ shape: 'tetrahedron' }],
  octahedron: [{ shape: 'octahedron' }],
  dodecahedron: [{ shape: 'dodecahedron' }],
  icosahedron: [{ shape: 'icosahedron' }],
  ring: [{ shape: 'ring', size: [0.3, 0.5, 32], rotation: [Math.PI / 2, 0, 0] }],
  tube: [{ shape: 'tube', size: [0.5, 1, 32] }],
  wedge: [{ shape: 'wedge' }],
  hemisphere: [{ shape: 'hemisphere', size: [0.5, 24, 12] }],
  star: [{ shape: 'star' }],
  'hex-prism': [{ shape: 'cylinder', size: [0.5, 1, 6] }],
  cross: [box([1, 0.34, 0.34]), box([0.34, 1, 0.34]), box([0.34, 0.34, 1])],

  'rpi4-pcb': [box([1, 1, 1], [0, 0, 0], 'PCB 85x56 reference'), box([0.18, 1, 0.2], [0.5, 0.75, -0.2], 'USB reference'), box([0.18, 1, 0.18], [0.5, 0.75, 0.18], 'Ethernet reference'), box([0.2, 1, 0.12], [-0.18, 0.75, -0.5], 'HDMI reference'), box([0.14, 1, 0.1], [0.12, 0.75, -0.5], 'Power reference')],
  'rpi4-case-base': [
    box([1, 0.10, 1], [0, -0.45, 0], 'Case floor'),
    box([0.025, 0.8, 1], [-0.4875, 0, 0], 'Left wall'),
    box([0.025, 0.8, 0.2], [0.4875, 0, -0.4], 'Right wall rear segment'),
    box([0.025, 0.8, 0.115], [0.4875, 0, -0.0025], 'Right wall center segment'),
    box([0.025, 0.8, 0.22], [0.4875, 0, 0.39], 'Right wall front segment'),
    box([0.22, 0.8, 0.025], [-0.39, 0, -0.4875], 'Back wall left segment'),
    box([0.08, 0.8, 0.025], [-0.015, 0, -0.4875], 'Back wall center segment'),
    box([0.3, 0.8, 0.025], [0.35, 0, -0.4875], 'Back wall right segment'),
    box([1, 0.8, 0.025], [0, 0, 0.4875], 'Front wall'),
  ],
  'rpi4-case-top': [
    box([1, 0.10, 1], [0, 0.95, 0], 'Case lid'),
    box([0.35, 0.03, 0.04], [0, 1.02, 0]),
    box([0.35, 0.03, 0.04], [0, 1.02, 0.14]),
    box([0.35, 0.03, 0.04], [0, 1.02, -0.14]),
  ],
  'rpi4-port-case': [
    box([1, 0.10, 1], [0, -0.45, 0], 'Case floor'),
    box([1, 0.10, 1], [0, 0.45, 0], 'Case lid'),
    box([0.025, 0.8, 1], [-0.4875, 0, 0], 'Left wall'),
    box([0.025, 0.8, 0.2], [0.4875, 0, -0.4], 'Right wall rear segment'),
    box([0.025, 0.8, 0.115], [0.4875, 0, -0.0025], 'Right wall center segment'),
    box([0.025, 0.8, 0.22], [0.4875, 0, 0.39], 'Right wall front segment'),
    box([0.22, 0.8, 0.025], [-0.39, 0, -0.4875], 'Back wall left segment'),
    box([0.08, 0.8, 0.025], [-0.015, 0, -0.4875], 'Back wall center segment'),
    box([0.3, 0.8, 0.025], [0.35, 0, -0.4875], 'Back wall right segment'),
    box([1, 0.8, 0.025], [0, 0, 0.4875], 'Front wall'),
  ],
  'cyberdeck-frame': [...frame(1, 0.7), box([1, 0.08, 0.7], [0, -0.44, 0])],
  'cyberdeck-handle': [box([0.8, 0.12, 0.12], [0, 0.4, 0]), box([0.12, 0.8, 0.12], [-0.34, 0, 0]), box([0.12, 0.8, 0.12], [0.34, 0, 0])],
  'screen-5': screen(), 'screen-frame-5': frame(), 'screen-back-5': back(),
  'screen-7': screen(), 'screen-frame-7': frame(), 'screen-back-7': back(),
  'screen-10': screen(), 'screen-frame-10': frame(), 'screen-back-10': back(),
  'keyboard-tray': [box([1, 0.08, 0.55]), box([0.95, 0.05, 0.08], [0, 0.08, -0.23])],

  'pen-cup': [{ shape: 'cylinder', size: [0.5, 1, 24] }, { shape: 'cylinder', size: [0.4, 1.02, 24] }],
  'pencil-tray': [box([1, 0.08, 0.5]), box([1, 0.18, 0.05], [0, 0.1, -0.23]), box([1, 0.18, 0.05], [0, 0.1, 0.23])],
  'desk-organizer': [box([1, 0.08, 0.7]), box([0.05, 0.5, 0.7], [-0.48, 0.25, 0]), box([0.05, 0.5, 0.7], [0.48, 0.25, 0]), box([0.05, 0.5, 0.7], [0, 0.25, 0])],
  'phone-stand': [box([0.7, 0.08, 0.7]), { ...box([0.7, 0.08, 0.8], [0, 0.35, 0.2]), rotation: [Math.PI / 5, 0, 0] }],
  'tablet-stand': [box([1, 0.08, 0.8]), { ...box([1, 0.08, 0.9], [0, 0.4, 0.2]), rotation: [Math.PI / 6, 0, 0] }],
  'business-card-holder': [box([1, 0.08, 0.5]), box([1, 0.35, 0.06], [0, 0.18, 0.2])],
  'paper-tray': [box([1, 0.05, 0.75]), box([0.05, 0.25, 0.75], [-0.48, 0.12, 0]), box([0.05, 0.25, 0.75], [0.48, 0.12, 0])],
  bookend: [box([0.8, 0.06, 0.8]), box([0.8, 0.8, 0.06], [0, 0.4, -0.37])],
  'cable-clip': [{ shape: 'torus', size: [0.35, 0.1, 20] }, box([0.45, 0.1, 0.2], [0, -0.35, 0])],
  'headphone-stand': [box([0.8, 0.08, 0.8], [0, -0.46, 0]), box([0.12, 0.9, 0.12]), { shape: 'torus', size: [0.32, 0.08, 20], position: [0, 0.45, 0] }],
  'sticky-note-holder': [box([0.8, 0.06, 0.8]), box([0.05, 0.3, 0.8], [-0.38, 0.15, 0]), box([0.05, 0.3, 0.8], [0.38, 0.15, 0])],
  'monitor-riser': [box([1, 0.1, 0.6], [0, 0.35, 0]), box([0.1, 0.7, 0.5], [-0.43, 0, 0]), box([0.1, 0.7, 0.5], [0.43, 0, 0])],

  gear: [{ shape: 'torus', size: [0.34, 0.12, 16] }, box([1, 0.12, 0.16]), box([0.16, 0.12, 1])],
  vase: [{ shape: 'cylinder', size: [0.35, 0.5, 10] }, { shape: 'cylinder', size: [0.22, 1, 10], position: [0, 0.35, 0] }],
  planter: [{ shape: 'cylinder', size: [0.5, 0.8, 8] }, { shape: 'ring', size: [0.35, 0.5, 8], position: [0, 0.4, 0] }],
  'wall-hook': [box([0.45, 0.7, 0.1]), { shape: 'torus', size: [0.25, 0.09, 20], position: [0, -0.2, 0.25], rotation: [Math.PI / 2, 0, 0] }],
  'key-tag': [{ shape: 'capsule', size: [0.28, 0.5, 16] }, { shape: 'torus', size: [0.1, 0.04, 16], position: [0, 0.35, 0] }],
  dice: [box([1, 1, 1])],
  'mini-crate': [box([1, 0.08, 0.7], [0, -0.45, 0]), box([0.08, 0.9, 0.08], [-0.45, 0, -0.3]), box([0.08, 0.9, 0.08], [0.45, 0, -0.3]), box([0.08, 0.9, 0.08], [-0.45, 0, 0.3]), box([0.08, 0.9, 0.08], [0.45, 0, 0.3])],
  'display-plinth': [box([1, 0.2, 1], [0, -0.35, 0]), box([0.75, 0.3, 0.75], [0, -0.1, 0]), box([0.5, 0.4, 0.5], [0, 0.25, 0])],
};

function closedAnnulus(inner:number,outer:number,depth:number,segments:number):THREE.BufferGeometry {
  const shape=new THREE.Shape();shape.absarc(0,0,outer,0,Math.PI*2,false);const hole=new THREE.Path();hole.absarc(0,0,inner,0,Math.PI*2,true);shape.holes.push(hole);
  const result=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:segments,steps:1});result.translate(0,0,-depth/2);result.rotateX(-Math.PI/2);result.computeVertexNormals();return result;
}

function closedHemisphere(radius:number,widthSegments:number,heightSegments:number):THREE.BufferGeometry {
  const shell=new THREE.SphereGeometry(radius,widthSegments,heightSegments,0,Math.PI*2,0,Math.PI/2),cap=new THREE.CircleGeometry(radius,widthSegments);cap.rotateX(Math.PI/2);const result=mergeGeometries([shell,cap],false);shell.dispose();cap.dispose();if(!result)throw new Error('Could not create closed hemisphere geometry.');result.computeVertexNormals();return result;
}

function geometry(part: Part): THREE.BufferGeometry {
  const [a = 0.5, b = 1, c = 16] = part.size ?? [];
  switch (part.shape) {
    case 'box': return new THREE.BoxGeometry(a, b, c);
    case 'roundedBox': return new RoundedBoxGeometry(a, b, c, 3, 0.1);
    case 'cylinder': return new THREE.CylinderGeometry(a, a, b, c);
    case 'tube': return closedAnnulus(Math.max(a*.72,1e-3),a,b,c);
    case 'sphere': return new THREE.SphereGeometry(a, b, c);
    case 'hemisphere': return closedHemisphere(a,b,c);
    case 'cone': return new THREE.ConeGeometry(a, b, c);
    case 'torus': return new THREE.TorusGeometry(a, b, 12, c);
    case 'ring': return closedAnnulus(a,b,Math.max((b-a)*.15,.015),c);
    case 'capsule': return new THREE.CapsuleGeometry(a, b, 8, c);
    case 'wedge': {
      const vertices = new Float32Array([-0.5,-0.5,-0.5, 0.5,-0.5,-0.5, -0.5,-0.5,0.5, 0.5,-0.5,0.5, -0.5,0.5,0.5, 0.5,0.5,0.5]);
      const indices = [0,2,1,1,2,3, 2,4,3,3,4,5, 0,1,4,1,5,4, 0,4,2, 1,3,5];
      const result = new THREE.BufferGeometry();
      result.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      result.setIndex(indices);
      result.computeVertexNormals();
      return result;
    }
    case 'star': {
      const shape = new THREE.Shape();
      for (let point = 0; point < 10; point += 1) {
        const angle = -Math.PI / 2 + point * Math.PI / 5;
        const radius = point % 2 === 0 ? 0.5 : 0.22;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (point === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
      }
      shape.closePath();
      const result = new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: false });
      result.center();
      return result;
    }
    case 'tetrahedron': return new THREE.TetrahedronGeometry(0.6);
    case 'octahedron': return new THREE.OctahedronGeometry(0.6);
    case 'dodecahedron': return new THREE.DodecahedronGeometry(0.6);
    case 'icosahedron': return new THREE.IcosahedronGeometry(0.6);
  }
}

export function isExpandedAssetType(type: string): boolean {
  return Object.prototype.hasOwnProperty.call(EXPANDED_ASSET_RECIPES, type);
}

export function createExpandedAsset(type: string, material: THREE.Material): THREE.Group {
  const recipe = EXPANDED_ASSET_RECIPES[type];
  if (!recipe) throw new Error(`Unsupported expanded asset type: ${type}`);
  const group = new THREE.Group();
  recipe.forEach((part) => {
    const mesh = new THREE.Mesh(geometry(part), material);
    if (part.name) mesh.name = part.name;
    if (part.position) mesh.position.set(...part.position);
    if (part.rotation) mesh.rotation.set(...part.rotation);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  });
  return group;
}
