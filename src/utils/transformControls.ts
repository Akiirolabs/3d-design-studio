import { SceneObject } from '../types';

export interface FrameCoalescer<T> {
  schedule: (value: T) => void;
  cancel: () => void;
}

export function createFrameCoalescer<T>(
  requestFrame: (callback: FrameRequestCallback) => number,
  cancelFrame: (handle: number) => void,
  callback: (value: T) => void
): FrameCoalescer<T> {
  let frameHandle: number | null = null;
  let pendingValue: T | null = null;

  return {
    schedule(value) {
      pendingValue = value;
      if (frameHandle !== null) return;

      frameHandle = requestFrame(() => {
        frameHandle = null;
        const valueToDeliver = pendingValue;
        pendingValue = null;
        if (valueToDeliver !== null) callback(valueToDeliver);
      });
    },
    cancel() {
      if (frameHandle !== null) cancelFrame(frameHandle);
      frameHandle = null;
      pendingValue = null;
    },
  };
}

export function canTransformSelection(object: SceneObject | undefined): boolean {
  return Boolean(object?.visible && !object.locked);
}

export interface DragTransition {
  isDragging: boolean;
  started: boolean;
  ended: boolean;
}

export function getDragTransition(wasDragging: boolean, value: unknown): DragTransition {
  const isDragging = Boolean(value);
  return {
    isDragging,
    started: !wasDragging && isDragging,
    ended: wasDragging && !isDragging,
  };
}
