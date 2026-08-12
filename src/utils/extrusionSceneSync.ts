import * as THREE from 'three';
import type { ParametricExtrusionGeometry } from '../types';
import { createParametricExtrusionGeometry, parametricExtrusionKey } from './parametricExtrusion';

/** Replaces only a procedural mesh's geometry, preserving object/material identity. */
export function syncExtrusionGeometry(object: THREE.Object3D, data: ParametricExtrusionGeometry): boolean {
  const key = parametricExtrusionKey(data);
  if (object.userData.geometryKey === key) return false;
  const mesh = object.children.find(child => child instanceof THREE.Mesh) as THREE.Mesh | undefined;
  if (!mesh) return false;
  const previous = mesh.geometry;
  mesh.geometry = createParametricExtrusionGeometry(data);
  object.userData.geometryKey = key;
  previous.dispose();
  return true;
}

