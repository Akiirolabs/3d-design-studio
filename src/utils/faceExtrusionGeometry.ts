import * as THREE from 'three';
import {computeMeshVolume} from 'three-bvh-csg';
import type {FrozenPlanarFace} from './faceTopology';
import {extractPlanarFace,FACE_TRIANGLE_LIMIT,geometryFingerprint} from './faceTopology';
import {minimumTwistSteps} from './parametricExtrusion';

export interface FaceExtrusionParameters{distance:number;baseScale:number;topScale:number;twistAngle:number;twistSteps:number;twistMode:'steps'|'smooth'}
const cache=new Map<string,THREE.BufferGeometry>(),CACHE_LIMIT=12;

export function validateFaceExtrusionParameters(p:FaceExtrusionParameters):string|null{
  if(!Number.isFinite(p.distance)||p.distance<=0||p.distance>1000)return 'Extrusion distance must be greater than 0 and no more than 1000.';
  if(p.baseScale!==1)return 'Base scale is fixed at 1 for attached face extrusion.';
  if(!Number.isFinite(p.topScale)||p.topScale<.1||p.topScale>5)return 'Top scale must be between 0.1 and 5.';
  if(!Number.isFinite(p.twistAngle)||p.twistAngle< -360||p.twistAngle>360)return 'Twist must be between -360 and 360 degrees.';
  if(!Number.isInteger(p.twistSteps)||p.twistSteps<1||p.twistSteps>128||p.twistSteps<minimumTwistSteps(p.twistAngle))return `Twist steps must be ${minimumTwistSteps(p.twistAngle)}-128 for this twist.`;
  if(p.twistMode!=='steps'&&p.twistMode!=='smooth')return 'Twist mode must be Steps or Smooth.';
  return null;
}
export function clearFaceExtrusionCache(){cache.forEach(g=>g.dispose());cache.clear();}
export function hasConformingEdgeIncidence(geometry:THREE.BufferGeometry):boolean{const position=geometry.getAttribute('position');if(!position||position.count%3)return false;const point=new THREE.Vector3(),key=(i:number)=>{point.fromBufferAttribute(position,i);return `${Math.round(point.x*1e7)},${Math.round(point.y*1e7)},${Math.round(point.z*1e7)}`;},edges=new Map<string,number[]>();for(let i=0;i<position.count;i+=3)for(const [a,b] of [[i,i+1],[i+1,i+2],[i+2,i]]){const x=key(a),y=key(b),forward=x<y,k=forward?`${x}|${y}`:`${y}|${x}`,values=edges.get(k)??[];values.push(forward?1:-1);edges.set(k,values);}return [...edges.values()].every(values=>values.length===2&&values[0]!==values[1]);}

