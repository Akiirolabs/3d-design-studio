# Quality Gates

Apply gates in this order. Record unavailable gates instead of skipping them silently.

## Automated gates

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

Run focused tests before the full suite when a narrower command exists. Do not install dependencies automatically.

## Core functional scenario

Verify the real application workflow, not only recreated state objects:

```text
Add -> Select -> Move -> Rotate -> Scale -> Switch selection -> Undo -> Redo
-> Duplicate -> Hide -> Lock -> Delete -> Save -> Reload -> Export
```

Verify each action preserves unrelated object transforms and creates the intended number of undo entries.

## Three.js integrity

- No transform drift when selection changes.
- Matrices are current before attachment and raycasting and after transforms.
- Hidden and locked behavior matches the UI contract.
- Gizmo interactions do not change selection accidentally.
- Removed and replaced resources, helpers, listeners, controls, render targets, and animation work are disposed.
- Repeated add/delete cycles do not show unbounded resource growth.
- Dragging remains responsive as object count grows.

## Data and recovery

- Validate imported, persisted, and AI-generated project data.
- Invalid data fails safely with an actionable message.
- Storage failure is visible and does not falsely report success.
- Exported data can be imported back without losing supported state.

## Review gate

- Diff contains no unrelated edits, secrets, generated artifacts, or debug logging.
- Tests were not weakened to obtain a pass.
- No critical or high DevMind finding remains confirmed.
- DevMind reviews the final diff after the last DevBase edit.
