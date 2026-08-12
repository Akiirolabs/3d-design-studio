# Competitor and Product Gates

## Eligibility

- Include only products with a current free plan or a qualifying plan at USD 20/month or less.
- Verify pricing and features from official product, pricing, help, or documentation pages.
- Record billing cadence and material restrictions. Exclude enterprise-only features.
- Treat trials as trials, not free plans.

## Candidate scoring

Score each candidate from 1 to 5:

- user value;
- architectural fit;
- objective testability;
- implementation effort, reversed so easier work scores higher;
- regression safety.

Do not recommend implementation when the feature requires an unapproved dependency, unclear licensing, secrets, paid infrastructure, destructive migration, or unsupported physical-fit guarantee.

## Required evidence

- Reproduce the current app behavior before declaring a gap.
- Cite the competitor's official feature documentation and qualifying price.
- Define the smallest useful version rather than copying an entire competitor workflow.
- Require boundary, persistence, undo/redo, export, performance, and failure-path tests for geometry features.
- For Boolean holes, require deterministic geometry, manifold/export validation, transform correctness, cancellation, and resource disposal.
- For parametric extrusion, require bounded topology, finite vertices/normals, cap triangulation, flat/smooth modes, undo integration, persistence, export round-trip, and responsive regeneration.

