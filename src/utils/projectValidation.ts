import { AssetCategory, EnvironmentSettings, EnvironmentTheme, ProjectData, SceneObject } from '../types';
import { getAssetCategory, isValidAssetTypeCategory, LEGACY_ARCHITECTURE_TYPES } from './assetCatalog';
import { validateParametricExtrusion } from './parametricExtrusion';
import { createSubtractedGeometry, transformIssue } from './booleanGeometry';

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

const CATEGORIES: AssetCategory[] = [
  'primitives', 'architecture', 'interior', 'environment', 'lights',
  'technology', 'stationery', 'creative',
];
const THEMES: EnvironmentTheme[] = ['studio', 'sunset', 'midnight', 'daylight', 'warm'];
const SHADOW_QUALITIES: EnvironmentSettings['shadowQuality'][] = ['low', 'medium', 'high', 'ultra'];
const BOOLEAN_TYPES = new Set(['cube','sphere','cylinder','cone','torus','capsule','parametric-extrusion']);
const BOOLEAN_SCALE_MIN = 0.001;
const BOOLEAN_SCALE_MAX = 1000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const isNonEmptyString = (value: unknown): value is string => isString(value) && value.trim().length > 0;
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';
const isTuple3 = (value: unknown): value is [number, number, number] =>
  Array.isArray(value) && value.length === 3 && value.every(isFiniteNumber);

function validateSceneObject(value: unknown, index: number): ValidationResult<SceneObject> {
  if (!isRecord(value)) return { success: false, error: `Object ${index + 1} must be an object.` };
  const requiredStrings = ['id', 'name', 'type', 'color', 'materialPreset'] as const;
  for (const field of requiredStrings) {
    if (!isNonEmptyString(value[field])) {
      return { success: false, error: `Object ${index + 1} has an invalid or missing ${field}.` };
    }
  }
  if (!isString(value.category) || !CATEGORIES.includes(value.category as AssetCategory)) {
    return { success: false, error: `Object ${index + 1} has an invalid category.` };
  }
  const expectedCategory = getAssetCategory(value.type as string);
  if (!expectedCategory) {
    return { success: false, error: `Object ${index + 1} has unsupported asset type "${value.type}".` };
  }
  if (!isValidAssetTypeCategory(value.type as string, value.category as AssetCategory)) {
    return { success: false, error: `Object ${index + 1} type "${value.type}" belongs to category "${expectedCategory}", not "${value.category}".` };
  }
  for (const field of ['position', 'rotation', 'scale'] as const) {
    if (!isTuple3(value[field])) {
      return { success: false, error: `Object ${index + 1} ${field} must contain exactly three finite numbers.` };
    }
  }
  for (const field of ['metalness', 'roughness', 'transmission'] as const) {
    if (!isFiniteNumber(value[field])) {
      return { success: false, error: `Object ${index + 1} has an invalid or missing ${field}.` };
    }
  }
  for (const field of ['visible', 'locked'] as const) {
    if (!isBoolean(value[field])) {
      return { success: false, error: `Object ${index + 1} has an invalid or missing ${field}.` };
    }
  }
  if (value.clearcoat !== undefined && !isFiniteNumber(value.clearcoat)) return { success: false, error: `Object ${index + 1} has an invalid clearcoat.` };
  if (value.intensity !== undefined && !isFiniteNumber(value.intensity)) return { success: false, error: `Object ${index + 1} has an invalid intensity.` };
  if (value.emission !== undefined && !isString(value.emission)) return { success: false, error: `Object ${index + 1} has an invalid emission.` };
  if (value.parentId !== undefined && value.parentId !== null && !isString(value.parentId)) return { success: false, error: `Object ${index + 1} has an invalid parentId.` };
  if (value.holeForId !== undefined && !isNonEmptyString(value.holeForId)) return { success: false, error: `Object ${index + 1} has an invalid hole target.` };
  if (value.boolean !== undefined && (!isRecord(value.boolean) || value.boolean.kind !== 'subtract' || !isNonEmptyString(value.boolean.cutterId))) return { success: false, error: `Object ${index + 1} has invalid Boolean metadata.` };
  if (value.type === 'parametric-extrusion') {
    if (!validateParametricExtrusion(value.geometry)) return { success: false, error: `Object ${index + 1} has invalid parametric extrusion geometry.` };
  } else if (value.geometry !== undefined) {
    return { success: false, error: `Object ${index + 1} has geometry that does not match its type.` };
  }
  return { success: true, data: value as unknown as SceneObject };
}

