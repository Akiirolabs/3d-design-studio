import { describe, expect, it } from 'vitest';
import type { SceneObject } from '../types';
import { alignSelectedObjectPivots, getAlignmentIssue, reconcileSelection, resolvePrimaryActionId, selectObject } from '../utils/multiSelection';

const object = (id: string, position: [number, number, number], overrides: Partial<SceneObject> = {}): SceneObject => ({
  id, name: id, type: 'cube', category: 'primitives', position,
  rotation: [15, 30, 45], scale: [2, 3, 4], color: '#fff', materialPreset: 'plastic',
  metalness: 0, roughness: 0.5, transmission: 0, visible: true, locked: false, ...overrides,
});

describe('multi-selection', () => {
  it('single-selects normally and Shift toggles while updating the primary', () => {
    let state = selectObject({ ids: ['a'], primaryId: 'a' }, 'b');
    expect(state).toEqual({ ids: ['b'], primaryId: 'b' });
    state = selectObject(state, 'c', true);
    expect(state).toEqual({ ids: ['b', 'c'], primaryId: 'c' });
    state = selectObject(state, 'c', true);
    expect(state).toEqual({ ids: ['b'], primaryId: 'b' });
  });

  it.each([
    [0, 'min', 1], [0, 'center', 3], [0, 'max', 5],
    [1, 'min', 2], [1, 'center', 4], [1, 'max', 6],
    [2, 'min', 3], [2, 'center', 5], [2, 'max', 7],
  ] as const)('aligns %s axis pivots to %s without transform drift', (axis, mode, expected) => {
    const unchanged = object('other', [9, 9, 9]);
    const before = [object('a', [1, 2, 3]), object('b', [5, 6, 7]), unchanged];
    const result = alignSelectedObjectPivots(before, ['a', 'b'], axis, mode)!;
    expect(result[0].position[axis]).toBe(expected);
    expect(result[1].position[axis]).toBe(expected);
    expect(result[0].rotation).toEqual(before[0].rotation);
    expect(result[0].scale).toEqual(before[0].scale);
    expect(result[2]).toBe(unchanged);
  });

  it('rejects locked or hidden selections atomically', () => {
    expect(alignSelectedObjectPivots([object('a', [0, 0, 0]), object('b', [1, 1, 1], { locked: true })], ['a', 'b'], 0, 'min')).toBeNull();
    expect(alignSelectedObjectPivots([object('a', [0, 0, 0]), object('b', [1, 1, 1], { visible: false })], ['a', 'b'], 0, 'min')).toBeNull();
  });

  it('explains the exact object blocking alignment', () => {
    expect(getAlignmentIssue([object('a', [0, 0, 0]), object('b', [1, 1, 1], { name: 'Case', locked: true })], ['a', 'b'])).toBe('Unlock “Case” before aligning.');
    expect(getAlignmentIssue([object('a', [0, 0, 0]), object('b', [1, 1, 1], { name: 'Screen', visible: false })], ['a', 'b'])).toBe('Show “Screen” before aligning.');
  });

  it('atomically reconciles primary and additional selection after project replacement', () => {
    expect(reconcileSelection([object('b', [0, 0, 0])], { ids: ['a', 'b'], primaryId: 'a' })).toEqual({ ids: ['b'], primaryId: 'b' });
    expect(reconcileSelection([], { ids: ['a'], primaryId: 'a' }, true)).toEqual({ ids: [], primaryId: null });
    expect(reconcileSelection([object('hidden', [0, 0, 0], { visible: false }), object('shown', [0, 0, 0])], { ids: [], primaryId: null }, true)).toEqual({ ids: ['shown'], primaryId: 'shown' });
  });

  it('targets only the primary object for duplicate and delete actions', () => {
    const objects = [object('a', [0, 0, 0]), object('b', [1, 1, 1])];
    expect(resolvePrimaryActionId(objects, { ids: ['a', 'b'], primaryId: 'b' })).toBe('b');
    expect(resolvePrimaryActionId(objects, { ids: ['a'], primaryId: 'b' })).toBeNull();
  });

  it('aligns 100 objects deterministically without changing selection data', () => {
    const objects = Array.from({ length: 100 }, (_, index) => object(String(index), [index, index % 7, index % 11]));
    const ids = objects.map(item => item.id);
    const first = alignSelectedObjectPivots(objects, ids, 0, 'center')!;
    const second = alignSelectedObjectPivots(objects, ids, 0, 'center')!;
    expect(first).toEqual(second);
    expect(new Set(first.map(item => item.position[0]))).toEqual(new Set([49.5]));
    expect(ids).toHaveLength(100);
  });
});
