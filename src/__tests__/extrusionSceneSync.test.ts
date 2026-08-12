import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createParametricExtrusionGeometry, DEFAULT_PARAMETRIC_EXTRUSION, parametricExtrusionKey } from '../utils/parametricExtrusion';
import { syncExtrusionGeometry } from '../utils/extrusionSceneSync';

describe('extrusion scene synchronization', () => {
  it('keeps object and material identities while disposing every replaced geometry', () => {
    const roots = Array.from({ length: 80 }, (_, index) => {
      const root = new THREE.Group();
      root.userData.geometryKey = parametricExtrusionKey(DEFAULT_PARAMETRIC_EXTRUSION);
      root.add(new THREE.Mesh(createParametricExtrusionGeometry(DEFAULT_PARAMETRIC_EXTRUSION), new THREE.MeshStandardMaterial()));
      root.name = `extrusion-${index}`;
      return root;
    });
    const objects = [...roots];
    const materials = roots.map(root => (root.children[0] as THREE.Mesh).material);
    let disposals = 0;
    const start = performance.now();
    for (let pass = 1; pass <= 12; pass++) for (const root of roots) {
      const mesh = root.children[0] as THREE.Mesh;
      const spy = vi.spyOn(mesh.geometry, 'dispose').mockImplementation(() => { disposals += 1; });
      expect(syncExtrusionGeometry(root, { ...DEFAULT_PARAMETRIC_EXTRUSION, height: 1 + pass / 10 })).toBe(true);
      expect(spy).toHaveBeenCalledOnce();
    }
    const elapsed = performance.now() - start;
    expect(roots).toEqual(objects);
    roots.forEach((root, index) => expect((root.children[0] as THREE.Mesh).material).toBe(materials[index]));
    expect(disposals).toBe(80 * 12);
    expect(elapsed).toBeLessThan(5000);
    console.info(`extrusion scene proxy: ${roots.length} objects x 12 swaps in ${elapsed.toFixed(1)}ms`);
    roots.forEach(root => { const mesh = root.children[0] as THREE.Mesh; mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); });
  });
});
