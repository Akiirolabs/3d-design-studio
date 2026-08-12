import { describe, expect, it } from 'vitest';
import { computeMeshVolume } from 'three-bvh-csg';
import * as THREE from 'three';
import type { SceneObject } from '../types';
import { applyBooleanSubtraction, baseBooleanGeometry, booleanGeometryKey, clearBooleanGeometryCache, createSubtractedGeometry, getBooleanIssue, hasBooleanDependency, hasOppositeDirectedEdgePairs, removeBooleanSubtraction, updateTransformWithBooleanGuard } from '../utils/booleanGeometry';
import { validateSceneObjects } from '../utils/projectValidation';
import { exportToOBJ, exportToSTL } from '../utils/exporters';

const solid=(id:string, type='cube', position:[number,number,number]=[0,0,0], scale:[number,number,number]=[1,1,1]):SceneObject=>({id,name:id,type,category:'primitives',position,rotation:[0,0,0],scale,color:'#fff',materialPreset:'default',metalness:0,roughness:.5,transmission:0,visible:true,locked:false});

describe('non-destructive Boolean holes',()=>{
  it('subtracts an overlapping transformed cutter into finite lower-volume geometry',()=>{
    const target=solid('target','cube',[0,0,0],[2,2,2]);
    const cutter={...solid('cutter','cylinder',[0,0,0],[.6,3,.6]),rotation:[0,0,35] as [number,number,number]};
    const source=baseBooleanGeometry(target); const sourceVolume=computeMeshVolume(source); source.dispose();
    const result=createSubtractedGeometry(target,cutter);
    expect(computeMeshVolume(result)).toBeGreaterThan(0);
    expect(computeMeshVolume(result)).toBeLessThan(sourceVolume*8);
    expect(Array.from(result.getAttribute('position').array)).toSatisfy(values=>values.every(Number.isFinite));
    result.dispose();
  });

  it('rejects separation, tangency, containment, locked operands, and order mistakes without mutation',()=>{
    const target=solid('target');
    expect(getBooleanIssue([target,solid('far','cube',[3,0,0])],'target','far')).toMatch(/overlap/);
    expect(getBooleanIssue([target,solid('touch','cube',[1,0,0])],'target','touch')).toMatch(/touching/);
    expect(getBooleanIssue([target,solid('outer','cube',[0,0,0],[3,3,3])],'target','outer')).toMatch(/contains/);
    expect(getBooleanIssue([target,{...solid('locked'),locked:true}],'target','locked')).toMatch(/unlocked/);
    const original=[target,solid('far','cube',[3,0,0])];
    expect(()=>applyBooleanSubtraction(original,'target','far')).toThrow(); expect(original).toEqual([target,solid('far','cube',[3,0,0])]);
  });

  it('persists a recoverable cutter and restores it on removal',()=>{
    const input=[solid('target','cube',[0,0,0],[2,2,2]),solid('cutter','cylinder',[0,0,0],[.5,3,.5])];
    const applied=applyBooleanSubtraction(input,'target','cutter');
    expect(applied.find(o=>o.id==='target')?.boolean).toEqual({kind:'subtract',cutterId:'cutter'});
    expect(applied.find(o=>o.id==='cutter')).toMatchObject({visible:false,holeForId:'target'});
    expect(validateSceneObjects(JSON.parse(JSON.stringify(applied))).success).toBe(true);
    const evaluated=createSubtractedGeometry(applied[0],applied[1]);
    expect(evaluated.getAttribute('position').count).toBeGreaterThan(0); evaluated.dispose();
    expect(hasBooleanDependency(applied,'target')).toBe(true);
    expect(hasBooleanDependency(applied,'cutter')).toBe(true);
    expect(removeBooleanSubtraction(applied,'target')).toEqual(input);
  });

  it('rejects missing, self-referencing, and inconsistent persisted graphs',()=>{
    expect(validateSceneObjects([{...solid('target'),boolean:{kind:'subtract',cutterId:'missing'}}]).success).toBe(false);
    expect(validateSceneObjects([{...solid('target'),boolean:{kind:'subtract',cutterId:'target'},holeForId:'target'}]).success).toBe(false);
    expect(validateSceneObjects([{...solid('target'),boolean:{kind:'subtract',cutterId:'cutter'}},solid('cutter')]).success).toBe(false);
  });

  it('rejects malicious roles, visibility, unsupported solids, and unsafe transforms',()=>{
    const target={...solid('target'),boolean:{kind:'subtract' as const,cutterId:'cutter'}};
    const cutter={...solid('cutter'),holeForId:'target',visible:false};
    expect(validateSceneObjects([{...target,holeForId:'cutter'},cutter]).success).toBe(false);
    expect(validateSceneObjects([{...target,visible:false},cutter]).success).toBe(false);
    expect(validateSceneObjects([target,{...cutter,visible:true}]).success).toBe(false);
    expect(validateSceneObjects([{...target,type:'chair',category:'interior'},cutter]).success).toBe(false);
    expect(validateSceneObjects([target,{...cutter,scale:[0,1,1]}]).success).toBe(false);
    expect(getBooleanIssue([solid('a'),{...solid('b'),scale:[-1,1,1]}],'a','b')).toMatch(/positive finite scale/);
    expect(getBooleanIssue([solid('a'),{...solid('b'),scale:[1001,1,1]}],'a','b')).toMatch(/positive finite scale/);
  });

  it('caches a successful default subtraction and completes promptly',()=>{
    const target=solid('target','cube',[0,0,0],[2,2,2]);
    const cutter=solid('cutter','cylinder',[0,0,0],[.5,3,.5]);
    const started=performance.now();
    const first=createSubtractedGeometry(target,cutter); const second=createSubtractedGeometry(target,cutter);
    expect(performance.now()-started).toBeLessThan(1000);
    expect(second.getAttribute('position').count).toBe(first.getAttribute('position').count);
    first.dispose();second.dispose();
  });

  it('returns independent cache clones and invalidates keys for either committed operand transform',()=>{
    clearBooleanGeometryCache();
    const target=solid('target','cube',[0,0,0],[2,2,2]);
    const cutter=solid('cutter','cylinder',[0,0,0],[.5,3,.5]);
    const first=createSubtractedGeometry(target,cutter),second=createSubtractedGeometry(target,cutter);
    const original=Number(second.getAttribute('position').getX(0));
    first.getAttribute('position').setX(0,original+99);
    expect(second.getAttribute('position').getX(0)).toBe(original);
    expect(booleanGeometryKey({...target,position:[.2,0,0]},cutter)).not.toBe(booleanGeometryKey(target,cutter));
    expect(booleanGeometryKey(target,{...cutter,rotation:[0,15,0]})).not.toBe(booleanGeometryKey(target,cutter));
    first.dispose();second.dispose();clearBooleanGeometryCache();
  });

  it('atomically rejects an invalid committed transform and permits undo/redo-safe valid commits',()=>{
    const initial=applyBooleanSubtraction([solid('target','cube',[0,0,0],[2,2,2]),solid('cutter','cylinder',[0,0,0],[.5,3,.5])],'target','cutter');
    const rejected=updateTransformWithBooleanGuard(initial,'target',[20,0,0],[0,0,0],[2,2,2]);
    expect(rejected.objects).toBeNull();expect(rejected.error).toMatch(/not applied.*overlap/i);expect(initial[0].position).toEqual([0,0,0]);
    const accepted=updateTransformWithBooleanGuard(initial,'target',[0,0,0],[0,0,0],[2.2,2,2]);
    expect(accepted.error).toBeNull();expect(accepted.objects?.[0].scale).toEqual([2.2,2,2]);
    const history=[initial,accepted.objects!];
    expect(history[0][0].scale).toEqual([2,2,2]);expect(history[1][0].scale).toEqual([2.2,2,2]);
    expect(validateSceneObjects(JSON.parse(JSON.stringify(history[0]))).success).toBe(true);
    expect(validateSceneObjects(JSON.parse(JSON.stringify(history[1]))).success).toBe(true);
  });

  it('rejects semantically invalid persisted Boolean pairs before state acceptance',()=>{
    const applied=applyBooleanSubtraction([solid('target','cube',[0,0,0],[2,2,2]),solid('cutter','cylinder',[0,0,0],[.5,3,.5])],'target','cutter');
    const separated=applied.map(object=>object.id==='cutter'?{...object,position:[20,0,0] as [number,number,number]}:object);
    const result=validateSceneObjects(separated);
    expect(result.success).toBe(false);if('error' in result)expect(result.error).toMatch(/cannot be evaluated.*overlap/i);
  });

  it('rejects a closed-looking mesh whose shared edge directions reveal inconsistent winding',()=>{
    const geometry=new THREE.BoxGeometry(1,1,1).toNonIndexed();
    const values=geometry.getAttribute('position').array as Float32Array;
    for(let component=0;component<3;component++){const a=values[component];values[component]=values[3+component];values[3+component]=a;}
    geometry.computeVertexNormals();
    expect(hasOppositeDirectedEdgePairs(geometry)).toBe(false);
    geometry.dispose();
  });

  it('exports evaluated Boolean geometry as finite nonempty OBJ and STL',()=>{
    const geometry=createSubtractedGeometry(solid('target','cube',[0,0,0],[2,2,2]),solid('cutter','cylinder',[0,0,0],[.5,3,.5]));
    const scene=new THREE.Scene(),mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());mesh.name='user_object_target';scene.add(mesh);
    const obj=exportToOBJ(scene),stl=exportToSTL(scene);
    expect(obj).toContain('\nv ');expect(obj).not.toMatch(/NaN|Infinity/);
    expect(typeof stl).toBe('string');expect(String(stl)).toContain('solid exported');expect(String(stl)).not.toMatch(/NaN|Infinity/);
    geometry.dispose();(mesh.material as THREE.Material).dispose();
  });
});
