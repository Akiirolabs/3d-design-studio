import {describe,expect,it} from 'vitest';import * as THREE from 'three';import {extractPlanarFace} from '../utils/faceTopology';
describe('planar face topology',()=>{
 it('extracts a frozen cube face loop',()=>{const geometry=new THREE.BoxGeometry(1,1,1),face=extractPlanarFace(geometry,0);expect(face.profile).toHaveLength(4);expect(face.triangleIndices).toHaveLength(2);expect(face.signature).toBeTruthy();geometry.dispose();});
 it('keeps results in rotated geometry local coordinates',()=>{const geometry=new THREE.BoxGeometry(1,1,1);geometry.rotateZ(Math.PI/4);const face=extractPlanarFace(geometry,0);expect(Math.hypot(...face.normal)).toBeCloseTo(1);expect(face.profile).toHaveLength(4);geometry.dispose();});
 it('extracts a cylinder cap and refuses a curved sphere region',()=>{const cylinder=new THREE.CylinderGeometry(.5,.5,1,16);expect(extractPlanarFace(cylinder,32).profile.length).toBeGreaterThan(3);cylinder.dispose();const sphere=new THREE.SphereGeometry(.5,8,6);expect(()=>extractPlanarFace(sphere,10)).toThrow(/curved|stable planar region|degenerate/);sphere.dispose();});
 it('rejects nonmanifold geometry',()=>{const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0,0,0,0,1,0,0,0,-1,0,0,0,0,1,0,0,0,0,1],3));expect(()=>extractPlanarFace(geometry,0)).toThrow(/nonmanifold/);geometry.dispose();});
});
