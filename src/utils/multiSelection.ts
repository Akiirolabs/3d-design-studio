import type { SceneObject } from '../types';

export type AlignmentAxis = 0 | 1 | 2;
export type AlignmentMode = 'min' | 'center' | 'max';

export interface SelectionState {
  ids: string[];
  primaryId: string | null;
}

/** Keeps selection valid when an entire project is replaced. */
export function reconcileSelection(
  objects: SceneObject[],
  current: SelectionState,
  fallbackToFirst = false,
): SelectionState {
  const available = new Set(objects.filter(object => object.visible).map(object => object.id));
  const ids = current.ids.filter(id => available.has(id));
  const primaryId = current.primaryId && ids.includes(current.primaryId)
    ? current.primaryId
    : (ids.at(-1) ?? (fallbackToFirst ? objects.find(object => object.visible)?.id ?? null : null));
  return primaryId && ids.length === 0 ? { ids: [primaryId], primaryId } : { ids, primaryId };
}

export function getAlignmentIssue(objects: SceneObject[], selectedIds: string[]): string | null {
  const selected = objects.filter(object => selectedIds.includes(object.id));
  if (selected.length < 2) return 'Select at least two objects.';
  const missingCount = selectedIds.length - selected.length;
  if (missingCount > 0) return `${missingCount} selected object${missingCount === 1 ? ' is' : 's are'} missing.`;
  const locked = selected.find(object => object.locked);
  if (locked) return `Unlock “${locked.name}” before aligning.`;
  const hidden = selected.find(object => !object.visible);
  if (hidden) return `Show “${hidden.name}” before aligning.`;
  return null;
}

/** Resolves keyboard/Inspector actions to the primary selection only. */
export function resolvePrimaryActionId(objects: SceneObject[], selection: SelectionState): string | null {
  return selection.primaryId && selection.ids.includes(selection.primaryId) && objects.some(object => object.id === selection.primaryId)
    ? selection.primaryId
    : null;
}

export function selectObject(
  current: SelectionState,
  id: string | null,
  additive = false,
): SelectionState {
  if (id === null) return additive ? current : { ids: [], primaryId: null };
  if (!additive) return { ids: [id], primaryId: id };
  if (current.ids.includes(id)) {
    const ids = current.ids.filter(candidate => candidate !== id);
    return { ids, primaryId: current.primaryId === id ? (ids.at(-1) ?? null) : current.primaryId };
  }
  return { ids: [...current.ids, id], primaryId: id };
}

/** Aligns object pivots. Rotation and scale remain untouched and every eligible object moves deterministically. */
export function alignSelectedObjectPivots(
  objects: SceneObject[],
  selectedIds: string[],
  axis: AlignmentAxis,
  mode: AlignmentMode,
): SceneObject[] | null {
  const selected = objects.filter(object => selectedIds.includes(object.id));
  if (getAlignmentIssue(objects, selectedIds)) return null;
  const values = selected.map(object => object.position[axis]);
  const target = mode === 'min'
    ? Math.min(...values)
    : mode === 'max'
      ? Math.max(...values)
      : values.reduce((sum, value) => sum + value, 0) / values.length;
  const selectedSet = new Set(selectedIds);
  return objects.map(object => {
    if (!selectedSet.has(object.id)) return object;
    const position = [...object.position] as [number, number, number];
    position[axis] = target;
    return { ...object, position };
  });
}
