import type { ParametricExtrusionGeometry, SceneObject } from '../types';
import { minimumTwistSteps } from './parametricExtrusion';

type FrameHandle = number;

interface ExtrusionInteractionOptions {
  getSelected: () => SceneObject | undefined;
  getDraft: () => ParametricExtrusionGeometry | null;
  setDraft: (draft: ParametricExtrusionGeometry | null) => void;
  preview: (object: SceneObject | null) => void;
  commit: (object: SceneObject) => void;
  requestFrame: (callback: () => void) => FrameHandle;
  cancelFrame: (handle: FrameHandle) => void;
}

type EscapeKeyEvent = Pick<KeyboardEvent, 'key' | 'preventDefault' | 'stopPropagation'>;

/** Keeps a range-input Escape cancellation local to the active extrusion edit. */
export function handleExtrusionRangeKeyDown(event: EscapeKeyEvent, cancel: () => void) {
  if (event.key !== 'Escape') return false;
  event.preventDefault();
  event.stopPropagation();
  cancel();
  return true;
}

/** Coordinates a render-only extrusion draft and one explicit history commit. */
export function createExtrusionInteraction(options: ExtrusionInteractionOptions) {
  let original: SceneObject | null = null;
  let frame: FrameHandle | null = null;
  let pending: SceneObject | null = null;

  const clearFrame = () => {
    if (frame !== null) options.cancelFrame(frame);
    frame = null;
    pending = null;
  };

  return {
    preview(patch: Partial<ParametricExtrusionGeometry>) {
      const selected = options.getSelected();
      if (!selected?.geometry) return;
      if (!original) original = selected;
      const next = { ...(options.getDraft() ?? selected.geometry), ...patch };
      next.twistSteps = Math.max(next.twistSteps, minimumTwistSteps(next.twistAngle));
      options.setDraft(next);
      pending = { ...selected, geometry: next };
      if (frame === null) frame = options.requestFrame(() => {
        frame = null;
        if (pending) options.preview(pending);
        pending = null;
      });
    },
    commit() {
      if (!original) return;
      const draft = options.getDraft();
      const start = original;
      clearFrame();
      original = null;
      if (draft) options.commit({ ...start, geometry: draft });
    },
    cancel() {
      if (!original) return;
      const start = original;
      clearFrame();
      original = null;
      options.setDraft(start.geometry ?? null);
      options.preview(null);
    },
    dispose() {
      clearFrame();
      original = null;
    },
  };
}
