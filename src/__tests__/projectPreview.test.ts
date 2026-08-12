import { describe, expect, it, vi } from 'vitest';
import { canPersistProject, objectsWithPreview } from '../utils/projectPreview';
import { getInitialProject } from '../utils/storage';

describe('render-only project previews', () => {
  it('never mutates or exposes the draft through persistence/autosave state', () => {
    vi.useFakeTimers();
    const project = structuredClone(getInitialProject());
    const committed = project.objects[0];
    const draft = { ...committed, position: [9, 9, 9] as [number, number, number] };
    const save = vi.fn();
    const rendered = objectsWithPreview(project, draft);
    if (canPersistProject(draft)) setTimeout(() => save(project), 1200);
    vi.advanceTimersByTime(1500);
    expect(rendered[0]).toBe(draft);
    expect(project.objects[0]).toBe(committed);
    expect(save).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('cancels without changing committed state and commits as one explicit state', () => {
    const project = structuredClone(getInitialProject());
    const draft = { ...project.objects[0], scale: [2, 2, 2] as [number, number, number] };
    expect(objectsWithPreview(project, draft)[0]).toBe(draft);
    expect(objectsWithPreview(project, null)).toBe(project.objects);
    const history = [project];
    const committed = { ...project, objects: objectsWithPreview(project, draft) };
    history.push(committed);
    expect(history).toHaveLength(2);
    expect(history[0].objects[0].scale).not.toEqual([2, 2, 2]);
    expect(history[1].objects[0].scale).toEqual([2, 2, 2]);
  });
});
