# 표지기 배포 안내 (처음 하는 분용)

이 폴더를 Cloudflare Pages에 올리면 무료로 공개 사이트가 됩니다.
AI 읽기 기능은 Anthropic API 키가 필요하고, 사용량에 따라 요금이 나옵니다. 아래 "비용" 항목을 먼저 읽어 주세요.

## 0. 준비물
- Cloudflare 계정 (무료)
- Node.js 18 이상 (배포 도구 wrangler 실행용)
- Anthropic API 키 (AI 읽기를 쓰지 않는다면 없어도 사이트는 동작합니다)
- 도메인 pyojigi.kr (선택)

## 1. 배포 도구 설치
터미널에서 이 폴더로 이동한 뒤:

    npx wrangler login

브라우저가 열리면 Cloudflare 계정으로 허용해 주세요.

## 2-1. 이용 기록 데이터베이스(D1) 만들기 — 몇 명이 했고 무엇이 나왔는지 기록
1. Cloudflare 대시보드 → Workers & Pages → D1 SQL Database → "Create database"
2. 이름을 `pyojigi-db` 로 만들기 (표는 처음 기록될 때 자동으로 만들어져요)
3. Pages 프로젝트 → Settings → Bindings → Add → D1 database → 변수 이름 `DB`, 데이터베이스 `pyojigi-db`
4. 무료로 하루 10만 건까지 기록돼요. 연결하지 않으면 KV에 날짜별 숫자만 세는데, 동시에 많이 오면 일부가 빠질 수 있어요.

## 2. 사용량 저장소(KV) 만들기
1. Cloudflare 대시보드 → Workers & Pages → KV → "Create a namespace"
2. 이름을 `pyojigi-kv` 로 만들고 생성
3. 생성된 목록에서 ID(긴 문자열)를 복사
4. Pages 프로젝트 → Settings → Bindings → Add → KV namespace → 변수 이름 `PYOJIGI_KV`, 값 `pyojigi-kv`
   (터미널로 배포할 때만 `wrangler.toml.example`을 `wrangler.toml`로 이름을 바꾸고 ID를 넣어 쓰세요. GitHub 연결 방식에서는 이 파일 없이 대시보드에서 연결해요.)

## 3. 비밀 값 넣기
터미널에서 아래를 하나씩 실행하면 값을 입력하라고 나옵니다. 화면에 보이지 않는 게 정상입니다.

    npx wrangler pages secret put ANTHROPIC_API_KEY --project-name pyojigi
    npx wrangler pages secret put ADMIN_KEY --project-name pyojigi
    npx wrangler pages secret put SALT --project-name pyojigi

- `ADMIN_KEY`: 통계 페이지에 들어갈 때 쓰는 암호. 8자 이상, 본인만 아는 값으로 정하세요.
- `SALT`: 방문자 IP를 가리는 데 쓰는 임의의 긴 문자열. 아무 긴 문장이나 됩니다.

## 4. 배포하기
    npx wrangler pages deploy public --project-name pyojigi

처음이면 프로젝트를 새로 만들지 묻습니다. `y`를 누르세요.
주의: 대시보드에서 폴더를 끌어다 놓는 방식은 `functions/` 폴더(AI·통계 기능)를 올리지 않으므로 쓰지 마세요.
배포가 끝나면 `https://pyojigi.pages.dev` 같은 주소가 나옵니다.

## 5. 도메인 연결 (선택)
Cloudflare 대시보드 → 해당 Pages 프로젝트 → Custom domains → pyojigi.kr 입력 → 안내대로 DNS 설정.

## 6. 동작 확인 체크리스트
- [ ] 홈 화면이 열리고 질문이 진행된다
- [ ] 결과 화면에서 추천 3개와 지원 제도가 보인다
- [ ] 결과 화면의 "AI로 읽기" 버튼을 누르면 답이 온다 (키를 넣은 뒤)
- [ ] `주소/stats.html` 에서 ADMIN_KEY를 넣으면 숫자가 보인다
- [ ] 휴대폰 화면에서도 좌우 여백과 버튼이 정상이다

## 비용 (대략)
- 사이트 호스팅과 KV: Cloudflare 무료 범위 안에서 보통 0원.
  - 주의: 무료 KV는 하루 쓰기 1,000회, 같은 키에는 1초에 1번만 쓸 수 있어요. 한 사람이 방문·시작·완주·피드백으로 4~6번 쓰니 하루 약 150~250명까지가 무료 범위예요(추정). 넘으면 통계 일부가 빠지고(사이트는 정상 동작), 그때 Workers 유료 플랜(월 5달러)으로 올리면 됩니다.
