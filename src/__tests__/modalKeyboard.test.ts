import { describe, expect, it } from 'vitest';
import { focusTrapTarget, viewportInputPolicy } from '../utils/modalKeyboard';

describe('settings focus trap', () => {
  it('wraps Tab from the final control to the first', () => expect(focusTrapTarget(4, 5, false)).toBe(0));
  it('wraps Shift+Tab from the first control to the final', () => expect(focusTrapTarget(0, 5, true)).toBe(4));
  it('does not interfere with movement inside the dialog', () => expect(focusTrapTarget(2, 5, false)).toBeNull());
  it('handles an empty dialog safely', () => expect(focusTrapTarget(-1, 0, false)).toBeNull());
  it('moves external focus to the first control on Tab', () => expect(focusTrapTarget(-1, 5, false)).toBe(0));
  it('moves external focus to the last control on Shift+Tab', () => expect(focusTrapTarget(-1, 5, true)).toBe(4));
});

describe('settings viewport suspension', () => {
  it('restores pan and disables orbit and transforms while settings is open', () => {
    expect(viewportInputPolicy(true, false)).toEqual({ rightButton: 'pan', orbitEnabled: false, transformEnabled: false });
  });
  it('reenables viewport input safely after settings closes', () => {
    expect(viewportInputPolicy(false, false)).toEqual({ rightButton: 'pan', orbitEnabled: true, transformEnabled: true });
  });
  it('does not reenable orbit during an active transform', () => {
    expect(viewportInputPolicy(false, true).orbitEnabled).toBe(false);
  });
});
