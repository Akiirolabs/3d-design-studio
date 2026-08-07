import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { disposeMaterials, disposeObject3DResources } from '../utils/threeResources';

describe('Three.js resource disposal', () => {
  it('disposes shared object resources exactly once', () => {
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshStandardMaterial();
    const texture = new THREE.Texture();
    material.map = texture;
    const geometryDispose = vi.spyOn(geometry, 'dispose');
    const materialDispose = vi.spyOn(material, 'dispose');
    const textureDispose = vi.spyOn(texture, 'dispose');
    const group = new THREE.Group();
    group.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, material));

    disposeObject3DResources(group);

    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(textureDispose).toHaveBeenCalledTimes(1);
  });

  it('deduplicates materials supplied directly', () => {
    const material = new THREE.MeshBasicMaterial();
    const dispose = vi.spyOn(material, 'dispose');

    disposeMaterials([material, material]);

    expect(dispose).toHaveBeenCalledTimes(1);
  });
});