export function validateSceneObjects(value: unknown): ValidationResult<SceneObject[]> {
  if (!Array.isArray(value)) return { success: false, error: 'Project objects must be an array.' };
  const objects: SceneObject[] = [];
  const ids = new Set<string>();
  for (let index = 0; index < value.length; index += 1) {
    const result = validateSceneObject(value[index], index);
    if ('error' in result) return { success: false, error: result.error };
    if (ids.has(result.data.id)) return { success: false, error: `Duplicate object ID "${result.data.id}".` };
    ids.add(result.data.id);
    objects.push(result.data);
  }
  for (const object of objects) {
    if (object.boolean && object.holeForId) return { success: false, error: `Object "${object.id}" cannot be both a Boolean target and cutter.` };
    if (object.boolean) {
      if (object.boolean.cutterId === object.id) return { success: false, error: `Object "${object.id}" cannot subtract itself.` };
      const cutter=objects.find(candidate=>candidate.id===object.boolean!.cutterId);
      if (!cutter || cutter.holeForId !== object.id) return { success: false, error: `Object "${object.id}" has a missing or inconsistent Boolean cutter.` };
      if (!BOOLEAN_TYPES.has(object.type) || !BOOLEAN_TYPES.has(cutter.type)) return { success: false, error: `Boolean pair "${object.id}" contains an unsupported solid.` };
      if (!object.visible || cutter.visible) return { success: false, error: `Boolean target "${object.id}" must be visible and its cutter must be hidden.` };
      if (object.locked || cutter.locked) return { success: false, error: `Boolean pair "${object.id}" must be unlocked.` };
      if ([...object.scale,...cutter.scale].some(scale => scale < BOOLEAN_SCALE_MIN || scale > BOOLEAN_SCALE_MAX)) return { success: false, error: `Boolean pair "${object.id}" has an invalid scale.` };
      const targetTransformIssue=transformIssue(object),cutterTransformIssue=transformIssue(cutter);
      if(targetTransformIssue||cutterTransformIssue)return {success:false,error:`Boolean pair "${object.id}" is invalid: ${targetTransformIssue??cutterTransformIssue}`};
      try {
        const evaluated=createSubtractedGeometry(object,cutter);
        evaluated.dispose();
      } catch(error) {
        return {success:false,error:`Boolean pair "${object.id}" cannot be evaluated: ${error instanceof Error?error.message:'invalid geometry'}`};
      }
    }
    if (object.holeForId) {
      const target=objects.find(candidate=>candidate.id===object.holeForId);
      if (!target || target.boolean?.cutterId !== object.id) return { success: false, error: `Object "${object.id}" has a missing or inconsistent Boolean target.` };
    }
  }
  return { success: true, data: objects };
}

export function isEnvironmentTheme(value: unknown): value is EnvironmentTheme {
  return isString(value) && THEMES.includes(value as EnvironmentTheme);
}

export function validateEnvironmentSettings(value: unknown): ValidationResult<EnvironmentSettings> {
  if (!isRecord(value)) return { success: false, error: 'Project environment must be an object.' };
  if (!isEnvironmentTheme(value.theme)) return { success: false, error: 'Project environment has an invalid theme.' };
  if (!isString(value.shadowQuality) || !SHADOW_QUALITIES.includes(value.shadowQuality as EnvironmentSettings['shadowQuality'])) return { success: false, error: 'Project environment has an invalid shadowQuality.' };
  if (!isNonEmptyString(value.backgroundColor)) return { success: false, error: 'Project environment has an invalid or missing backgroundColor.' };
  for (const field of ['sunElevation', 'sunAzimuth', 'intensity', 'gridStep', 'fogDensity', 'bloomIntensity'] as const) {
    if (!isFiniteNumber(value[field])) return { success: false, error: `Project environment has an invalid or missing ${field}.` };
  }
  for (const field of ['shadows', 'gridVisible', 'gridSnap', 'bloom', 'ao'] as const) {
    if (!isBoolean(value[field])) return { success: false, error: `Project environment has an invalid or missing ${field}.` };
  }
  return { success: true, data: value as unknown as EnvironmentSettings };
}

export function validateProjectData(value: unknown): ValidationResult<ProjectData> {
  if (!isRecord(value)) return { success: false, error: 'Project must be a JSON object.' };
  for (const field of ['id', 'name', 'createdAt', 'updatedAt'] as const) {
    if (!isNonEmptyString(value[field])) return { success: false, error: `Project has an invalid or missing ${field}.` };
  }
  if (value.thumbnailUrl !== undefined && !isString(value.thumbnailUrl)) return { success: false, error: 'Project has an invalid thumbnailUrl.' };
  const objects = validateSceneObjects(value.objects);
  if ('error' in objects) return { success: false, error: objects.error };
  const environment = validateEnvironmentSettings(value.environment);
  if ('error' in environment) return { success: false, error: environment.error };
  return { success: true, data: value as unknown as ProjectData };
}

/**
 * Migrates only the one known historical format: the legacy generator stored its
 * allow-listed asset types under `architecture`, irrespective of their catalog
 * category. The input is never mutated and all other pairs remain untouched so
 * normal validation can reject them.
 */
export function normalizeLegacyProjectData(value: unknown): unknown {
  if (!isRecord(value) || !Array.isArray(value.objects)) return value;
  let changed = false;
  const objects = value.objects.map((object) => {
    if (!isRecord(object) || object.category !== 'architecture' || !isString(object.type) || !LEGACY_ARCHITECTURE_TYPES.has(object.type)) return object;
    const category = getAssetCategory(object.type);
    if (!category || category === object.category) return object;
    changed = true;
    return { ...object, category };
  });
  return changed ? { ...value, objects } : value;
}

export function normalizeAndValidateProjectData(value: unknown): ValidationResult<ProjectData> {
  return validateProjectData(normalizeLegacyProjectData(value));
}