- AI 읽기: Sonnet 5.5 기준 한 사람당 약 30원 안팎 (캐싱과 횟수 제한 적용 시).
  - 하루 전체 상한은 `DAILY_CAP`(기본 100회, 한 달 최대 약 9만원), 한 사람은 첫 읽기 3회, 추가 질문 6회 (`READ_LIMIT`, `ASK_LIMIT`)로 막혀 있습니다.
  - 요금 폭주를 막으려면 Anthropic 콘솔에서 월 사용 한도(spend limit)를 꼭 설정하세요.
- 상한을 바꾸려면 `wrangler.toml`의 `[vars]` 값을 고친 뒤 4번을 다시 실행하세요.

## 홍보 링크에 출처 붙이기
링크 뒤에 `?src=이름`을 붙이면 통계 페이지의 '유입 경로'에 따로 세어져요. 예) `https://pyojigi.kr/?src=insta`, `?src=cafe`, `?src=univ`

## 이용 기록 보기
`주소/stats.html`에서 관리자 키를 넣고 기간(최근 7일 ~ 처음부터 전부)을 고르면:
- 방문·시작·완주 수, 누적 완주(처음부터)
- 1순위로 나온 길, 3위 안에 나온 길(1·2·3순위 모두), 상황·나이대
- 완주 기록: 시각, 상황, 나이대, 받은 길 3개 (익명). '엑셀(CSV)로 저장'으로 전체를 내려받아 보관할 수 있어요.

## 비밀 값 (Settings → Variables and Secrets, 모두 Secret)
- `ADMIN_KEY`: 운영자 키. 통계·문의 답변·후기 승인. 본인 폰에만 보관.
- `FEEDBACK_KEY`: 읽기 전용 키(8자 이상, ADMIN_KEY와 다르게). 매일 자동 업데이트가 통계를 읽을 때 씀.
- `SALT`: 아무 긴 문자열. 방문자 IP를 가리는 데 섞는 값. 기억할 필요 없음.
- 피드백은 메일로 보내지 않고 통계 페이지(/stats.html)에 쌓여요. 예전 `RESEND_API_KEY`, `FEEDBACK_TO`는 지워도 돼요.
- 값을 바꾼 뒤에는 새로 배포돼야 적용돼요(저장소에 새로 올라가면 자동 배포).

## 피드백 읽기
`주소/stats.html`에서 관리자 키를 넣으면 아래가 보여요.
- 받은 한마디: 최근 100개, 만족도·상황·추천 결과와 함께. 90일 뒤 자동 삭제.
- '이건 아니에요'가 많은 추천: 어떤 길이 어떤 이유로 자주 틀리는지.
- 결과 전에 그만둔 질문: 사람들이 어느 질문에서 나가는지.

## 개인정보
- 답은 방문자 기기(localStorage)에만 저장됩니다. 서버로 가지 않습니다.
- 한마디 피드백은 '피드백 보내기'를 누를 때만 300자 이내로 저장되고 90일 뒤 지워집니다.
- AI 읽기를 누를 때만 답 내용이 Anthropic으로 전송됩니다. 개인정보처리방침 페이지에 안내되어 있습니다.
- 익명 통계는 상황 종류, 나이대 번호, 1순위 길, 만족도 같은 숫자만 날짜별로 셉니다. IP는 해시로만 잠깐(이틀) 쓰고 저장하지 않습니다.

## 정부지원 캘린더 갱신
- `public/index.html` 안의 `WIN`, `CAL`, `WAITING` 항목은 직접 고쳐야 합니다. 발표나 신청기한이 바뀌면 공식 사이트를 확인해 값을 바꾼 뒤 4번을 다시 실행하세요.
- 공식 출처: 한국장학재단(kosaf.go.kr), 고용24(work24.go.kr), 복지로(bokjiro.go.kr), 정책브리핑(korea.kr), 서민금융진흥원(kinfa.or.kr), 국가보훈부 제대군인지원센터(vnet.go.kr).

## 문제가 생기면
- AI 읽기가 "준비 중"이라고 나옴 → `ANTHROPIC_API_KEY` 설정 확인
- 통계가 안 열림 → `ADMIN_KEY` 값이 맞는지, KV ID가 맞는지 확인
- 배포 후 functions가 안 보임 → 3번째 방식(드래그 앤 드롭) 대신 4번 명령으로 다시 배포

## 캘린더 구독 (cal.ics)
- public/cal.ics(구독용)와 public/ev/*.ics(일정별)는 빌드할 때 캘린더 일정으로 다시 만들어져요.
- 사이트를 다시 올리면 구독한 사람들의 캘린더도 12시간 안팎으로 새 일정으로 바뀌어요 (구글 캘린더는 더 늦을 수 있어요).
