import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION, computeMeshVolume } from 'three-bvh-csg';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { SceneObject } from '../types';
import { createParametricExtrusionGeometry } from './parametricExtrusion';

export const BOOLEAN_TYPES = new Set(['cube','sphere','cylinder','cone','torus','capsule','parametric-extrusion']);
export const BOOLEAN_SCALE_MIN = 0.001;
export const BOOLEAN_SCALE_MAX = 1000;
export const BOOLEAN_TRIANGLE_LIMIT = 75_000;
const geometryCache = new Map<string, THREE.BufferGeometry>();
const BOOLEAN_CACHE_LIMIT = 20;

/** Eligibility for starting a new operation. Applied operands deliberately fail this check. */
export function isBooleanEligible(object: SceneObject | undefined): boolean {
  return Boolean(object && BOOLEAN_TYPES.has(object.type) && object.visible && !object.locked && !object.boolean && !object.holeForId && transformIssue(object) === null);
}

/** Eligibility for evaluating a valid persisted pair (including its hidden cutter). */
export function isBooleanOperand(object: SceneObject | undefined): object is SceneObject {
  return Boolean(object && BOOLEAN_TYPES.has(object.type) && !object.locked && transformIssue(object) === null);
}

export function transformIssue(object: SceneObject): string | null {
  if (![...object.position,...object.rotation,...object.scale].every(Number.isFinite)) return `${object.name} has a non-finite transform.`;
  if (object.scale.some(value => value < BOOLEAN_SCALE_MIN || value > BOOLEAN_SCALE_MAX)) return `${object.name} scale must be between ${BOOLEAN_SCALE_MIN} and ${BOOLEAN_SCALE_MAX}.`;
  const determinant=objectMatrix(object).determinant();
  return Number.isFinite(determinant) && Math.abs(determinant)>1e-12 ? null : `${object.name} transform is not invertible.`;
}

export function objectMatrix(object: SceneObject): THREE.Matrix4 {
  return new THREE.Matrix4().compose(new THREE.Vector3(...object.position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...object.rotation.map(THREE.MathUtils.degToRad) as [number,number,number])),new THREE.Vector3(...object.scale));
}

export function baseBooleanGeometry(object: SceneObject): THREE.BufferGeometry {
  switch(object.type){
    case 'cube': return new THREE.BoxGeometry(1,1,1);
    case 'sphere': return new THREE.SphereGeometry(.5,24,16);
    case 'cylinder': return new THREE.CylinderGeometry(.5,.5,1,24);
    case 'cone': return new THREE.ConeGeometry(.5,1,24);
    case 'torus': return new THREE.TorusGeometry(.5,.18,16,32);
    case 'capsule': return new THREE.CapsuleGeometry(.35,.6,8,16);
    case 'parametric-extrusion': if(object.geometry)return createParametricExtrusionGeometry(object.geometry);break;
  }
  throw new Error(`${object.name} is not an eligible solid.`);
}

const triangles=(geometry:THREE.BufferGeometry)=>(geometry.index?.count??geometry.getAttribute('position')?.count??0)/3;
export const booleanGeometryKey=(target:SceneObject,cutter:SceneObject)=>JSON.stringify([target.type,target.position,target.rotation,target.scale,target.geometry,cutter.type,cutter.position,cutter.rotation,cutter.scale,cutter.geometry]);

export function clearBooleanGeometryCache():void {
  geometryCache.forEach(geometry => geometry.dispose());
  geometryCache.clear();
}

export function hasOppositeDirectedEdgePairs(geometry:THREE.BufferGeometry):boolean {
  const position=geometry.getAttribute('position');if(!position||position.count%3!==0)return false;
  const vertex=new THREE.Vector3(),key=(index:number)=>{vertex.fromBufferAttribute(position,index);return `${Math.round(vertex.x*1e6)},${Math.round(vertex.y*1e6)},${Math.round(vertex.z*1e6)}`;};
  const balances=new Map<string,number[]>();
  const add=(from:number,to:number)=>{const a=key(from),b=key(to),forward=a<b,mapKey=forward?`${a}|${b}`:`${b}|${a}`,list=balances.get(mapKey)??[];list.push(forward?1:-1);balances.set(mapKey,list);};
  for(let index=0;index<position.count;index+=3){add(index,index+1);add(index+1,index+2);add(index+2,index);}
  return [...balances.values()].every(directions=>directions.length===2&&directions[0]!==directions[1]);
}

