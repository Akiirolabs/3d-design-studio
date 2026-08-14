import * as THREE from 'three';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { ProjectData } from '../types';

/**
 * Downloads a string or blob as a client-side file save
 */
function downloadFile(content: Blob | string, filename: string, mimeType: string) {
  const blob = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
export function buildExportScene(scene:THREE.Scene):THREE.Group{const clean=new THREE.Group(),cloneWithoutHelpers=(source:THREE.Object3D):THREE.Object3D|null=>{if(source.userData.editorHelper||source.renderOrder>=1000)return null;const clone=source.clone(false);for(const child of source.children){const next=cloneWithoutHelpers(child);if(next)clone.add(next);}return clone;};for(const child of scene.children)if(child.visible&&(child.name?.startsWith('user_object_')||child.type==='Mesh'||child.type==='Group')){const clone=cloneWithoutHelpers(child);if(clone)clean.add(clone);}return clean;}

/**
 * Export Three.js scene to OBJ format
 */
export function exportToOBJ(scene: THREE.Scene, filename = 'design_model.obj'): string {
  if (!scene || !scene.children) return '';
  const exporter = new OBJExporter();
  // Filter out helpers, grid, lights if needed, or export mesh geometries
  const cleanGroup = buildExportScene(scene);

  const result = exporter.parse(cleanGroup);
  if (typeof document !== 'undefined') {
    downloadFile(result, filename, 'text/plain');
  }
  return result;
}

/**
 * Export Three.js scene to STL (3D Printing format)
 */
export function exportToSTL(scene: THREE.Scene, filename = 'design_model.stl'): string | ArrayBuffer {
  if (!scene || !scene.children) return '';
  const exporter = new STLExporter();
  const cleanGroup = buildExportScene(scene);

  const result = exporter.parse(cleanGroup, { binary: false });
  if (typeof document !== 'undefined') {
    const blob = typeof result === 'string' 
      ? new Blob([result], { type: 'text/plain' }) 
      : new Blob([result], { type: 'application/octet-stream' });
    downloadFile(blob, filename, 'application/octet-stream');
  }
  return result;
}

/**
 * Export Three.js scene to GLTF/GLB (Web standard 3D format)
 */
export function exportToGLTF(scene: THREE.Scene, binary = true, filename = 'design_model.glb') {
  const exporter = new GLTFExporter();
  const exportScene = buildExportScene(scene);

  exporter.parse(
    exportScene,
    (gltf) => {
      if (gltf instanceof ArrayBuffer) {
        const blob = new Blob([gltf], { type: 'application/octet-stream' });
        downloadFile(blob, filename, 'application/octet-stream');
      } else {
        const output = JSON.stringify(gltf, null, 2);
        downloadFile(output, filename.replace('.glb', '.gltf'), 'application/json');
      }
    },
    (error) => {
      console.error('GLTF Export Error:', error);
    },
    { binary }
  );
}

/**
 * Export complete project JSON state
 */
export function exportToJSON(project: ProjectData, filename = 'project_scene.json') {
  const content = JSON.stringify(project, null, 2);
  downloadFile(content, filename, 'application/json');
}

/**
 * Capture High-Res Render Snapshot
 */
export function captureRenderSnapshot(renderer: THREE.WebGLRenderer, filename = 'render_view.png') {
  const dataUrl = renderer.domElement.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
