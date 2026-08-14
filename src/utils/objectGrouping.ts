import * as THREE from 'three';
import type {ObjectGroup,SceneObject} from '../types';
import {hasBooleanDependency} from './booleanGeometry';

export function getGroupingIssue(objects:SceneObject[],groups:ObjectGroup[],selectedIds:string[]):string|null{
  if(selectedIds.length<2)return 'Select at least two objects to group.';
  if(selectedIds.some(id=>!objects.some(object=>object.id===id)))return 'The selection contains a missing object.';
  if(groups.some(group=>group.memberIds.some(id=>selectedIds.includes(id))))return 'Ungroup existing members before creating another group. Nested groups are not supported yet.';
  if(selectedIds.some(id=>hasBooleanDependency(objects,id)))return 'Remove Boolean relationships before grouping these objects.';
  if(selectedIds.some(id=>objects.find(object=>object.id===id)?.faceExtrusion))return 'Remove face extrusions before grouping these objects.';
  if(selectedIds.some(id=>objects.find(object=>object.id===id)?.locked))return 'Unlock every selected object before grouping.';
  return null;
}

export function groupObjects(objects:SceneObject[],groups:ObjectGroup[],selectedIds:string[],id:string,name='Group'):ObjectGroup[]{
  const issue=getGroupingIssue(objects,groups,selectedIds);if(issue)throw new Error(issue);
  const members=objects.filter(object=>selectedIds.includes(object.id));
  const pivot=members.reduce((sum,object)=>sum.map((v,i)=>v+object.position[i]) as [number,number,number],[0,0,0] as [number,number,number]).map(v=>v/members.length) as [number,number,number];
  return [...groups,{id,name,memberIds:[...selectedIds],pivot,visible:true,locked:false}];
}

export function ungroupObjects(groups:ObjectGroup[],groupId:string):ObjectGroup[]{return groups.filter(group=>group.id!==groupId);}

const matrixFor=(position:[number,number,number],rotation:[number,number,number],scale:[number,number,number])=>new THREE.Matrix4().compose(new THREE.Vector3(...position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation.map(THREE.MathUtils.degToRad) as [number,number,number])),new THREE.Vector3(...scale));
export function transformGroupMembers(objects:SceneObject[],group:ObjectGroup,position:[number,number,number],rotation:[number,number,number],scale:[number,number,number]):{objects:SceneObject[];group:ObjectGroup}{
  const oldPivot=new THREE.Vector3(...group.pivot),nextPivot=new THREE.Vector3(...position);
  const delta=new THREE.Matrix4().compose(nextPivot,new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation.map(THREE.MathUtils.degToRad) as [number,number,number])),new THREE.Vector3(...scale)).multiply(new THREE.Matrix4().makeTranslation(oldPivot.x,oldPivot.y,oldPivot.z).invert());
  const ids=new Set(group.memberIds);
  return {group:{...group,pivot:position},objects:objects.map(object=>{
    if(!ids.has(object.id))return object;
    const transformed=delta.clone().multiply(matrixFor(object.position,object.rotation,object.scale));
    const p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();transformed.decompose(p,q,s);const e=new THREE.Euler().setFromQuaternion(q);
    return {...object,position:p.toArray().map(v=>Number(v.toFixed(3))) as [number,number,number],rotation:[e.x,e.y,e.z].map(v=>Number(THREE.MathUtils.radToDeg(v).toFixed(2))) as [number,number,number],scale:s.toArray().map(v=>Number(v.toFixed(3))) as [number,number,number]};
  })};
}

export function applyMemberDrivenGroupTransform(objects:SceneObject[],groups:ObjectGroup[],id:string,position:[number,number,number],rotation:[number,number,number],scale:[number,number,number]):{objects:SceneObject[];groups:ObjectGroup[]}{
  const target=objects.find(object=>object.id===id),group=groups.find(candidate=>candidate.memberIds.includes(id));
  if(!target||!group)return {objects:objects.map(object=>object.id===id?{...object,position,rotation,scale}:object),groups};
  const nextPivot=group.pivot.map((value,index)=>value+position[index]-target.position[index]) as [number,number,number];
  const rotationDelta=rotation.map((value,index)=>value-target.rotation[index]) as [number,number,number];
  const scaleRatio=scale.map((value,index)=>value/target.scale[index]) as [number,number,number];
  const transformed=transformGroupMembers(objects,group,nextPivot,rotationDelta,scaleRatio);
  return {objects:transformed.objects,groups:groups.map(candidate=>candidate.id===group.id?transformed.group:candidate)};
}

export function validateGroups(objects:SceneObject[],groups:unknown):string|null{
  if(groups===undefined)return null;if(!Array.isArray(groups))return 'Project groups must be an array.';
  const objectIds=new Set(objects.map(object=>object.id)),groupIds=new Set<string>(),members=new Set<string>();
  for(const value of groups){if(!value||typeof value!=='object')return 'Every group must be an object.';const group=value as ObjectGroup;
    if(typeof group.id!=='string'||!group.id.trim()||groupIds.has(group.id))return 'Every group must have a unique ID.';groupIds.add(group.id);
    if(typeof group.name!=='string'||!group.name.trim()||group.name.length>80)return `Group ${group.id} has an invalid name.`;
    if(!Array.isArray(group.memberIds)||group.memberIds.length<2||new Set(group.memberIds).size!==group.memberIds.length)return `Group ${group.id} must contain at least two unique members.`;
    if(group.memberIds.some(id=>!objectIds.has(id)))return `Group ${group.id} contains a missing object.`;
    if(group.memberIds.some(id=>members.has(id)))return 'Nested or overlapping groups are not supported.';group.memberIds.forEach(id=>members.add(id));
    if(!Array.isArray(group.pivot)||group.pivot.length!==3||!group.pivot.every(Number.isFinite)||typeof group.visible!=='boolean'||typeof group.locked!=='boolean')return `Group ${group.id} has invalid properties.`;
    if(group.memberIds.some(id=>hasBooleanDependency(objects,id)))return `Group ${group.id} cannot contain a Boolean target or cutter.`;
    if(group.memberIds.some(id=>objects.find(object=>object.id===id)?.faceExtrusion))return `Group ${group.id} cannot contain a face extrusion modifier.`;
  }return null;
}
export function canTransformGroup(objects:SceneObject[],group:ObjectGroup):string|null{if(!group.visible)return `${group.name} is hidden.`;if(group.locked)return `${group.name} is locked.`;const members=group.memberIds.map(id=>objects.find(object=>object.id===id));if(members.some(member=>!member))return `${group.name} contains a missing object.`;if(members.some(member=>!member!.visible))return `Show every object in ${group.name} before transforming it.`;if(members.some(member=>member!.locked))return `Unlock every object in ${group.name} before transforming it.`;return null;}
export function expandGroupedSelection(groups:ObjectGroup[],id:string):{ids:string[];primaryId:string}|null{const group=groups.find(candidate=>candidate.memberIds.includes(id));return group?{ids:[...group.memberIds],primaryId:group.memberIds[0]}:null;}