function overlapIssue(target:SceneObject,cutter:SceneObject):string|null{
  const tg=baseBooleanGeometry(target),cg=baseBooleanGeometry(cutter);
  try{
    if(triangles(tg)+triangles(cg)>BOOLEAN_TRIANGLE_LIMIT)return 'These solids are too complex for an interactive Boolean operation.';
    const ta=new THREE.Box3().setFromBufferAttribute(tg.getAttribute('position') as THREE.BufferAttribute).applyMatrix4(objectMatrix(target));
    const ca=new THREE.Box3().setFromBufferAttribute(cg.getAttribute('position') as THREE.BufferAttribute).applyMatrix4(objectMatrix(cutter));
    const overlap=new THREE.Vector3(Math.min(ta.max.x,ca.max.x)-Math.max(ta.min.x,ca.min.x),Math.min(ta.max.y,ca.max.y)-Math.max(ta.min.y,ca.min.y),Math.min(ta.max.z,ca.max.z)-Math.max(ta.min.z,ca.min.z));
    if(overlap.x<=1e-6||overlap.y<=1e-6||overlap.z<=1e-6)return 'The cutter must overlap the target volume; touching or separated solids cannot make a hole.';
    if(ca.containsBox(ta))return 'The cutter fully contains the target and would remove it completely.';
    return null;
  }finally{tg.dispose();cg.dispose();}
}

export function getBooleanIssue(objects:SceneObject[],targetId:string|null,cutterId:string|null):string|null{
  if(!targetId||!cutterId||targetId===cutterId)return 'Select exactly two different solids. The primary selection is the target.';
  const target=objects.find(o=>o.id===targetId),cutter=objects.find(o=>o.id===cutterId);
  if(!target||!cutter)return 'The target or cutter is missing.';
  if(!isBooleanEligible(target))return `${target.name} must be a visible, unlocked, supported solid with a positive finite scale.`;
  if(!isBooleanEligible(cutter))return `${cutter.name} must be a visible, unlocked, supported solid with a positive finite scale.`;
  return overlapIssue(target,cutter);
}

export function validateBooleanResultGeometry(geometry:THREE.BufferGeometry,sourceVolume:number):void{
  const position=geometry.getAttribute('position'),normal=geometry.getAttribute('normal');
  if(!position||position.count<3||position.count%3!==0||!normal)throw new Error('Subtraction did not produce a valid printable solid.');
  if(!Array.from(position.array).every(Number.isFinite)||!Array.from(normal.array).every(Number.isFinite))throw new Error('Subtraction produced invalid geometry values.');
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),edge1=new THREE.Vector3(),edge2=new THREE.Vector3();
  const edges=new Map<string,{directions:number[];a:THREE.Vector3;b:THREE.Vector3}>();
  const vertexKey=(v:THREE.Vector3)=>`${Math.round(v.x*1e6)},${Math.round(v.y*1e6)},${Math.round(v.z*1e6)}`;
  const addEdge=(v1:THREE.Vector3,v2:THREE.Vector3)=>{const x=vertexKey(v1),y=vertexKey(v2),forward=x<y,key=forward?`${x}|${y}`:`${y}|${x}`,found=edges.get(key);if(found)found.directions.push(forward?1:-1);else edges.set(key,{directions:[forward?1:-1],a:(forward?v1:v2).clone(),b:(forward?v2:v1).clone()});};
  for(let i=0;i<position.count;i+=3){a.fromBufferAttribute(position,i);b.fromBufferAttribute(position,i+1);c.fromBufferAttribute(position,i+2);if(edge1.subVectors(b,a).cross(edge2.subVectors(c,a)).lengthSq()<1e-18)throw new Error('Subtraction produced degenerate triangles.');addEdge(a,b);addEdge(b,c);addEdge(c,a);}
  const invalid=[...edges.values()].filter(edge=>edge.directions.length!==2);
  // CSG triangulation may express one geometric edge as several collinear
  // segments. Split-equivalent boundary coverage is still a paired manifold.
  if(invalid.length>5000)throw new Error('Subtraction topology is too complex to validate safely.');
  const covered=(edge:typeof invalid[number])=>{
    if(edge.directions.length!==1)return false;
    const direction=new THREE.Vector3().subVectors(edge.b,edge.a),length=direction.length();direction.divideScalar(length);
    const intervals:[number,number][]=[];
    for(const other of invalid){if(other===edge||other.directions.length!==1)continue;const oa=new THREE.Vector3().subVectors(other.a,edge.a),ob=new THREE.Vector3().subVectors(other.b,edge.a);if(new THREE.Vector3().crossVectors(direction,oa).length()>1e-5||new THREE.Vector3().crossVectors(direction,ob).length()>1e-5)continue;const start=Math.max(0,Math.min(oa.dot(direction),ob.dot(direction))),end=Math.min(length,Math.max(oa.dot(direction),ob.dot(direction)));if(end-start>1e-6)intervals.push([start,end]);}
    intervals.sort((x,y)=>x[0]-y[0]);let end=0;for(const interval of intervals){if(interval[0]>end+1e-5)return false;end=Math.max(end,interval[1]);if(end>=length-1e-5)return true;}return false;
  };
  if(invalid.some(edge=>!covered(edge)))throw new Error('Subtraction did not produce a closed manifold solid.');
  const volume=computeMeshVolume(geometry),epsilon=Math.max(1e-6,sourceVolume*1e-6);
  if(!Number.isFinite(volume)||volume<=epsilon)throw new Error('Subtraction did not produce a positive printable volume.');
  if(sourceVolume-volume<=epsilon)throw new Error('The cutter does not remove a meaningful volume from the target.');
  if(volume>=sourceVolume)throw new Error('Subtraction produced incorrect face winding or volume.');
}

