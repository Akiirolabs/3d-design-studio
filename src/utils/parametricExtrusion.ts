import * as THREE from 'three';
import type { ParametricExtrusionGeometry } from '../types';

export const DEFAULT_PARAMETRIC_EXTRUSION: ParametricExtrusionGeometry = {
  kind: 'parametric-extrusion', profile: [[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]],
  height: 1, baseScale: 1, topScale: 1, twistAngle: 0, twistSteps: 12, twistMode: 'smooth',
};

const EPSILON = 1e-9;
const cross = (a:[number,number], b:[number,number], c:[number,number]) =>
  (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const samePoint = (a:[number,number], b:[number,number]) => Math.hypot(a[0]-b[0], a[1]-b[1]) <= EPSILON;
const onSegment = (a:[number,number], b:[number,number], p:[number,number]) =>
  Math.abs(cross(a,b,p)) <= EPSILON && p[0] >= Math.min(a[0],b[0])-EPSILON && p[0] <= Math.max(a[0],b[0])+EPSILON && p[1] >= Math.min(a[1],b[1])-EPSILON && p[1] <= Math.max(a[1],b[1])+EPSILON;
const intersectsOrTouches = (a:[number,number],b:[number,number],c:[number,number],d:[number,number]) => {
  const ab1=cross(a,b,c), ab2=cross(a,b,d), cd1=cross(c,d,a), cd2=cross(c,d,b);
  if (((ab1 > EPSILON && ab2 < -EPSILON)||(ab1 < -EPSILON && ab2 > EPSILON)) && ((cd1 > EPSILON && cd2 < -EPSILON)||(cd1 < -EPSILON && cd2 > EPSILON))) return true;
  return (Math.abs(ab1)<=EPSILON&&onSegment(a,b,c))||(Math.abs(ab2)<=EPSILON&&onSegment(a,b,d))||(Math.abs(cd1)<=EPSILON&&onSegment(c,d,a))||(Math.abs(cd2)<=EPSILON&&onSegment(c,d,b));
};

export const minimumTwistSteps = (twistAngle: number) => Math.max(1, Math.ceil(Math.abs(twistAngle) / 30));

export function validateParametricExtrusion(value: unknown): value is ParametricExtrusionGeometry {
  if (!value || typeof value !== 'object') return false;
  const v=value as ParametricExtrusionGeometry;
  const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n);
  if (v.kind!=='parametric-extrusion'||!Array.isArray(v.profile)||v.profile.length<3||v.profile.length>64) return false;
  if (!v.profile.every(p=>Array.isArray(p)&&p.length===2&&finite(p[0])&&finite(p[1])&&Math.abs(p[0])<=1000&&Math.abs(p[1])<=1000)) return false;
  if (!finite(v.height)||v.height<=0||v.height>1000||!finite(v.baseScale)||v.baseScale<0.1||v.baseScale>5||!finite(v.topScale)||v.topScale<0.1||v.topScale>5||!finite(v.twistAngle)||v.twistAngle < -360||v.twistAngle>360||!Number.isInteger(v.twistSteps)||v.twistSteps<1||v.twistSteps>128||(v.twistMode!=='steps'&&v.twistMode!=='smooth')) return false;
  if (v.twistSteps < minimumTwistSteps(v.twistAngle)) return false;
  for(let i=0;i<v.profile.length;i++) for(let j=i+1;j<v.profile.length;j++) if(samePoint(v.profile[i],v.profile[j])) return false;
  let area=0; for(let i=0;i<v.profile.length;i++){const p=v.profile[i],q=v.profile[(i+1)%v.profile.length]; area+=p[0]*q[1]-q[0]*p[1];}
  const xs=v.profile.map(p=>p[0]), ys=v.profile.map(p=>p[1]);
  const boundsArea=(Math.max(...xs)-Math.min(...xs))*(Math.max(...ys)-Math.min(...ys));
  if (boundsArea<=EPSILON || Math.abs(area)<Math.max(1e-8,boundsArea*1e-8)) return false;
  for(let i=0;i<v.profile.length;i++) for(let j=i+1;j<v.profile.length;j++) {
    if (j===i+1||(i===0&&j===v.profile.length-1)) continue;
    if(intersectsOrTouches(v.profile[i],v.profile[(i+1)%v.profile.length],v.profile[j],v.profile[(j+1)%v.profile.length])) return false;
  }
  return true;
}

export function parametricExtrusionKey(data: ParametricExtrusionGeometry): string { return JSON.stringify(data); }

export function createParametricExtrusionGeometry(data: ParametricExtrusionGeometry): THREE.BufferGeometry {
  if (!validateParametricExtrusion(data)) throw new Error('Invalid parametric extrusion geometry.');
  let profile=data.profile.map(p=>[p[0],p[1]] as [number,number]);
  let area=0; for(let i=0;i<profile.length;i++){const p=profile[i],q=profile[(i+1)%profile.length];area+=p[0]*q[1]-q[0]*p[1];}
  if(area<0) profile=profile.reverse();
  const positions:number[]=[]; const indices:number[]=[]; const count=profile.length;
  const pointAt=(point:[number,number],layer:number):[number,number,number]=>{const t=layer/data.twistSteps,s=data.baseScale+t*(data.topScale-data.baseScale),angle=THREE.MathUtils.degToRad(t*data.twistAngle),co=Math.cos(angle),si=Math.sin(angle);return [s*(point[0]*co-point[1]*si),s*(point[0]*si+point[1]*co),t*data.height];};
  // Each polygon edge owns a strip. This keeps intentional profile corners and
  // cap seams sharp while sharing vertices vertically for smooth twist shading.
  for(let edge=0;edge<count;edge++) {
    const start=positions.length/3;
    for(let layer=0;layer<=data.twistSteps;layer++) positions.push(...pointAt(profile[edge],layer),...pointAt(profile[(edge+1)%count],layer));
    for(let layer=0;layer<data.twistSteps;layer++){const a=start+layer*2,b=a+1,d=a+2,c=a+3;indices.push(a,b,c,a,c,d);}
  }
  const caps=THREE.ShapeUtils.triangulateShape(profile.map(p=>new THREE.Vector2(...p)),[]);
  const bottom=positions.length/3; for(const point of profile) positions.push(...pointAt(point,0));
  const top=positions.length/3; for(const point of profile) positions.push(...pointAt(point,data.twistSteps));
  for(const [a,b,c] of caps) { indices.push(bottom+c,bottom+b,bottom+a); indices.push(top+a,top+b,top+c); }
  const result=new THREE.BufferGeometry(); result.setAttribute('position',new THREE.Float32BufferAttribute(positions,3)); result.setIndex(indices);
  const output=data.twistMode==='steps'?result.toNonIndexed():result; if(output!==result) result.dispose();
  output.computeVertexNormals(); output.computeBoundingBox(); output.computeBoundingSphere(); return output;
}
