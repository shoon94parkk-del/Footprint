# Footprint regression guardrails

Last updated: 2026-09-22

## Consent/purpose
- Keep self-audit/subject-consent enforcement.
- Do not repurpose the app for covert third-party monitoring.

## Search behavior
- Name stays mandatory.
- Optional identity hints remain OR discovery signals.
- Adding one optional hint must not turn all other searches into an AND-only requirement.
- Jina/search-provider failure must not eliminate every fallback search path.
- Deduplicate candidate URLs before scoring/reporting.

## Identity integrity
- Preserve matched-hint evidence.
- Confidence remains probabilistic; do not label a candidate as verified identity without sufficient evidence.
- Weak name-only results stay distinguishable from multi-hint matches.
- Patent evidence should be detail-verified where current logic requires inventor/applicant context.

## Privacy
- Do not introduce persistent DB storage of submitted identity hints/results without explicit approval.
- Do not log/store email or other optional hints as durable profiles by default.
- Public sources only.

## Sensitive inference
- Do not infer or score health/medical state, religion, political ideology/affiliation, sexual life/orientation, ethnicity/race, or similarly sensitive traits.
- Non-sensitive occupation/interests/activity-style output must remain clearly heuristic and evidence-linked.

## UX
- Evidence chips/source domain remain visible.
- "가능성/후보/추정" wording is preserved where facts are not verified.
- Users must be able to inspect original public-source URLs.
