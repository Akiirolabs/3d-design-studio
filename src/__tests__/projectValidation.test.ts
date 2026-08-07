import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ENVIRONMENT, getInitialProject, loadSavedProjects } from '../utils/storage';
import { validateProjectData, validateSceneObjects } from '../utils/projectValidation';

describe('project data validation', () => {
  const values = new Map<string, string>();
  const localStorageMock = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  };

  beforeEach(() => {
    values.clear();
    vi.stubGlobal('localStorage', localStorageMock);
    vi.stubGlobal('window', { localStorage: localStorageMock });
  });

  it('accepts a complete project', () => {
    expect(validateProjectData(getInitialProject()).success).toBe(true);
  });

  it.each([
    ['missing environment', (project: any) => delete project.environment],
    ['wrong field type', (project: any) => { project.objects[0].visible = 'yes'; }],
    ['non-finite number', (project: any) => { project.objects[0].position[1] = Infinity; }],
    ['invalid tuple', (project: any) => { project.objects[0].scale = [1, 1]; }],
    ['duplicate IDs', (project: any) => { project.objects.push({ ...project.objects[0] }); }],
  ])('rejects %s', (_label, mutate) => {
    const project: any = structuredClone(getInitialProject());
    mutate(project);
    expect(validateProjectData(project).success).toBe(false);
  });

  it('rejects malformed AI object arrays', () => {
    expect(validateSceneObjects([{ id: 'bad', position: [0, 0] }]).success).toBe(false);
  });

  it('falls back when current local storage contains structurally invalid data', () => {
    localStorage.setItem('aether3d_studio_current_project', JSON.stringify({ objects: [] }));
    expect(getInitialProject().id).toBe('proj_demo_architectural');
  });

  it('falls back when saved-project storage contains invalid entries', () => {
    localStorage.setItem('aether3d_studio_saved_projects', JSON.stringify([{ objects: [] }]));
    expect(loadSavedProjects()).toHaveLength(1);
    expect(loadSavedProjects()[0].environment).toEqual(DEFAULT_ENVIRONMENT);
  });
});
