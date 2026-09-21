# Footprint project memory

Last updated: 2026-09-22

## Purpose
Footprint is a self-audit web app that searches public internet traces and reconstructs how the user may appear online. It is not intended for covert third-party profiling.

## Consent and inputs
- Search requires `selfAudit=yes` / user or subject consent.
- Name is mandatory.
- Optional identity hints include company, school, role, region, nickname, social identifier, GitHub ID, extra keyword, age band, and currently email.
- Phone-number collection is not part of the current product.
- Search inputs/results are not intentionally stored in a database by the app.

## OR-hint search design
The key v0.9 decision is that optional hints are **OR signals**, not one combined AND filter.

Example:
- search name alone
- name + company
- name + school
- name + nickname
- email itself / name + email
- GitHub hint / social hint separately

This broadens recall while identity scoring later evaluates which hints actually appear in each result.

## Identity evidence
- Search candidates are deduplicated by normalized URL.
- Each candidate receives a confidence score.
- Matched hint categories are retained and displayed as evidence chips.
- Name + company/school/role etc. increases confidence; weak name-only candidates remain lower-confidence.
- Results below the relevance threshold are not treated as high-confidence identity matches.
- UI language should continue to say "가능성", "후보", "추정" where certainty is not established.

## Sources / discovery
Current search stack combines public search and structured/public sources:
- public web/Naver HTML discovery
- ScienceON/patent verification
- Crossref / GitHub public traces through baseline search paths
- optional Jina Search when `JINA_API_KEY` is configured

Jina is an enhancement, not a required single point of failure.

Patent verification is intentionally stricter: fetched detail should contain the name and patent-role structure such as inventor/applicant context rather than trusting a search snippet alone.

## Persona/reporting
Current report may summarize:
- likely occupation category
- non-sensitive interests/topics
- public activity style
- categorized traces
- timeline
- Digital Footprint score/confidence

These are evidence-based heuristics, not verified biography.

Do not extend persona inference to sensitive personal traits such as health status, religion, politics, sexual life/orientation, ethnicity, or other sensitive attributes.

## Privacy
- No intentional DB persistence of submitted identity hints or result sets.
- Public-source lookup only.
- Search result UI should expose source/domain/evidence enough for the user to inspect originals.
- Email, when used, is an optional discovery hint and must not be logged/stored as a profile asset by default.

## Version history already adopted
- v0.8: Jina public search integrated as an optional provider with patent/web pipeline.
- v0.9: OR-hint query planning, matched-evidence chips, and scoring tests.
- Production startup benchmarks/debug searches were removed from normal startup.

## Verification
- `npm test`
- syntax checks for active server/client modules
- OR-query planning/scoring regression tests
- self-audit consent test
- identity-evidence/confidence behavior tests
