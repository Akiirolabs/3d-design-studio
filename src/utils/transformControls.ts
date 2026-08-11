import { SceneObject } from '../types';

export const TRANSFORM_SNAPS = Object.freeze({
  translation: 0.2,
  rotationDegrees: 15,
  scale: 0.25,
});

interface SnappableTransformControls {
  setTranslationSnap(value: number | null): unknown;
  setRotationSnap(value: number | null): unknown;
  setScaleSnap(value: number | null): unknown;
}

export function configureTransformSnapping(controls: SnappableTransformControls, enabled: boolean): void {
  controls.setTranslationSnap(enabled ? TRANSFORM_SNAPS.translation : null);
  controls.setRotationSnap(enabled ? TRANSFORM_SNAPS.rotationDegrees * Math.PI / 180 : null);
  controls.setScaleSnap(enabled ? TRANSFORM_SNAPS.scale : null);
}

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