export function createSubtractedGeometry(target:SceneObject,cutter:SceneObject):THREE.BufferGeometry{
  if(!isBooleanOperand(target)||!isBooleanOperand(cutter))throw new Error('Boolean operands must be supported, unlocked solids with positive finite scales.');
  const applied=target.visible&&!cutter.visible&&target.boolean?.cutterId===cutter.id&&cutter.holeForId===target.id;
  const issue=applied?overlapIssue(target,cutter):getBooleanIssue([target,cutter],target.id,cutter.id);if(issue)throw new Error(issue);
  const key=booleanGeometryKey(target,cutter),cached=geometryCache.get(key);if(cached)return cached.clone();
  const targetGeometry=baseBooleanGeometry(target),cutterGeometry=baseBooleanGeometry(cutter),sourceVolume=computeMeshVolume(targetGeometry);
  const a=new Brush(targetGeometry),b=new Brush(cutterGeometry);
  try{
    a.updateMatrixWorld(true);b.matrix.copy(objectMatrix(target).invert().multiply(objectMatrix(cutter)));b.matrix.decompose(b.position,b.quaternion,b.scale);b.updateMatrix();b.updateMatrixWorld(true);
    const evaluator=new Evaluator();
    const result=evaluator.evaluate(a,b,SUBTRACTION);
    try{const raw=result.geometry.toNonIndexed();raw.deleteAttribute('normal');raw.deleteAttribute('uv');const welded=mergeVertices(raw,1e-6);const geometry=welded.toNonIndexed();raw.dispose();welded.dispose();geometry.computeVertexNormals();validateBooleanResultGeometry(geometry,sourceVolume);geometry.computeBoundingBox();geometry.computeBoundingSphere();geometryCache.set(key,geometry.clone());if(geometryCache.size>BOOLEAN_CACHE_LIMIT){const first=geometryCache.keys().next().value;if(first){geometryCache.get(first)?.dispose();geometryCache.delete(first);}}return geometry;}
    finally{result.geometry.dispose();result.disposeCacheData();}
  }finally{a.geometry.dispose();b.geometry.dispose();a.disposeCacheData();b.disposeCacheData();}
}

export function applyBooleanSubtraction(objects:SceneObject[],targetId:string,cutterId:string):SceneObject[]{const issue=getBooleanIssue(objects,targetId,cutterId);if(issue)throw new Error(issue);const target=objects.find(o=>o.id===targetId)!,cutter=objects.find(o=>o.id===cutterId)!;createSubtractedGeometry(target,cutter).dispose();return objects.map(object=>object.id===targetId?{...object,boolean:{kind:'subtract',cutterId}}:object.id===cutterId?{...object,holeForId:targetId,visible:false}:object);}
export function removeBooleanSubtraction(objects:SceneObject[],targetId:string):SceneObject[]{const target=objects.find(o=>o.id===targetId);if(!target?.boolean)return objects;return objects.map(object=>object.id===targetId?{...object,boolean:undefined}:object.id===target.boolean!.cutterId?{...object,holeForId:undefined,visible:true}:object);}
export function hasBooleanDependency(objects:SceneObject[],id:string):boolean{const object=objects.find(item=>item.id===id);return Boolean(object?.boolean||object?.holeForId||objects.some(item=>item.boolean?.cutterId===id));}

export function validateAppliedBooleanPairs(objects:SceneObject[]):string|null {
  for(const target of objects){
    if(!target.boolean)continue;
    const cutter=objects.find(object=>object.id===target.boolean!.cutterId);
    if(!cutter)return `The Boolean cutter for ${target.name} is missing.`;
    try{const geometry=createSubtractedGeometry(target,cutter);geometry.dispose();}
    catch(error){return error instanceof Error?error.message:'The Boolean operation could not be evaluated.';}
  }
  return null;
}

export function updateTransformWithBooleanGuard(objects:SceneObject[],id:string,position:[number,number,number],rotation:[number,number,number],scale:[number,number,number]):{objects:SceneObject[];error:null}|{objects:null;error:string}{
  const target=objects.find(object=>object.id===id);
  if(!target)return {objects:null,error:'The transformed object no longer exists.'};
  const updated=objects.map(object=>object.id===id?{...object,position,rotation,scale}:object);
  const error=validateAppliedBooleanPairs(updated);
  return error?{objects:null,error:`Transform not applied: ${error}`}:{objects:updated,error:null};
}
