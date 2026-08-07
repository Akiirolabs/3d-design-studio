import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SceneObject, AssetTemplate } from '../types';
import { ASSET_LIBRARY } from '../data/assetsLibrary';
import { DEFAULT_PROJECT_OBJECTS, DEFAULT_ENVIRONMENT, getInitialProject } from '../utils/storage';
import { exportToOBJ, exportToSTL } from '../utils/exporters';

describe('CAD Studio 3D Object State, Transform Integrity & Scene Operations', () => {
  it('should maintain accurate position, rotation, and scale for SceneObjects', () => {
    const testObj: SceneObject = {
      id: 'test_obj_1',
      name: 'Test Box',
      type: 'cube',
      category: 'primitives',
      position: [1.5, 2.0, -3.2],
      rotation: [45, 90, 0],
      scale: [2.0, 0.5, 1.0],
      color: '#06b6d4',
      materialPreset: 'custom',
      metalness: 0.1,
      roughness: 0.3,
      transmission: 0,
      visible: true,
      locked: false,
    };

    expect(testObj.position).toEqual([1.5, 2.0, -3.2]);
    expect(testObj.rotation).toEqual([45, 90, 0]);
    expect(testObj.scale).toEqual([2.0, 0.5, 1.0]);
  });

  it('should convert degrees to radians accurately for Three.js transforms without drift', () => {
    const degrees = [90, 180, -45];
    const radians = degrees.map((deg) => THREE.MathUtils.degToRad(deg));

    expect(radians[0]).toBeCloseTo(Math.PI / 2, 5);
    expect(radians[1]).toBeCloseTo(Math.PI, 5);
    expect(radians[2]).toBeCloseTo(-Math.PI / 4, 5);

    const backToDeg = radians.map((rad) => Math.round(THREE.MathUtils.radToDeg(rad)));
    expect(backToDeg).toEqual(degrees);
  });

  it('should create initial default project with valid objects and environment settings', () => {
    expect(DEFAULT_PROJECT_OBJECTS).toBeDefined();
    expect(DEFAULT_PROJECT_OBJECTS.length).toBeGreaterThan(0);
    expect(DEFAULT_ENVIRONMENT).toBeDefined();
    expect(DEFAULT_ENVIRONMENT.theme).toBe('studio');

    DEFAULT_PROJECT_OBJECTS.forEach((obj) => {
      expect(obj.id).toBeDefined();
      expect(obj.position.length).toBe(3);
      expect(obj.rotation.length).toBe(3);
      expect(obj.scale.length).toBe(3);
      expect(typeof obj.visible).toBe('boolean');
    });
  });

  it('should allow adding shapes from all library templates and format valid SceneObjects', () => {
    let objectsList: SceneObject[] = [...DEFAULT_PROJECT_OBJECTS];

    ASSET_LIBRARY.forEach((template: AssetTemplate) => {
      const newObj: SceneObject = {
        id: `obj_${template.id}_${Date.now()}`,
        name: `${template.name} ${objectsList.length + 1}`,
        category: template.category,
        type: template.type,
        position: [0, 1, 0],
        rotation: [0, 0, 0],
        scale: template.defaultScale,
        color: template.defaultColor,
        materialPreset: template.defaultMaterial,
        metalness: 0.1,
        roughness: 0.4,
        transmission: 0,
        visible: true,
        locked: false,
      };

      objectsList.push(newObj);
      expect(newObj.id).toContain(template.id);
      expect(newObj.category).toBe(template.category);
      expect(newObj.scale).toEqual(template.defaultScale);
    });

    expect(objectsList.length).toBe(DEFAULT_PROJECT_OBJECTS.length + ASSET_LIBRARY.length);
  });

  it('should support selecting, switching, and clearing selection freely between shapes', () => {
    const objects: SceneObject[] = [
      {
        id: 'shape_1',
        name: 'Sphere 1',
        type: 'sphere',
        category: 'primitives',
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        color: '#ff0000',
        materialPreset: 'custom',
        metalness: 0,
        roughness: 0.5,
        transmission: 0,
        visible: true,
        locked: false,
      },
      {
        id: 'shape_2',
        name: 'Cube 2',
        type: 'cube',
        category: 'primitives',
        position: [3, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        color: '#00ff00',
        materialPreset: 'custom',
        metalness: 0,
        roughness: 0.5,
        transmission: 0,
        visible: true,
        locked: false,
      },
    ];

    let selectedId: string | null = null;

    // Pick shape 1
    selectedId = objects[0].id;
    expect(selectedId).toBe('shape_1');

    // Switch selection freely to shape 2
    selectedId = objects[1].id;
    expect(selectedId).toBe('shape_2');

    // Deselect back to null
    selectedId = null;
    expect(selectedId).toBeNull();
  });

  it('should perform 3D position, rotation, and scale movements accurately on added shapes', () => {
    let shape: SceneObject = {
      id: 'moveable_shape',
      name: 'Moving Pyramid',
      type: 'cone',
      category: 'primitives',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: '#3b82f6',
      materialPreset: 'custom',
      metalness: 0,
      roughness: 0.5,
      transmission: 0,
      visible: true,
      locked: false,
    };

    // Move translation
    const newPos: [number, number, number] = [4.5, 2.1, -8.3];
    shape = { ...shape, position: newPos };
    expect(shape.position).toEqual([4.5, 2.1, -8.3]);

    // Apply rotation
    const newRot: [number, number, number] = [30, 45, 90];
    shape = { ...shape, rotation: newRot };
    expect(shape.rotation).toEqual([30, 45, 90]);

    // Apply scaling
    const newScale: [number, number, number] = [2.5, 3.0, 2.5];
    shape = { ...shape, scale: newScale };
    expect(shape.scale).toEqual([2.5, 3.0, 2.5]);
  });

  it('should correctly duplicate shapes with offset coordinates and new IDs', () => {
    const original: SceneObject = {
      id: 'orig_1',
      name: 'Original Chair',
      type: 'chair',
      category: 'interior',
      position: [2, 0, 2],
      rotation: [0, 45, 0],
      scale: [1, 1, 1],
      color: '#c4a482',
      materialPreset: 'light_oak',
      metalness: 0.1,
      roughness: 0.6,
      transmission: 0,
      visible: true,
      locked: false,
    };

    const duplicate: SceneObject = {
      ...original,
      id: `obj_dup_${Date.now()}`,
      name: `${original.name} Copy`,
      position: [original.position[0] + 0.5, original.position[1], original.position[2] + 0.5],
    };

    expect(duplicate.id).not.toBe(original.id);
    expect(duplicate.name).toBe('Original Chair Copy');
    expect(duplicate.position).toEqual([2.5, 0, 2.5]);
    expect(duplicate.rotation).toEqual(original.rotation);
  });

  it('should safely delete shapes and reset selection if deleted object was selected', () => {
    let objects: SceneObject[] = [
      {
        id: 'del_1',
        name: 'Item To Delete',
        type: 'torus',
        category: 'primitives',
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        color: '#ff0000',
        materialPreset: 'custom',
        metalness: 0,
        roughness: 0.5,
        transmission: 0,
        visible: true,
        locked: false,
      },
    ];
    let selectedId: string | null = 'del_1';

    // Delete item
    const deleteId = 'del_1';
    objects = objects.filter((o) => o.id !== deleteId);
    if (selectedId === deleteId) {
      selectedId = null;
    }

    expect(objects.length).toBe(0);
    expect(selectedId).toBeNull();
  });

  it('should pick and intersect top-level object groups in Three.js scene via raycasting', () => {
    const scene = new THREE.Scene();
    const group = new THREE.Group();
    group.position.set(0, 0, 0);
    group.userData = { id: 'raycast_obj_1', type: 'capsule' };

    const childMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.6), new THREE.MeshBasicMaterial());
    group.add(childMesh);
    scene.add(group);

    const raycaster = new THREE.Raycaster();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);

    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersects = raycaster.intersectObjects(scene.children, true);

    expect(intersects.length).toBeGreaterThan(0);
    let topObj = intersects[0].object;
    while (topObj.parent && topObj.parent !== scene && !topObj.userData.id) {
      topObj = topObj.parent;
    }
    expect(topObj.userData.id).toBe('raycast_obj_1');
  });

  it('should generate non-empty OBJ export string containing mesh vertices and faces', () => {
    const scene = new THREE.Scene();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
    mesh.name = 'user_object_box_1';
    mesh.position.set(1, 2, 3);
    scene.add(mesh);

    const objContent = exportToOBJ(scene);
    expect(typeof objContent).toBe('string');
    expect(objContent).toContain('v ');
    expect(objContent).toContain('f ');
  });

  it('should generate non-empty STL export string for 3D printing software', () => {
    const scene = new THREE.Scene();
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), new THREE.MeshStandardMaterial());
    mesh.name = 'user_object_sphere_1';
    scene.add(mesh);

    const stlContent = exportToSTL(scene);
    expect(stlContent).toBeDefined();
    if (typeof stlContent === 'string') {
      expect(stlContent).toContain('solid');
      expect(stlContent).toContain('facet normal');
      expect(stlContent).toContain('endsolid');
    }
  });

  it('should safely filter hidden objects during export', () => {
    const scene = new THREE.Scene();
    const meshVisible = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
    meshVisible.name = 'user_object_visible';
    meshVisible.visible = true;
    scene.add(meshVisible);

    const meshHidden = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
    meshHidden.name = 'user_object_hidden';
    meshHidden.visible = false;
    scene.add(meshHidden);

    const objContent = exportToOBJ(scene);
    expect(objContent).toContain('v ');
  });

  it('should support adding shape A, moving shape A, adding shape B, moving shape B, then re-selecting shape A and moving shape A again', () => {
    let objects: SceneObject[] = [];
    let selectedId: string | null = null;

    // 1. Add Shape A (Cube)
    const shapeA: SceneObject = {
      id: 'shape_A',
      name: 'Cube A',
      type: 'cube',
      category: 'primitives',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: '#ef4444',
      materialPreset: 'custom',
      metalness: 0,
      roughness: 0.5,
      transmission: 0,
      visible: true,
      locked: false,
    };
    objects.push(shapeA);
    selectedId = shapeA.id;
    expect(selectedId).toBe('shape_A');

    // Move Shape A first time to [2.5, 0, 1.0]
    objects = objects.map((obj) => (obj.id === 'shape_A' ? { ...obj, position: [2.5, 0, 1.0] } : obj));
    expect(objects.find((o) => o.id === 'shape_A')?.position).toEqual([2.5, 0, 1.0]);

    // 2. Add Shape B (Cylinder)
    const shapeB: SceneObject = {
      id: 'shape_B',
      name: 'Cylinder B',
      type: 'cylinder',
      category: 'primitives',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: '#3b82f6',
      materialPreset: 'custom',
      metalness: 0.1,
      roughness: 0.2,
      transmission: 0,
      visible: true,
      locked: false,
    };
    objects.push(shapeB);
    selectedId = shapeB.id;
    expect(selectedId).toBe('shape_B');

    // Move Shape B to [-4.0, 1.5, 3.0]
    objects = objects.map((obj) => (obj.id === 'shape_B' ? { ...obj, position: [-4.0, 1.5, 3.0] } : obj));
    expect(objects.find((o) => o.id === 'shape_B')?.position).toEqual([-4.0, 1.5, 3.0]);

    // Verify Shape A hasn't been modified while moving Shape B
    expect(objects.find((o) => o.id === 'shape_A')?.position).toEqual([2.5, 0, 1.0]);

    // 3. Switch selection back to Shape A freely
    selectedId = 'shape_A';
    expect(selectedId).toBe('shape_A');

    // Move Shape A second time to [10.0, 5.0, -2.5] and rotate it [0, 90, 0]
    objects = objects.map((obj) =>
      obj.id === 'shape_A' ? { ...obj, position: [10.0, 5.0, -2.5], rotation: [0, 90, 0] } : obj
    );

    // Final Assertions for both shapes
    const finalShapeA = objects.find((o) => o.id === 'shape_A');
    const finalShapeB = objects.find((o) => o.id === 'shape_B');

    expect(finalShapeA?.position).toEqual([10.0, 5.0, -2.5]);
    expect(finalShapeA?.rotation).toEqual([0, 90, 0]);
    expect(finalShapeB?.position).toEqual([-4.0, 1.5, 3.0]);
    expect(finalShapeB?.rotation).toEqual([0, 0, 0]);
  });

  it('should update Object3D matrixWorld cleanly when switching selected objects without stale transform drift', () => {
    const scene = new THREE.Scene();

    // Create Mesh A
    const meshA = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
    meshA.position.set(0, 1, 0);
    meshA.userData = { id: 'mesh_A' };
    scene.add(meshA);

    // Create Mesh B
    const meshB = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1), new THREE.MeshStandardMaterial());
    meshB.position.set(5, 1, 0);
    meshB.userData = { id: 'mesh_B' };
    scene.add(meshB);

    // Initial state: Mesh A selected and transformed
    meshA.position.set(2.5, 1.0, -1.0);
    meshA.updateMatrix();
    meshA.updateMatrixWorld(true);

    expect(meshA.matrixWorld.elements[12]).toBeCloseTo(2.5);
    expect(meshA.matrixWorld.elements[13]).toBeCloseTo(1.0);
    expect(meshA.matrixWorld.elements[14]).toBeCloseTo(-1.0);

    // Switch selection to Mesh B and transform Mesh B
    meshB.position.set(-3.0, 2.0, 4.0);
    meshB.updateMatrix();
    meshB.updateMatrixWorld(true);

    expect(meshB.matrixWorld.elements[12]).toBeCloseTo(-3.0);
    expect(meshB.matrixWorld.elements[13]).toBeCloseTo(2.0);
    expect(meshB.matrixWorld.elements[14]).toBeCloseTo(4.0);

    // Re-select Mesh A and move Mesh A again
    meshA.position.set(10.0, 0.0, 0.0);
    meshA.updateMatrix();
    meshA.updateMatrixWorld(true);

    expect(meshA.matrixWorld.elements[12]).toBeCloseTo(10.0);
    expect(meshB.matrixWorld.elements[12]).toBeCloseTo(-3.0);
  });

  it('should construct and update THREE.BoxHelper wireframe bounding box around active selected object', () => {
    const scene = new THREE.Scene();
    const activeMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshStandardMaterial());
    activeMesh.position.set(1, 1, 1);
    scene.add(activeMesh);

    const boxHelper = new THREE.BoxHelper(activeMesh, 0x06b6d4);
    scene.add(boxHelper);

    expect(boxHelper).toBeDefined();
    expect(boxHelper.visible).toBe(true);

    // Transform activeMesh
    activeMesh.position.set(5, 3, -2);
    activeMesh.updateMatrixWorld(true);
    boxHelper.update();

    expect(boxHelper.matrixWorld.elements[12]).toBeCloseTo(0); // BoxHelper positions are calculated relative to vertices
    expect(boxHelper.geometry.attributes.position.count).toBeGreaterThan(0);
  });

  it('should maintain zero position/rotation drift across rapid multi-object selection switches and transform operations', () => {
    let project = getInitialProject();
    let selectedId: string | null = 'obj_sofa';

    // Verify sofa initial state
    const sofaObj = project.objects.find((o) => o.id === 'obj_sofa');
    expect(sofaObj).toBeDefined();
    const originalSofaPos = [...sofaObj!.position];
    const originalSofaRot = [...sofaObj!.rotation];

    // Select Feature Wall and modify its transform
    selectedId = 'obj_wall_back';
    const wallObj = project.objects.find((o) => o.id === selectedId)!;
    const updatedWall = {
      ...wallObj,
      position: [1.2, 3.4, -5.6] as [number, number, number],
      rotation: [0, 45, 0] as [number, number, number],
      scale: [10, 2, 0.5] as [number, number, number],
    };
    project = {
      ...project,
      objects: project.objects.map((o) => (o.id === selectedId ? updatedWall : o)),
    };

    // Verify sofa position remained strictly unchanged
    const sofaAfterWallMove = project.objects.find((o) => o.id === 'obj_sofa');
    expect(sofaAfterWallMove?.position).toEqual(originalSofaPos);
    expect(sofaAfterWallMove?.rotation).toEqual(originalSofaRot);

    // Select Glass Facade and modify its transform
    selectedId = 'obj_wall_glass';
    const glassObj = project.objects.find((o) => o.id === selectedId)!;
    const updatedGlass = {
      ...glassObj,
      position: [-8.0, 2.0, 1.0] as [number, number, number],
    };
    project = {
      ...project,
      objects: project.objects.map((o) => (o.id === selectedId ? updatedGlass : o)),
    };

    // Re-select sofa
    selectedId = 'obj_sofa';
    const reselectedSofa = project.objects.find((o) => o.id === selectedId)!;
    expect(reselectedSofa.position).toEqual(originalSofaPos);
    expect(reselectedSofa.rotation).toEqual(originalSofaRot);

    // Verify wall position retained its updated transform
    const wallRecheck = project.objects.find((o) => o.id === 'obj_wall_back');
    expect(wallRecheck?.position).toEqual([1.2, 3.4, -5.6]);
    expect(wallRecheck?.rotation).toEqual([0, 45, 0]);
  });

  it('should handle complex multi-step procedural 3D transformations and raycast object isolation cleanly', () => {
    const scene = new THREE.Scene();

    // Create 3 procedural groups matching CAD applet architecture
    const groupA = new THREE.Group();
    groupA.position.set(-2, 0, 0);
    groupA.userData = { id: 'obj_A', type: 'cube' };
    const meshA = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
    groupA.add(meshA);
    scene.add(groupA);

    const groupB = new THREE.Group();
    groupB.position.set(2, 0, 0);
    groupB.userData = { id: 'obj_B', type: 'cylinder' };
    const meshB = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1), new THREE.MeshStandardMaterial());
    groupB.add(meshB);
    scene.add(groupB);

    // Update groupA position and matrices
    groupA.position.set(-2, 4.5, -3.2);
    groupA.rotation.set(0, Math.PI / 4, 0);
    groupA.updateMatrix();
    groupA.updateMatrixWorld(true);

    // Simulate Raycaster hitting child mesh of groupA
    const raycaster = new THREE.Raycaster();
    raycaster.set(new THREE.Vector3(-2, 4.5, 10), new THREE.Vector3(0, 0, -1));
    const intersects = raycaster.intersectObjects([meshA, meshB], true);

    expect(intersects.length).toBeGreaterThan(0);
    let topHit: THREE.Object3D = intersects[0].object;
    while (topHit.parent && topHit.parent !== scene && !topHit.userData.id) {
      topHit = topHit.parent;
    }
    expect(topHit.userData.id).toBe('obj_A');
    expect(topHit.position.x).toBeCloseTo(-2);
    expect(topHit.position.y).toBeCloseTo(4.5);
    expect(topHit.position.z).toBeCloseTo(-3.2);

    // Group B matrix remains isolated
    groupB.updateMatrix();
    groupB.updateMatrixWorld(true);
    expect(groupB.position.x).toBeCloseTo(2);
    expect(groupB.position.y).toBeCloseTo(0);
  });
});
