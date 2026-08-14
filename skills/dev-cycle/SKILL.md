---
name: dev-cycle
description: Coordinate persistent autonomous improvement cycles between DevAudit, DevSync, and DevBase. Use when asked to clarify intent, research, audit, implement, test, and re-audit this application until the explicit interface contract and objective quality gates pass or a genuine authority or infrastructure blocker is reached. Never commit, push, deploy, install dependencies, or handle secrets without explicit user approval.
---

# Dev Cycle

Run an evidence-driven audit and repair loop. Aim for all defined gates to pass; never claim software is perfect.

Read [quality-gates.md](references/quality-gates.md) before starting a cycle.

## Roles

- **DevAudit:** independent, read-only product auditor. Test real workflows, verify affordable competitor features, identify plausible gaps, and define product acceptance criteria. Do not edit files.
- **DevSync:** independent, read-only intent, design, engineering, and QA auditor. Establish the interface contract, expose possible misinterpretations, inspect code and workflows, and verify every contract item. Do not edit files.
- **DevBase:** implementation engineer. Confirm findings, make minimal fixes, add regression tests, and run checks. Do not approve its own work.
- **Orchestrator:** maintain cycle state, enforce authority limits, pass raw evidence between roles, and decide whether to continue or stop.

When agent delegation is available and authorized, use separate fresh agents for DevAudit, DevSync, and DevBase. Give each only the role, repository scope, current acceptance criteria, and raw artifacts it needs. Do not leak expected conclusions to either auditor. When delegation is unavailable, perform clearly separated sequential passes and re-read the resulting diff before the audit pass.

## Cycle protocol

Continue cycling until the completion criteria pass. Do not stop merely because a fixed number of iterations has elapsed. Preserve cycle numbers in reports so progress remains auditable.

1. **Baseline:** inspect repository instructions and working-tree state. Run available gates before editing. Record pre-existing failures separately.
2. **Product audit:** when product expansion or competitive parity is in scope, have DevAudit test current workflows, verify qualifying competitor features, prioritize plausible gaps, and define measurable product acceptance criteria.
3. **Intent and engineering audit:** have DevSync restate the interface contract, flag material alternate interpretations, pause for clarification when needed, and produce prioritized findings with measurable acceptance criteria.
4. **Select:** address critical and high findings first. Group only fixes that are tightly related. Do not expand scope to cosmetic improvements while functional failures remain.
5. **Implement:** have DevBase confirm and fix selected findings, add regression coverage, and return its handoff.
6. **Verify:** run relevant focused tests and every available gate in `quality-gates.md`. Record exact commands and results.
7. **Re-audit:** give DevSync the current diff, interface contract, and raw verification results. When product features changed, also give DevAudit the running UI and raw workflow results.
8. **Decide:** finish only when the completion criteria are satisfied. Otherwise begin the next bounded cycle with unresolved actionable findings.

## Completion criteria

Finish with `PASSED WITHIN DEFINED GATES` only when:

- every available automated gate passes;
- no confirmed critical or high finding remains;
- selected functional scenarios pass;
- regression tests cover fixed defects where practical;
- DevSync approves the final diff and every interface-contract item;
- DevAudit approves changed product workflows when it participated;
- no unreviewed DevBase change follows that approval.

Report unavailable gates explicitly. Never translate unavailable verification into a pass.

## Hard stops

Stop and request user direction when:

- the same failure survives two attempted fixes;
- tests cannot run because dependencies or infrastructure are unavailable;
- a fix requires dependency installation or upgrades, secrets, external services, billing, production access, destructive data changes, or a major architecture/product decision;
- requirements are ambiguous or contradictory;
- the working tree contains overlapping user changes that cannot be preserved safely;
- the next change cannot be validated objectively;
- two consecutive cycles show no measurable improvement.

## Final report

Return:

1. status: `PASSED WITHIN DEFINED GATES` or `STOPPED - BLOCKED`;
2. number of cycles completed;
3. fixes made and regression tests added;
4. exact gate results;
5. unresolved findings and risks;
6. files changed;
7. confirmation that nothing was committed, pushed, or deployed.
