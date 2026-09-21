# Footprint agent rules

Footprint is a self-audit tool for reconstructing a user's own public digital footprint. Do not turn it into a third-party surveillance product.

## Read before editing
1. `docs/project-memory.md`
2. `docs/regression-guardrails.md`
3. `docs/decision-log.md`
4. `README.md`
5. `tests/`

## Required workflow
1. Preserve the self-audit/consent gate.
2. Treat optional identity hints as OR discovery/matching signals, not mandatory AND filters.
3. Keep source evidence and matched-hint explanations visible enough to audit identity matching.
4. Do not add sensitive-trait inference (health, religion, politics, sexual life/orientation, etc.).
5. Do not add persistent storage of search inputs/results without explicit product approval.
6. Add/update Node tests for behavioral changes and run `npm test`.
7. Update decision log and memory/guardrails when identity matching, privacy, sources, or scoring changes.

## Never regress
- Name is required.
- `selfAudit=yes` or equivalent user/subject consent gate remains required.
- Optional hints expand discovery and identity evidence; lack of one hint does not suppress all other searches.
- Results remain probabilistic candidates with confidence/evidence, not identity certainty.
- Public sources only.
- No silent database retention of personal search payloads/results.
- Jina/API-assisted discovery remains optional and must have a fallback path.
