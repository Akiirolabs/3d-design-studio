import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { ASSET_LIBRARY } from '../data/assetsLibrary';
import { EXPANDED_ASSET_LIBRARY } from '../data/expandedAssets';
import { ASSET_TYPE_CATEGORIES, filterAssets } from '../utils/assetCatalog';
import { createExpandedAsset, EXPANDED_ASSET_RECIPES, isExpandedAssetType, RPI4_PORT_CLEARANCES } from '../utils/expandedAssetGeometry';
import { AI_ASSET_TYPES, normalizeGeneratedScene } from '../../server/generatedScene';
import { validateSceneObjects } from '../utils/projectValidation';
import { applyPrecisionControlEvent, configureTransformSnapping, TRANSFORM_SNAPS } from '../utils/transformControls';
import { DEFAULT_PARAMETRIC_EXTRUSION } from '../utils/parametricExtrusion';

describe('expanded asset catalog', () => {
  const sceneObjectFor = (type: string, category: string) => ({
    id: `object-${type}`, name: type, type, category,
    position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
    color: '#334155', materialPreset: 'matte_white', metalness: 0, roughness: 0.5,
    transmission: 0, visible: true, locked: false,
    ...(type === 'parametric-extrusion' ? { geometry: DEFAULT_PARAMETRIC_EXTRUSION } : {}),
  });

  it('provides the requested section sizes and globally unique template IDs', () => {
    const count = (category: string) => ASSET_LIBRARY.filter((asset) => asset.category === category).length;
    expect(count('primitives')).toBeGreaterThanOrEqual(20);
    expect(count('technology')).toBeGreaterThanOrEqual(16);
    expect(count('stationery')).toBeGreaterThanOrEqual(12);
    expect(count('creative')).toBeGreaterThanOrEqual(8);
    expect(new Set(ASSET_LIBRARY.map((asset) => asset.id)).size).toBe(ASSET_LIBRARY.length);
    expect(new Set(EXPANDED_ASSET_LIBRARY.map((asset) => asset.type)).size).toBe(EXPANDED_ASSET_LIBRARY.length);
  });

  it('has an explicit nonempty, finite geometry recipe for every new template', () => {
    const recipeTypes = Object.keys(EXPANDED_ASSET_RECIPES).sort();
    expect(recipeTypes).toEqual(EXPANDED_ASSET_LIBRARY.map((asset) => asset.type).filter(type => type !== 'parametric-extrusion').sort());

    for (const asset of EXPANDED_ASSET_LIBRARY.filter(asset => asset.type !== 'parametric-extrusion')) {
      expect(isExpandedAssetType(asset.type)).toBe(true);
      const material = new THREE.MeshBasicMaterial();
      const object = createExpandedAsset(asset.type, material);
      expect(object.children.length, asset.id).toBeGreaterThan(0);
      expect(object.children.length, asset.id).toBeLessThanOrEqual(10);
      object.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(object);
      expect(bounds.isEmpty(), asset.id).toBe(false);
      for (const value of [...bounds.min.toArray(), ...bounds.max.toArray()]) {
        expect(Number.isFinite(value), asset.id).toBe(true);
      }
      object.traverse((child) => {
        if (child instanceof THREE.Mesh) child.geometry.dispose();
      });
      material.dispose();
    }
  });

  it('uses one authoritative type/category mapping for every legacy and expanded asset', () => {
    expect(ASSET_TYPE_CATEGORIES.size).toBe(ASSET_LIBRARY.length);
    for (const asset of ASSET_LIBRARY) {
      expect(ASSET_TYPE_CATEGORIES.get(asset.type), asset.type).toBe(asset.category);
      expect(validateSceneObjects([sceneObjectFor(asset.type, asset.category)]).success, asset.type).toBe(true);
    }
  });

  it('maps every server-allowed AI type to its authoritative catalog category and rejects unknown types', () => {
    expect(AI_ASSET_TYPES).toEqual(ASSET_LIBRARY.map((asset) => asset.type));
    const generated = normalizeGeneratedScene({ objects: AI_ASSET_TYPES.map((type) => ({ type })) });
    const objects = generated.objects as Array<{ type: string; category: string }>;
    expect(objects).toHaveLength(ASSET_LIBRARY.length);
    for (const object of objects) expect(object.category).toBe(ASSET_TYPE_CATEGORIES.get(object.type));
    expect(() => normalizeGeneratedScene({ objects: [{ type: 'invented-shape' }] })).toThrow('unsupported asset type');
  });

  it('rejects unknown and mismatched type/category pairs with actionable errors', () => {
    const unknown = validateSceneObjects([sceneObjectFor('not-a-real-shape', 'primitives')]);
    expect(unknown.success).toBe(false);
    if ('error' in unknown) expect(unknown.error).toContain('unsupported asset type');

    const mismatch = validateSceneObjects([sceneObjectFor('cube', 'technology')]);
    expect(mismatch.success).toBe(false);
    if ('error' in mismatch) expect(mismatch.error).toContain('belongs to category "primitives"');

    expect(validateSceneObjects([sceneObjectFor('plane', 'architecture')]).success).toBe(false);
  });

  it('rejects unsupported expanded asset types instead of silently creating a cube', () => {
    expect(isExpandedAssetType('not-a-template')).toBe(false);
    expect(() => createExpandedAsset('not-a-template', new THREE.MeshBasicMaterial())).toThrow(
      'Unsupported expanded asset type'
    );
  });

  it('keeps matched screen, frame, and cover world geometry aligned for each nominal size', () => {
    for (const size of ['5', '7', '10']) {
      const screen = ASSET_LIBRARY.find((asset) => asset.id === `screen-${size}`)!;
      const frame = ASSET_LIBRARY.find((asset) => asset.id === `screen-frame-${size}`)!;
      const cover = ASSET_LIBRARY.find((asset) => asset.id === `screen-back-${size}`)!;
      const makeBounds = (asset: typeof screen) => {
        const material = new THREE.MeshBasicMaterial();
        const object = createExpandedAsset(asset.type, material);
        object.scale.set(...asset.defaultScale);
        object.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(object);
        object.traverse((child) => child instanceof THREE.Mesh && child.geometry.dispose());
        material.dispose();
        return bounds.getSize(new THREE.Vector3());
      };
      const screenBounds = makeBounds(screen);
      const frameBounds = makeBounds(frame);
      const coverBounds = makeBounds(cover);
      for (const [bounds, expected] of [[screenBounds, screen.defaultScale], [frameBounds, frame.defaultScale], [coverBounds, cover.defaultScale]] as const) {
        expect(bounds.x).toBeCloseTo(expected[0], 5);
        expect(bounds.y).toBeCloseTo(expected[1], 5);
        expect(bounds.z).toBeCloseTo(expected[2], 5);
      }
      expect(frameBounds.x).toBeCloseTo(coverBounds.x, 5);
      expect(frameBounds.y).toBeCloseTo(coverBounds.y, 5);
      const openingWidth = frame.defaultScale[0] * 0.96;
      const openingHeight = frame.defaultScale[1] * 0.96;
      expect(openingWidth).toBeGreaterThan(screenBounds.x);
      expect(openingHeight).toBeGreaterThan(screenBounds.y);
    }
    const pi = ASSET_LIBRARY.find((asset) => asset.id === 'rpi4-pcb')!;
    expect(pi.description).toContain('85 x 56 mm');
    expect(pi.description).toContain('reference-fit');
  });

  it('models the Pi reference footprint, positive case clearance, and spatially empty port access gaps', () => {
    const boundsFor = (id: string) => {
      const asset = ASSET_LIBRARY.find((candidate) => candidate.id === id)!;
      const material = new THREE.MeshBasicMaterial();
      const object = createExpandedAsset(asset.type, material);
      object.scale.set(...asset.defaultScale);
      object.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(object);
      return { object, material, size: bounds.getSize(new THREE.Vector3()) };
    };
    const pcb = boundsFor('rpi4-pcb');
    const caseBase = boundsFor('rpi4-case-base');
    const board = pcb.object.getObjectByName('PCB 85x56 reference')!;
    const boardBounds = new THREE.Box3().setFromObject(board);
    const boardSize = boardBounds.getSize(new THREE.Vector3());
    expect(boardSize.x).toBeCloseTo(0.85, 5);
    expect(boardSize.z).toBeCloseTo(0.56, 5);
    expect(caseBase.size.x).toBeGreaterThan(boardSize.x);
    expect(caseBase.size.z).toBeGreaterThan(boardSize.z);

    const caseTop = boundsFor('rpi4-case-top');
    const portCase = boundsFor('rpi4-port-case');
    const namedPorts = RPI4_PORT_CLEARANCES.map(({ name }) => pcb.object.getObjectByName(`${name} reference`)!);
    const positiveSeparation = (first: THREE.Box3, second: THREE.Box3) => Math.max(
      first.min.x - second.max.x, second.min.x - first.max.x,
      first.min.y - second.max.y, second.min.y - first.max.y,
      first.min.z - second.max.z, second.min.z - first.max.z,
    );
    for (const enclosure of [caseBase, caseTop, portCase]) {
      for (const child of enclosure.object.children) {
        const solid = new THREE.Box3().setFromObject(child);
        for (const target of [board, ...namedPorts]) {
          const targetBounds = new THREE.Box3().setFromObject(target);
          expect(solid.intersectsBox(targetBounds), `${enclosure.object.name || 'enclosure'} ${child.name} intersects ${target.name}`).toBe(false);
          expect(positiveSeparation(solid, targetBounds), `${child.name} has no positive clearance from ${target.name}`).toBeGreaterThan(0.001);
        }
      }
    }
    for (const clearance of RPI4_PORT_CLEARANCES) {
      const gap = new THREE.Box3(new THREE.Vector3(...clearance.min), new THREE.Vector3(...clearance.max));
      const port = pcb.object.getObjectByName(`${clearance.name} reference`)!;
      const portBounds = new THREE.Box3().setFromObject(port);
      expect(gap.containsBox(portBounds), `${clearance.name} reference is outside its clearance`).toBe(true);
      for (const child of portCase.object.children) {
        const solid = new THREE.Box3().setFromObject(child);
        expect(solid.intersectsBox(gap), `${clearance.name} clearance intersects ${child.name}`).toBe(false);
        expect(solid.intersectsBox(portBounds), `${clearance.name} reference intersects ${child.name}`).toBe(false);
      }
    }
    for (const entry of [pcb, caseBase, caseTop, portCase]) {
      entry.object.traverse((child) => child instanceof THREE.Mesh && child.geometry.dispose());
      entry.material.dispose();
    }
  });

  it('filters independently by section, names, descriptions, and tags', () => {
    expect(filterAssets(ASSET_LIBRARY, 'technology', '').length).toBeGreaterThanOrEqual(16);
    expect(filterAssets(ASSET_LIBRARY, 'all', 'raspberry pi').map((asset) => asset.id)).toContain('rpi4-pcb');
    expect(filterAssets(ASSET_LIBRARY, 'stationery', 'monitor').map((asset) => asset.id)).toEqual(['monitor-riser']);
    expect(filterAssets(ASSET_LIBRARY, 'creative', 'raspberry pi')).toEqual([]);
  });

  it('round-trips objects in every new category without changing legacy data fields', () => {
    const objects = ['technology', 'stationery', 'creative'].map((category, index) => ({
      id: `new-${index}`,
      name: `Object ${index}`,
      type: EXPANDED_ASSET_LIBRARY.find((asset) => asset.category === category)!.type,
      category,
      position: [0.2, -0.2, 0.4], rotation: [0, 15, 0], scale: [1, 1, 1],
      color: '#334155', materialPreset: 'matte_white', metalness: 0, roughness: 0.5,
      transmission: 0, visible: true, locked: false,
    }));
    const result = validateSceneObjects(JSON.parse(JSON.stringify(objects)));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual(objects);
  });
});

