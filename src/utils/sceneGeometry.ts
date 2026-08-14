import * as THREE from 'three';
import type {SceneObject} from '../types';
import {baseBooleanGeometry,createSubtractedGeometry} from './booleanGeometry';
import {createPositiveFaceExtrusion} from './faceExtrusionGeometry';

export function createEvaluatedSceneGeometry(object:SceneObject,objects:SceneObject[]):THREE.BufferGeometry{
  const cutter=object.boolean?objects.find(candidate=>candidate.id===object.boolean!.cutterId):undefined;
  const source=object.boolean?(cutter?createSubtractedGeometry(object,cutter):null):baseBooleanGeometry(object);
  if(!source)throw new Error('Boolean cutter is missing.');
  if(!object.faceExtrusion)return source;
  try{return createPositiveFaceExtrusion(source,object.faceExtrusion.face,object.faceExtrusion);}
  finally{source.dispose();}
}

export function createEvaluatedSceneGeometryWithFallback(object:SceneObject,objects:SceneObject[]):{geometry:THREE.BufferGeometry;error:string|null}{
  const cutter=object.boolean?objects.find(candidate=>candidate.id===object.boolean!.cutterId):undefined;
  const source=object.boolean?(cutter?createSubtractedGeometry(object,cutter):null):baseBooleanGeometry(object);
  if(!source)throw new Error('Boolean cutter is missing.');
  if(!object.faceExtrusion)return {geometry:source,error:null};
  try{const geometry=createPositiveFaceExtrusion(source,object.faceExtrusion.face,object.faceExtrusion);source.dispose();return {geometry,error:null};}
  catch(error){return {geometry:source,error:`Face extrusion retained its source: ${error instanceof Error?error.message:'evaluation failed.'}`};}
}
