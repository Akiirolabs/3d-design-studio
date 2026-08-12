import { describe, expect, it } from 'vitest';
import { createParametricExtrusionGeometry, DEFAULT_PARAMETRIC_EXTRUSION, validateParametricExtrusion } from '../utils/parametricExtrusion';
import { getInitialProject } from '../utils/storage';
import { validateProjectData } from '../utils/projectValidation';
import { exportToOBJ, exportToSTL } from '../utils/exporters';
import * as THREE from 'three';

const config = (patch = {}) => ({ ...DEFAULT_PARAMETRIC_EXTRUSION, ...patch });
const triangleIndices = (geometry: ReturnType<typeof createParametricExtrusionGeometry>) => {
  if (geometry.index) return Array.from(geometry.index.array);
  return Array.from({length: geometry.getAttribute('position').count},(_,i)=>i);
};

describe('parametric extrusion', () => {
  it('interpolates scale and twist at the base, midpoint, and top', () => {
    const geometry=createParametricExtrusionGeometry(config({baseScale:1,topScale:2,twistAngle:180,twistSteps:6}));
    const p=geometry.getAttribute('position');
    expect([p.getX(0),p.getY(0),p.getZ(0)]).toEqual([-0.5,-0.5,0]);
    expect(p.getX(6)).toBeCloseTo(0.75); expect(p.getY(6)).toBeCloseTo(-0.75); expect(p.getZ(6)).toBeCloseTo(0.5);
    expect(p.getX(12)).toBeCloseTo(1); expect(p.getY(12)).toBeCloseTo(1); expect(p.getZ(12)).toBeCloseTo(1);
    geometry.dispose();
  });

  it.each([-360,360])('supports a %d degree twist with finite normals', twistAngle => {
    const geometry=createParametricExtrusionGeometry(config({twistAngle,twistSteps:128}));
    for(const name of ['position','normal']) for(const value of geometry.getAttribute(name).array) expect(Number.isFinite(value)).toBe(true);
    expect(geometry.getAttribute('position').count).toBe(4*2*129+8); geometry.dispose();
  });

  it('has deterministic triangle counts and every geometric manifold edge occurs twice', () => {
    const geometry=createParametricExtrusionGeometry(config({twistSteps:12}));
    expect(triangleIndices(geometry).length/3).toBe(12*4*2+4);
    const edges=new Map<string,number>(), ids=triangleIndices(geometry), p=geometry.getAttribute('position');
    const point=(i:number)=>`${p.getX(i).toFixed(6)},${p.getY(i).toFixed(6)},${p.getZ(i).toFixed(6)}`;
    for(let i=0;i<ids.length;i+=3) for(const [a,b] of [[ids[i],ids[i+1]],[ids[i+1],ids[i+2]],[ids[i+2],ids[i]]]) { const pa=point(a),pb=point(b),key=pa<pb?`${pa}:${pb}`:`${pb}:${pa}`;edges.set(key,(edges.get(key)??0)+1); }
    expect([...edges.values()].every(value=>value===2)).toBe(true); geometry.dispose();
  });

  it('uses outward winding with positive signed volume', () => {
    const geometry=createParametricExtrusionGeometry(config()), p=geometry.getAttribute('position'), ids=triangleIndices(geometry); let volume=0;
    for(let i=0;i<ids.length;i+=3){const a=ids[i],b=ids[i+1],c=ids[i+2]; volume+=(p.getX(a)*(p.getY(b)*p.getZ(c)-p.getZ(b)*p.getY(c))+p.getY(a)*(p.getZ(b)*p.getX(c)-p.getX(b)*p.getZ(c))+p.getZ(a)*(p.getX(b)*p.getY(c)-p.getY(b)*p.getX(c)))/6;}
    expect(volume).toBeGreaterThan(0); geometry.dispose();
  });

  it('creates flat non-indexed steps and indexed smooth geometry', () => {
    const smooth=createParametricExtrusionGeometry(config({twistMode:'smooth'})); const steps=createParametricExtrusionGeometry(config({twistMode:'steps'}));
    expect(smooth.index).not.toBeNull(); expect(steps.index).toBeNull(); expect(steps.getAttribute('position').count).toBeGreaterThan(smooth.getAttribute('position').count);
    smooth.dispose();steps.dispose();
  });

  it('rejects degenerate, self-intersecting, nonfinite, oversized and out-of-range input', () => {
    expect(validateParametricExtrusion(config({profile:[[0,0],[1,1],[2,2]]}))).toBe(false);
    expect(validateParametricExtrusion(config({profile:[[0,0],[1,1],[0,1],[1,0]]}))).toBe(false);
    expect(validateParametricExtrusion(config({height:Infinity}))).toBe(false);
    expect(validateParametricExtrusion(config({profile:Array.from({length:65},(_,i)=>[Math.cos(i),Math.sin(i)])}))).toBe(false);
    expect(validateParametricExtrusion(config({twistSteps:129}))).toBe(false);
    expect(validateParametricExtrusion(config({profile:[[0,0],[1,0],[1,1],[0,0]]}))).toBe(false);
    expect(validateParametricExtrusion(config({profile:[[0,0],[1,0],[1,1],[1,0],[0,1]]}))).toBe(false);
    expect(validateParametricExtrusion(config({profile:[[0,0],[2,0],[1,0],[1,1],[0,1]]}))).toBe(false);
    expect(validateParametricExtrusion(config({profile:[[0,0],[2,0],[2,2],[1,0],[0,2]]}))).toBe(false);
    expect(validateParametricExtrusion(config({profile:[[0,0],[1,0],[1,1e-10],[0,1e-10]]}))).toBe(false);
    expect(validateParametricExtrusion(config({twistAngle:360,twistSteps:11}))).toBe(false);
  });

  it('keeps caps flat and cap-wall plus polygon corner normals sharp', () => {
    const geometry=createParametricExtrusionGeometry(config()),p=geometry.getAttribute('position'),n=geometry.getAttribute('normal');
    const normalsAt=(x:number,y:number,z:number)=>Array.from({length:p.count},(_,i)=>i).filter(i=>Math.abs(p.getX(i)-x)<1e-6&&Math.abs(p.getY(i)-y)<1e-6&&Math.abs(p.getZ(i)-z)<1e-6).map(i=>[n.getX(i),n.getY(i),n.getZ(i)]);
    const base=normalsAt(-.5,-.5,0);
    expect(base.some(v=>v[2]<-.99)).toBe(true);
    expect(base.some(v=>Math.abs(v[2])<.01&&v[0]<-.99)).toBe(true);
    expect(base.some(v=>Math.abs(v[2])<.01&&v[1]<-.99)).toBe(true);
    geometry.dispose();
  });

  it('generates the bounded maximum deterministically', () => {
    const start=performance.now(); const a=createParametricExtrusionGeometry(config({twistSteps:128})); const b=createParametricExtrusionGeometry(config({twistSteps:128}));
    expect(Array.from(a.getAttribute('position').array)).toEqual(Array.from(b.getAttribute('position').array)); expect(performance.now()-start).toBeLessThan(1000);a.dispose();b.dispose();
  });

  it('round-trips through project JSON validation without affecting legacy objects', () => {
    const project=structuredClone(getInitialProject());
    project.objects.push({...project.objects[0],id:'extrusion',name:'Parametric Extrusion',type:'parametric-extrusion',category:'primitives',geometry:config()});
    const parsed=JSON.parse(JSON.stringify(project)); const result=validateProjectData(parsed);
    expect(result.success).toBe(true); if(result.success) expect(result.data.objects.at(-1)?.geometry).toEqual(config());
  });

  it.each(['smooth','steps'] as const)('exports finite %s extrusion geometry to OBJ and STL', twistMode => {
    const scene=new THREE.Scene(), geometry=createParametricExtrusionGeometry(config({twistAngle:90,twistSteps:6,twistMode}));
    scene.add(new THREE.Mesh(geometry,new THREE.MeshStandardMaterial()));
    const obj=exportToOBJ(scene); const stl=exportToSTL(scene);
    expect(obj).toContain('v '); expect(obj).toContain('f ');
    expect(typeof stl).toBe('string'); expect(stl).toContain('facet normal');
    expect(`${obj}${stl}`).not.toMatch(/NaN|Infinity/);
    geometry.dispose();
  });
});
