import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ASSET_TYPE_CATEGORIES, LEGACY_ARCHITECTURE_TYPES } from '../utils/assetCatalog';
import { DEFAULT_ENVIRONMENT, getInitialProject, loadSavedProjects, saveProjectToStorage } from '../utils/storage';
import { normalizeAndValidateProjectData, validateProjectData, validateSceneObjects } from '../utils/projectValidation';

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
    vi.restoreAllMocks();
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

  it('rejects unsupported catalog types at current-project and saved-project storage boundaries', () => {
    const invalid = structuredClone(getInitialProject());
    invalid.objects[0].type = 'unknown-imported-type';
    localStorage.setItem('aether3d_studio_current_project', JSON.stringify(invalid));
    expect(getInitialProject().objects.some((object) => object.type === 'unknown-imported-type')).toBe(false);

    localStorage.setItem('aether3d_studio_saved_projects', JSON.stringify([invalid]));
    expect(loadSavedProjects().some((project) => project.objects.some((object) => object.type === 'unknown-imported-type'))).toBe(false);
  });

  it('rejects mismatched catalog pairs through full project validation before import', () => {
    const invalid = structuredClone(getInitialProject());
    invalid.objects[0].type = 'cube';
    invalid.objects[0].category = 'technology';
    const result = validateProjectData(invalid);
    expect(result.success).toBe(false);
    if ('error' in result) expect(result.error).toContain('belongs to category "primitives"');
  });

  it('normalizes every allow-listed historical architecture pair without mutating the source', () => {
    for (const type of LEGACY_ARCHITECTURE_TYPES) {
      const legacy = structuredClone(getInitialProject());
      legacy.objects = [{ ...legacy.objects[0], id: `legacy-${type}`, type, category: 'architecture' }];
      const result = normalizeAndValidateProjectData(legacy);
      expect(result.success, type).toBe(true);
      if (result.success) expect(result.data.objects[0].category).toBe(ASSET_TYPE_CATEGORIES.get(type));
      expect(legacy.objects[0].category).toBe('architecture');
    }
  });

  it('migrates historical current and saved local projects to canonical categories', () => {
    const legacy = structuredClone(getInitialProject());
    legacy.id = 'legacy-local';
    legacy.objects = legacy.objects.map((object) => ({ ...object, category: 'architecture' }));
    expect(legacy.objects.find((object) => object.id === 'obj_floor')).toMatchObject({
      name: 'Architectural Floor', type: 'plane', category: 'architecture',
    });
    localStorage.setItem('aether3d_studio_current_project', JSON.stringify(legacy));
    localStorage.setItem('aether3d_studio_saved_projects', JSON.stringify([legacy]));

    for (const project of [getInitialProject(), loadSavedProjects()[0]]) {
      expect(project.id).toBe('legacy-local');
      for (const object of project.objects) expect(object.category).toBe(ASSET_TYPE_CATEGORIES.get(object.type));
      expect(project.objects.find((object) => object.id === 'obj_floor')?.category).toBe('primitives');
    }
  });

  it('persists historical current and saved-array entries canonically and remains idempotent across reloads', () => {
    const legacy = structuredClone(getInitialProject());
    legacy.id = 'browser-legacy';
    legacy.objects[0] = { ...legacy.objects[0], type: 'plane', category: 'architecture' };
    localStorage.setItem('aether3d_studio_current_project', JSON.stringify(legacy));
    localStorage.setItem('aether3d_studio_saved_projects', JSON.stringify([legacy]));
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(getInitialProject().objects[0].category).toBe('primitives');
    expect(loadSavedProjects()[0].objects[0].category).toBe('primitives');
    const firstCurrent = localStorage.getItem('aether3d_studio_current_project');
    const firstSaved = localStorage.getItem('aether3d_studio_saved_projects');

    expect(getInitialProject().objects[0].category).toBe('primitives');
    expect(loadSavedProjects()[0].objects[0].category).toBe('primitives');
    expect(localStorage.getItem('aether3d_studio_current_project')).toBe(firstCurrent);
    expect(localStorage.getItem('aether3d_studio_saved_projects')).toBe(firstSaved);
    expect(error).not.toHaveBeenCalled();
  });

  it('canonicalizes save writes and refuses to create inverse or unknown mismatches', () => {
    const legacy = structuredClone(getInitialProject());
    legacy.id = 'save-legacy';
    legacy.objects[0] = { ...legacy.objects[0], type: 'plane', category: 'architecture' };
    saveProjectToStorage(legacy);
    expect(JSON.parse(localStorage.getItem('aether3d_studio_current_project')!).objects[0].category).toBe('primitives');
    expect(JSON.parse(localStorage.getItem('aether3d_studio_saved_projects')!)[0].objects[0].category).toBe('primitives');

    const canonicalCurrent = localStorage.getItem('aether3d_studio_current_project');
    const canonicalSaved = localStorage.getItem('aether3d_studio_saved_projects');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    for (const [type, category] of [['plane', 'technology'], ['invented-shape', 'architecture']] as const) {
      const invalid = structuredClone(legacy);
      invalid.objects[0] = { ...invalid.objects[0], type, category };
      saveProjectToStorage(invalid);
    }
    expect(localStorage.getItem('aether3d_studio_current_project')).toBe(canonicalCurrent);
    expect(localStorage.getItem('aether3d_studio_saved_projects')).toBe(canonicalSaved);
    expect(error).toHaveBeenCalledTimes(2);
  });

  it('reports and removes corrupt saved-array entries once without hiding valid designs', () => {
    const valid = structuredClone(getInitialProject());
    const invalid = structuredClone(valid);
    invalid.id = 'corrupt';
    invalid.objects[0] = { ...invalid.objects[0], type: 'plane', category: 'technology' };
    localStorage.setItem('aether3d_studio_saved_projects', JSON.stringify([valid, invalid]));
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(loadSavedProjects()).toHaveLength(1);
    expect(error).toHaveBeenCalledTimes(1);
    expect(loadSavedProjects()).toHaveLength(1);
    expect(error).toHaveBeenCalledTimes(1);
  });

  it('does not normalize unknown types or non-historical mismatches', () => {
    for (const [type, category] of [['invented-shape', 'architecture'], ['cube', 'technology'], ['plane', 'technology']] as const) {
      const invalid = structuredClone(getInitialProject());
      invalid.objects = [{ ...invalid.objects[0], type, category }];
      expect(normalizeAndValidateProjectData(invalid).success, `${type}:${category}`).toBe(false);
    }
  });
});
