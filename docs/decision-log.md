# Footprint decision log

Append-only high-risk decisions.

## 2026-09-22 — Durable project memory
Added explicit consent, OR-search, identity-evidence, privacy and sensitive-inference guardrails so future search improvements do not turn Footprint into a surveillance or overclaiming tool.

## 2026-09-14 — Optional identity hints become OR signals
Company, school, role, region, nickname, email/social/GitHub and extra keywords are searched as independent clues rather than one strict AND query. This improves recall while candidate scoring decides identity relevance.

## 2026-09-14 — Show matched identity evidence
Result cards expose which optional hints matched. Confidence should be explainable from evidence rather than a mystery score.

## 2026-09-13 — Jina Search is an optional provider
Jina public search was integrated to improve discovery quality, but baseline public search/patent paths remain available so provider configuration does not define product availability.

## 2026-09-13 — Self-audit and no persistence
The product requires self-audit/consent and does not intentionally persist user search payloads/results to a database. Search results remain public-source candidates requiring original-source review.