export function createPositiveFaceExtrusion(base:THREE.BufferGeometry,selectedFace:FrozenPlanarFace,p:FaceExtrusionParameters,lifecycle?:{afterBuild?:()=>void}):THREE.BufferGeometry{
  const issue=validateFaceExtrusionParameters(p);if(issue)throw new Error(issue);
  const position=base.getAttribute('position'),rawCount=base.index?.count??position?.count??0,triangleCount=rawCount/3;
  if(!position||rawCount%3!==0||triangleCount>FACE_TRIANGLE_LIMIT)throw new Error('Source geometry exceeds the interactive triangle limit or has invalid triangles.');
  if(selectedFace.attachmentLoop.length<3||selectedFace.attachmentLoop.length>512||selectedFace.triangleIndices.some(t=>!Number.isInteger(t)||t<0||t>=triangleCount))throw new Error('The frozen face attachment no longer matches the source geometry.');
  const fingerprint=geometryFingerprint(base);if(fingerprint!==selectedFace.sourceFingerprint)throw new Error('The source geometry changed after this face was selected. Select the face again.');
  const current=extractPlanarFace(base,selectedFace.triangleIndices[0]),sameLoop=current.attachmentLoop.length===selectedFace.attachmentLoop.length&&current.attachmentLoop.every((point,i)=>point.every((value,axis)=>Math.abs(value-selectedFace.attachmentLoop[i][axis])<=1e-7));if(current.signature!==selectedFace.signature||current.triangleIndices.join(',')!==selectedFace.triangleIndices.join(',')||new THREE.Vector3(...current.normal).distanceTo(new THREE.Vector3(...selectedFace.normal))>1e-7||!sameLoop)throw new Error('The stored face attachment is stale or was modified. Select the face again.');
  const face=current;
  const predictedTriangles=triangleCount-face.triangleIndices.length+face.attachmentLoop.length*p.twistSteps*2+Math.max(1,face.attachmentLoop.length-2);if(predictedTriangles>FACE_TRIANGLE_LIMIT)throw new Error('Extrusion would exceed the interactive triangle limit. Reduce twist steps or mesh complexity.');
  const key=JSON.stringify([fingerprint,face.signature,p]),cached=cache.get(key);if(cached)return cached.clone();
  const vertices:number[]=[],indices:number[]=[],sourceNormals:number[]=[],vertexMap=new Map<string,number>(),sourceIndex=base.index,sourceNormal=base.getAttribute('normal'),removed=new Set(face.triangleIndices);
  const add=(v:THREE.Vector3)=>{const key=`${Math.round(v.x*1e8)},${Math.round(v.y*1e8)},${Math.round(v.z*1e8)}`;let id=vertexMap.get(key);if(id===undefined){id=vertices.length/3;vertexMap.set(key,id);vertices.push(v.x,v.y,v.z);}return id;};
  const read=(raw:number)=>new THREE.Vector3().fromBufferAttribute(position,sourceIndex?sourceIndex.getX(raw):raw);
  for(let triangle=0;triangle<triangleCount;triangle++)if(!removed.has(triangle))for(let corner=0;corner<3;corner++){const raw=triangle*3+corner,attributeIndex=sourceIndex?sourceIndex.getX(raw):raw;indices.push(add(read(raw)));if(sourceNormal)sourceNormals.push(sourceNormal.getX(attributeIndex),sourceNormal.getY(attributeIndex),sourceNormal.getZ(attributeIndex));}
  const centroid=new THREE.Vector3(...face.centroid),normal=new THREE.Vector3(...face.normal),u=new THREE.Vector3(...face.basisU),v=new THREE.Vector3(...face.basisV),ringCount=face.attachmentLoop.length,rings:number[][]=[];
  for(let layer=0;layer<=p.twistSteps;layer++){
    const t=layer/p.twistSteps,scale=1+t*(p.topScale-1),angle=THREE.MathUtils.degToRad(t*p.twistAngle),co=Math.cos(angle),si=Math.sin(angle);
    rings.push(face.attachmentLoop.map(point=>{if(layer===0)return add(new THREE.Vector3(...point));const relative=new THREE.Vector3(...point).sub(centroid),x=relative.dot(u),y=relative.dot(v);return add(centroid.clone().addScaledVector(u,scale*(x*co-y*si)).addScaledVector(v,scale*(x*si+y*co)).addScaledVector(normal,t*p.distance));}));
  }
  for(let layer=0;layer<p.twistSteps;layer++)for(let i=0;i<ringCount;i++){const next=(i+1)%ringCount,a=rings[layer][i],b=rings[layer][next],c=rings[layer+1][next],d=rings[layer+1][i];indices.push(a,b,c,a,c,d);}
  const topPoints=face.attachmentLoop.map(point=>{const relative=new THREE.Vector3(...point).sub(centroid);return new THREE.Vector2(relative.dot(u),relative.dot(v));});
  for(const [a,b,c] of THREE.ShapeUtils.triangulateShape(topPoints,[]))indices.push(rings[p.twistSteps][a],rings[p.twistSteps][b],rings[p.twistSteps][c]);
  const indexed=new THREE.BufferGeometry();indexed.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));indexed.setIndex(indices);indexed.computeVertexNormals();
  const output=indexed.toNonIndexed();indexed.dispose();try{lifecycle?.afterBuild?.();output.computeVertexNormals();const outputNormal=output.getAttribute('normal'),restCorners=(triangleCount-removed.size)*3,sideTriangles=ringCount*p.twistSteps*2,sideStartTriangle=restCorners/3,capStartCorner=(sideStartTriangle+sideTriangles)*3;
  if(sourceNormal)for(let i=0;i<restCorners;i++)outputNormal.setXYZ(i,sourceNormals[i*3],sourceNormals[i*3+1],sourceNormals[i*3+2]);
  if(p.twistMode==='smooth'){
    const outputPosition=output.getAttribute('position'),triangleNormal=(triangle:number)=>{const a=new THREE.Vector3().fromBufferAttribute(outputPosition,triangle*3),b=new THREE.Vector3().fromBufferAttribute(outputPosition,triangle*3+1),c=new THREE.Vector3().fromBufferAttribute(outputPosition,triangle*3+2);return b.sub(a).cross(c.sub(a)).normalize();},quadNormals=Array.from({length:p.twistSteps},(_,layer)=>Array.from({length:ringCount},(_,edge)=>triangleNormal(sideStartTriangle+(layer*ringCount+edge)*2).add(triangleNormal(sideStartTriangle+(layer*ringCount+edge)*2+1)).normalize()));
    for(let layer=0;layer<p.twistSteps;layer++)for(let edge=0;edge<ringCount;edge++){const lower=layer?quadNormals[layer-1][edge].clone().add(quadNormals[layer][edge]).normalize():quadNormals[layer][edge],upper=layer+1<p.twistSteps?quadNormals[layer][edge].clone().add(quadNormals[layer+1][edge]).normalize():quadNormals[layer][edge],corner=(sideStartTriangle+(layer*ringCount+edge)*2)*3;for(const offset of [0,1,3])outputNormal.setXYZ(corner+offset,lower.x,lower.y,lower.z);for(const offset of [2,4,5])outputNormal.setXYZ(corner+offset,upper.x,upper.y,upper.z);}
  }
  for(let i=capStartCorner;i<outputNormal.count;i++)outputNormal.setXYZ(i,normal.x,normal.y,normal.z);outputNormal.needsUpdate=true;
  const volume=computeMeshVolume(output),sourceVolume=computeMeshVolume(base);if(!Number.isFinite(volume)||volume<=sourceVolume+Math.max(1e-9,sourceVolume*1e-8))throw new Error('Extrusion did not produce a larger positive solid.');
  try{extractPlanarFace(output,0,false);}catch(error){throw new Error(`Extrusion topology is invalid: ${error instanceof Error?error.message:'validation failed.'}`);}if(!hasConformingEdgeIncidence(output))throw new Error('Extrusion topology has unmatched attachment edges.');
  output.computeBoundingBox();output.computeBoundingSphere();cache.set(key,output.clone());if(cache.size>CACHE_LIMIT){const first=cache.keys().next().value;if(first){cache.get(first)?.dispose();cache.delete(first);}}return output;
  }catch(error){output.dispose();throw error;}
}
