# 표지기 관리 규칙 (Claude가 이 저장소에서 일할 때 지킬 것)

표지기는 10대·20대 초(20~24세)를 위한 무료 진로 검사 사이트예요. Cloudflare Pages가 이 저장소의 main 브랜치를 자동으로 배포해요 (https://pyojigi.pages.dev).

## 구조
- `src/pyojigi.html` — 원본 (질문, 추천 로직, 데이터, 화면). **고칠 때는 항상 여기만 고친다.**
- `public/` — 배포되는 결과물. `public/index.html`, `public/jobs/`, `public/for/`, `public/og/`, `public/ev/`, `cal.ics`, `sitemap.xml`, `404.html`, `privacy.html`은 빌드로 만들어지니 직접 고치지 않는다. `public/stats.html`(운영자 통계)만 직접 고친다.
- `functions/` — 서버 (Cloudflare Pages Functions, D1 `DB`, KV `PYOJIGI_KV`).
- `tools/` — 빌드: `python3 tools/build_web.py` 한 번이면 위 결과물이 모두 다시 만들어진다.
- `tests/` — 검사.
- `FEEDBACK_LOG.md` — 받은 피드백·문의와 처리 기록.

## 고치는 순서 (반드시)
1. `src/pyojigi.html` 또는 `functions/` 수정
2. `python3 tools/build_web.py`
3. 검사 전부 통과 확인:
   - `node tests/run.js 30000 2000` → "오류 0건", "통과 2000"
   - `node tests/majors2.js 50` → 마지막 줄 100%
   - `cd tests/mock && for t in v2 d1 t mail; do node --no-warnings $t.mjs; done` → 모두 ALL PASS
4. 검사가 하나라도 실패하면 main에 올리지 않는다. 고칠 수 없으면 `FEEDBACK_LOG.md`에 이유를 적고 멈춘다.
5. 커밋 메시지는 한국어로 무엇을 왜 고쳤는지.

## 정기 업데이트 (예약 작업)
1. 읽기 전용 키로 `https://pyojigi.pages.dev/api/stats?key=<FEEDBACK_KEY>&days=7`를 읽는다. 응답의 `feedback`, `asks`, `miss`, `leave`, `kws`, `refs`를 본다.
2. 새 항목을 `FEEDBACK_LOG.md` 맨 위에 날짜별로 적는다. 개인정보(이름·연락처·학교명 등)가 보이면 옮겨 적지 않는다.
3. 바로 고쳐도 되는 것만 고친다: 깨진 링크, 틀린 문구·날짜·숫자(공식 출처로 확인한 것), 화면 오류, 검사로 재현되는 추천 오류.
4. 바로 고치지 않고 운영자에게 묻는 것: 추천 방식 자체를 바꾸는 일, 질문 추가·삭제, 개인정보 처리방침 변경, 비용이 드는 일.
5. 문의 답변은 직접 달지 않는다. 답변 초안만 `FEEDBACK_LOG.md`에 적어 운영자가 통계 페이지에서 달게 한다.
6. 후기는 직접 승인하지 않는다. 운영자가 통계 페이지에서 승인한다.

## 지킬 원칙
- 연봉·일정·제도는 공식 출처로 확인한 것만 넣고 출처를 남긴다. 모르면 비워 둔다.
- 후기는 실제 이용자가 공개에 동의하고 운영자가 승인한 것만. 지어내지 않는다.
- 답 내용, 이름, 연락처, IP 원문은 서버에 저장하지 않는다.
- 사용자에게 보이는 글은 쉬운 한국어(해요체).
