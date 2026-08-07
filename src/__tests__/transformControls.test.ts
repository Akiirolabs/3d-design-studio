import { describe, expect, it, vi } from 'vitest';
import { canTransformSelection, createFrameCoalescer, getDragTransition } from '../utils/transformControls';

describe('transform control helpers', () => {
  it('coalesces live transforms to the latest value in one animation frame', () => {
    let scheduledCallback: FrameRequestCallback | undefined;
    const requestFrame = vi.fn((callback: FrameRequestCallback) => {
      scheduledCallback = callback;
      return 7;
    });
    const deliver = vi.fn();
    const coalescer = createFrameCoalescer(requestFrame, vi.fn(), deliver);

    coalescer.schedule('first');
    coalescer.schedule('latest');

    expect(requestFrame).toHaveBeenCalledTimes(1);
    scheduledCallback?.(0);
    expect(deliver).toHaveBeenCalledOnce();
    expect(deliver).toHaveBeenCalledWith('latest');
  });

  it('cancels a pending live transform so it cannot run after commit or cleanup', () => {
    let scheduledCallback: FrameRequestCallback | undefined;
    const cancelFrame = vi.fn();
    const deliver = vi.fn();
    const coalescer = createFrameCoalescer(
      (callback) => {
        scheduledCallback = callback;
        return 11;
      },
      cancelFrame,
      deliver
    );

    coalescer.schedule('stale');
    coalescer.cancel();
    scheduledCallback?.(0);

    expect(cancelFrame).toHaveBeenCalledWith(11);
    expect(deliver).not.toHaveBeenCalled();
  });

  it('only allows visible, unlocked selections to use transform controls', () => {
    const object = { visible: true, locked: false } as Parameters<typeof canTransformSelection>[0];

    expect(canTransformSelection(object)).toBe(true);
    expect(canTransformSelection({ ...object, visible: false })).toBe(false);
    expect(canTransformSelection({ ...object, locked: true })).toBe(false);
    expect(canTransformSelection(undefined)).toBe(false);
  });

  it('ends a drag exactly once when duplicate finish events are received', () => {
    let isDragging = false;
    let commitCount = 0;
    const objectChange = vi.fn();
    const handleDraggingChanged = (value: unknown) => {
      const transition = getDragTransition(isDragging, value);
      isDragging = transition.isDragging;
      if (transition.ended) commitCount += 1;
    };

    handleDraggingChanged(true);
    objectChange();
    objectChange();
    handleDraggingChanged(false);
    handleDraggingChanged(false);

    expect(objectChange).toHaveBeenCalledTimes(2);
    expect(commitCount).toBe(1);
  });

  it('does not end or commit a drag that never started', () => {
    const transition = getDragTransition(false, false);

    expect(transition).toEqual({ isDragging: false, started: false, ended: false });
  });
});