describe('fixed transform snapping', () => {
  it('uses 0.2-unit translation and exposes Ctrl precision increments', () => {
    expect(TRANSFORM_SNAPS).toEqual({ translation: 0.2, rotationDegrees: 15, scale: 0.25, precisionTranslation: 0.05, precisionScale: 0.05 });
  });

  it('applies and disables each transform snap independently', () => {
    const controls = {
      setTranslationSnap: vi.fn(), setRotationSnap: vi.fn(), setScaleSnap: vi.fn(),
    };
    configureTransformSnapping(controls, true);
    expect(controls.setTranslationSnap).toHaveBeenLastCalledWith(0.2);
    expect(controls.setRotationSnap).toHaveBeenLastCalledWith(Math.PI / 12);
    expect(controls.setScaleSnap).toHaveBeenLastCalledWith(0.25);
    configureTransformSnapping(controls, false);
    expect(controls.setTranslationSnap).toHaveBeenLastCalledWith(null);
    expect(controls.setRotationSnap).toHaveBeenLastCalledWith(null);
    expect(controls.setScaleSnap).toHaveBeenLastCalledWith(null);
    configureTransformSnapping(controls, true, true);
    expect(controls.setTranslationSnap).toHaveBeenLastCalledWith(0.05);
    expect(controls.setScaleSnap).toHaveBeenLastCalledWith(0.05);
  });
  it('resets Ctrl precision for every interaction-ending event and respects disabled snapping',()=>{const controls={setTranslationSnap:vi.fn(),setRotationSnap:vi.fn(),setScaleSnap:vi.fn()};applyPrecisionControlEvent(controls,true,'keydown');expect(controls.setTranslationSnap).toHaveBeenLastCalledWith(.05);for(const event of ['keyup','blur','visibility-hidden','pointerup','modal-open'] as const){applyPrecisionControlEvent(controls,true,event);expect(controls.setTranslationSnap).toHaveBeenLastCalledWith(.2);}applyPrecisionControlEvent(controls,false,'keydown');expect(controls.setTranslationSnap).toHaveBeenLastCalledWith(null);expect(controls.setScaleSnap).toHaveBeenLastCalledWith(null);});
});
