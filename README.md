# Footprint

공개 인터넷에 흩어진 자기 자신의 디지털 흔적을 한 번에 재구성하는 self-audit 웹앱입니다.

## Development memory
코드 변경 전 `AGENTS.md`, `docs/project-memory.md`, `docs/regression-guardrails.md`, `docs/decision-log.md`를 먼저 읽습니다. 동의·OR 검색·동명이인 방지·개인정보 비저장 규칙은 회귀 계약입니다.

## MVP
- 이름 필수
- 회사/학교/직무/지역/닉네임/GitHub ID/소셜/이메일/추가 키워드 등은 선택적 OR 탐색 단서
- 공개 웹 + 특허 관련 결과 + Crossref + GitHub 공개 프로필 + 선택적 Jina Search
- 동명이인 오판을 줄이기 위한 힌트 기반 신뢰도 점수와 일치 근거 칩
- Digital Footprint Score, 자동 요약, 카테고리별 흔적, 타임라인
- 본인 또는 본인 동의를 받은 self-audit만 허용
- 입력값/검색 결과 DB 저장 없음

## Run
```bash
npm start
```

## Test
```bash
npm test
```

## Privacy
전화번호는 입력받지 않습니다. 이메일은 현재 선택적 검색 단서로 사용할 수 있지만 프로필 DB로 저장하지 않습니다. 결과는 공개 정보의 자동 추정이며 원문 확인이 필요합니다. 민감한 건강·종교·정치·성생활/성적지향 등은 추정 대상으로 확장하지 않습니다.
