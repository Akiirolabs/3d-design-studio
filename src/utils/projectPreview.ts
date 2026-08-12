import type { ProjectData, SceneObject } from '../types';

/** Returns a render-only object list. The persisted project is never mutated. */
export function objectsWithPreview(project: ProjectData, preview: SceneObject | null): SceneObject[] {
  if (!preview) return project.objects;
  return project.objects.map(object => object.id === preview.id ? preview : object);
}

export function canPersistProject(preview: SceneObject | null): boolean {
  return preview === null;
}
