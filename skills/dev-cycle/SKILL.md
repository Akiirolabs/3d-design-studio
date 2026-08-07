---
name: dev-cycle
description: Coordinate bounded autonomous improvement cycles between DevMind, an independent read-only auditor, and DevBase, a scoped implementation engineer. Use when asked to repeatedly audit, fix, test, and re-audit this application until objective quality gates pass or a defined blocker or iteration limit is reached. Never commit, push, deploy, install dependencies, or handle secrets without explicit user approval.
---

# Dev Cycle

Run an evidence-driven audit and repair loop. Aim for all defined gates to pass; never claim software is perfect.

Read [quality-gates.md](references/quality-gates.md) before starting a cycle.

## Roles

- **DevMind:** independent, read-only auditor. Inspect code, diffs, tests, logs, performance risks, and gate results. Do not edit files.
- **DevBase:** implementation engineer. Confirm findings, make minimal fixes, add regression tests, and run checks. Do not approve its own work.
- **Orchestrator:** maintain cycle state, enforce authority limits, pass raw evidence between roles, and decide whether to continue or stop.

When agent delegation is available and authorized, use separate fresh agents for DevMind and DevBase. Give each only the role, repository scope, current acceptance criteria, and raw artifacts it needs. Do not leak the expected conclusion to DevMind. When delegation is unavailable, perform clearly separated sequential passes and re-read the resulting diff before the audit pass.

## Cycle protocol

Default to at most 6 cycles unless the user specifies a lower limit.

1. **Baseline:** inspect repository instructions and working-tree state. Run available gates before editing. Record pre-existing failures separately.
2. **Audit:** have DevMind produce prioritized findings containing severity, exact evidence, reproduction steps, user impact, and measurable acceptance criteria.
3. **Select:** address critical and high findings first. Group only fixes that are tightly related. Do not expand scope to cosmetic improvements while functional failures remain.
4. **Implement:** have DevBase confirm and fix selected findings, add regression coverage, and return its handoff.
5. **Verify:** run relevant focused tests and every available gate in `quality-gates.md`. Record exact commands and results.
6. **Re-audit:** give DevMind the current diff and raw verification results. DevMind must classify each selected finding as resolved, unresolved, regressed, or unverified and identify any newly introduced issue.
7. **Decide:** finish only when the completion criteria are satisfied. Otherwise begin the next bounded cycle with unresolved actionable findings.

## Completion criteria

Finish with `PASSED WITHIN DEFINED GATES` only when:

- every available automated gate passes;
- no confirmed critical or high finding remains;
- selected functional scenarios pass;
- regression tests cover fixed defects where practical;
- DevMind approves the final diff;
- no unreviewed DevBase change follows that approval.

Report unavailable gates explicitly. Never translate unavailable verification into a pass.

## Hard stops

Stop and request user direction when:

- 6 cycles are exhausted;
- the same failure survives two attempted fixes;
- tests cannot run because dependencies or infrastructure are unavailable;
- a fix requires dependency installation or upgrades, secrets, external services, billing, production access, destructive data changes, or a major architecture/product decision;
- requirements are ambiguous or contradictory;
- the working tree contains overlapping user changes that cannot be preserved safely;
- the next change cannot be validated objectively;
- two consecutive cycles show no measurable improvement.

## Final report

Return:

1. status: `PASSED WITHIN DEFINED GATES`, `STOPPED - BLOCKED`, or `STOPPED - CYCLE LIMIT`;
2. number of cycles completed;
3. fixes made and regression tests added;
4. exact gate results;
5. unresolved findings and risks;
6. files changed;
7. confirmation that nothing was committed, pushed, or deployed.
