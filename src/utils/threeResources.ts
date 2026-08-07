import * as THREE from 'three';

function disposeMaterialTextures(material: THREE.Material): void {
  Object.values(material).forEach((value) => {
    if (value instanceof THREE.Texture) value.dispose();
  });
}

export function disposeMaterials(materials: Iterable<THREE.Material>): void {
  const disposed = new Set<THREE.Material>();
  for (const material of materials) {
    if (disposed.has(material)) continue;
    disposed.add(material);
    disposeMaterialTextures(material);
    material.dispose();
  }
}

export function disposeObject3DResources(object: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();

  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    geometries.add(child.geometry);
    const childMaterials = Array.isArray(child.material) ? child.material : [child.material];
    childMaterials.forEach((material) => materials.add(material));
  });

  geometries.forEach((geometry) => geometry.dispose());
  disposeMaterials(materials);
}
