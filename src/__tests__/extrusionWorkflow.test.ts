import { describe, expect, it, vi } from 'vitest';
import { createExtrusionInteraction, handleExtrusionRangeKeyDown } from '../utils/extrusionInteraction';
import { DEFAULT_PARAMETRIC_EXTRUSION } from '../utils/parametricExtrusion';
import { getInitialProject } from '../utils/storage';
import { validateProjectData } from '../utils/projectValidation';
import type { ParametricExtrusionGeometry, ProjectData, SceneObject } from '../types';

function mountedWorkflow() {
  vi.useFakeTimers();
  let project = structuredClone(getInitialProject());
  const extrusion: SceneObject = { ...project.objects[0], id: 'extrusion', type: 'parametric-extrusion', geometry: structuredClone(DEFAULT_PARAMETRIC_EXTRUSION) };
  project = { ...project, objects: [...project.objects, extrusion] };
  const initial = structuredClone(project);
  const history: ProjectData[] = [initial];
  let index = 0;
  let draft: ParametricExtrusionGeometry | null = extrusion.geometry!;
  let rendered: SceneObject | null = null;
  let persisted = structuredClone(project);
  const cloudSave = vi.fn();
  let autosave: ReturnType<typeof setTimeout> | null = null;
  const schedulePersistence = () => {
    if (rendered) return;
    autosave = setTimeout(() => cloudSave(project), 1200);
  };
  const interaction = createExtrusionInteraction({
    getSelected: () => project.objects.find(object => object.id === 'extrusion'),
    getDraft: () => draft,
    setDraft: next => { draft = next; },
    preview: next => { rendered = next; },
    commit: next => {
      rendered = null;
      project = { ...project, objects: project.objects.map(object => object.id === next.id ? next : object) };
      history.splice(index + 1); history.push(structuredClone(project)); index = history.length - 1;
      persisted = structuredClone(project); schedulePersistence();
    },
    requestFrame: callback => setTimeout(callback, 0) as unknown as number,
    cancelFrame: handle => clearTimeout(handle),
  });
  return {
    interaction, history, cloudSave,
    project: () => project, rendered: () => rendered, persisted: () => persisted,
    undo: () => { if (index > 0) project = structuredClone(history[--index]); },
    redo: () => { if (index < history.length - 1) project = structuredClone(history[++index]); },
    dispose: () => { if (autosave) clearTimeout(autosave); interaction.dispose(); vi.useRealTimers(); },
  };
}

describe('extrusion interaction orchestration', () => {
  it('contains range Escape before cancelling so the global selection handler cannot receive it', () => {
    const calls: string[] = [];
    const handled = handleExtrusionRangeKeyDown({
      key: 'Escape',
      preventDefault: () => calls.push('preventDefault'),
      stopPropagation: () => calls.push('stopPropagation'),
    }, () => calls.push('cancel'));

    expect(handled).toBe(true);
    expect(calls).toEqual(['preventDefault', 'stopPropagation', 'cancel']);
  });

  it('leaves unrelated range keys untouched', () => {
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();
    const cancel = vi.fn();

    expect(handleExtrusionRangeKeyDown({ key: 'ArrowRight', preventDefault, stopPropagation }, cancel)).toBe(false);
    expect(preventDefault).not.toHaveBeenCalled();
    expect(stopPropagation).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
  });

  it.each(['Escape', 'pointercancel'])('%s cancels a preview with no history or persistence', event => {
    const workflow = mountedWorkflow();
    workflow.interaction.preview({ height: 2 }); vi.advanceTimersByTime(1300);
    expect(workflow.rendered()?.geometry?.height).toBe(2);
    event === 'Escape' ? workflow.interaction.cancel() : workflow.interaction.cancel();
    expect(workflow.rendered()).toBeNull(); expect(workflow.history).toHaveLength(1);
    expect(workflow.cloudSave).not.toHaveBeenCalled();
    expect(workflow.persisted().objects.at(-1)?.geometry?.height).toBe(1);
    workflow.dispose();
  });

  it('suppresses long-draft persistence, commits once, supports undo/redo, and round-trips', () => {
    const workflow = mountedWorkflow();
    workflow.interaction.preview({ height: 2.4, twistAngle: 90 }); vi.advanceTimersByTime(1300);
    expect(workflow.cloudSave).not.toHaveBeenCalled(); expect(workflow.history).toHaveLength(1);
    workflow.interaction.commit(); expect(workflow.history).toHaveLength(2);
    expect(workflow.project().objects.at(-1)?.geometry?.height).toBe(2.4);
    workflow.undo(); expect(workflow.project().objects.at(-1)?.geometry?.height).toBe(1);
    workflow.redo(); expect(workflow.project().objects.at(-1)?.geometry?.height).toBe(2.4);
    vi.advanceTimersByTime(1200); expect(workflow.cloudSave).toHaveBeenCalledTimes(1);
    const loaded = validateProjectData(JSON.parse(JSON.stringify(workflow.persisted())));
    expect(loaded.success).toBe(true);
    if (loaded.success) expect(loaded.data.objects.at(-1)?.geometry?.twistAngle).toBe(90);
    workflow.dispose();
  });
});
