# AGENTS.md

Meoksa — 도시 반려견 보호자를 위한 AI 산책 판단 서비스 (명지대 공모전).
백엔드 + 프론트가 한 저장소에 있는 Next.js 앱. Windows 환경, 명령어는 `npm.cmd`.

## 작업 규칙

**시킨 것만 한다.** 요청 범위 밖의 파일은 열지 않는다. 고치는 김에 눈에 띈 문제는
고치지 말고 보고만 한다.

**사본을 만들지 말고 원본을 고친다.** 아래는 절대 하지 않는다.
- 기존 파일 옆에 `-next`, `-new`, `-v2`, `-copy` 같은 이름으로 새 파일을 만드는 것
- 기존 화면을 두고 같은 화면을 다른 곳에 새로 만드는 것
- 기존 폴더를 두고 새 프론트엔드/서버 프로젝트를 만드는 것

기존 구현이 마음에 안 들어도 **그 파일을 고쳐라.** 정말 새로 만들어야 한다고
판단되면 **먼저 사용자에게 이유를 설명하고 허락을 받아라.** 허락 없이 만들지 않는다.
허락을 받았다면 **같은 작업 안에서 옛것을 삭제**하고, 무엇을 지웠는지 보고한다.

> 왜 이 규칙이 있나: 2026-08-12 기준 이 저장소에는 같은 화면의 사본이 셋
> (`frontend/` Vite 앱 · `app/walk-recorder-panel.tsx` · `public/demo.html`)
> 있었고, 사용자는 그게 생긴 줄도 몰랐다. 매번 "새로 만드는" 선택을 하고 옛것을
> 안 지운 결과다. 수정이 실행 중이 아닌 사본에 들어가서 "고쳤다는데 화면은 그대로"가
> 반복됐고, 5,694줄을 지우고서야 정리됐다. 죽은 코드는 조용히 쌓이고 비용은 나중에
> 사용자가 낸다.

**완료 기준은 "화면에서 동작하는 것"이다.** 타입 체크 통과는 완료가 아니다.
`tsc`는 501을 반환하는 빈 껍데기도 통과시킨다 — 이 저장소에 실제로 그런 스텁이
남아 있는 이유가 그것이다. 라우트만 깔고 완료라고 하지 않는다.

**끝나면 항상 보고한다.**
- 수정한 파일 목록과 파일마다 고친 이유 한 줄
- `npm.cmd run check` 와 `npm.cmd run check:jobs` 결과 (둘 다 통과해야 함)
- UI를 건드렸다면 `localhost:3000`에서 실제로 확인한 결과
- 요청받은 완료 조건을 각각 어떻게 확인했는지

**모르면 묻는다.** 요구사항이 애매하면 추측해서 만들지 말고 질문한다.
잘못 만든 것을 되돌리는 비용이 질문 한 번보다 크다.

## 구조

| 위치 | 역할 |
|---|---|
| `app/` | **UI. 여기 하나뿐이다.** Next.js App Router |
| `app/api/` | **실제로 쓰이는 HTTP 라우트.** `src/modules`의 컨트롤러를 감싸는 얇은 껍데기 |
| `src/modules/` | 비즈니스 로직 (auth, dogs, onboarding, walkRoutes, walkRecords, care) |
| `src/constants/walk-tuning.ts` | 추천 알고리즘 튜닝 상수. 숫자를 바꿀 땐 여기 |
| `jobs/ingest/` | 공공데이터 적재 스크립트. 앱 런타임과 무관 |
| `supabase/migrations/` | DB 스키마 |
| `docs/walk-recommendation-spec.md` | 추천 로직의 단일 기준 문서 |

**엔드포인트를 추가할 때는 두 군데를 만진다.**
1. `src/modules/<모듈>/<모듈>.controller.ts` — 실제 로직
2. `app/api/<경로>/route.ts` — `runExpressHandlers`로 감싸는 래퍼

## 함정

**서버 코드가 두 벌 있다. `app/api/`가 진짜다.** `src/server.ts`, `src/app.ts`,
`src/routes/`, `npm.cmd run dev:express`는 예전 Express 서버의 잔재로 아직 남아 있다.
`npm.cmd run dev`로 뜨는 것은 **Next.js뿐**이므로, `src/routes/`에 라우트를 추가하면
타입 체크는 통과하지만 **화면에서는 존재하지 않는다.** 새 라우트는 반드시
`app/api/`에 만든다.

**라우트가 있다고 구현된 게 아니다.** 아래는 501을 반환하는 껍데기다.
작업 전에 컨트롤러 본문을 직접 확인할 것.
- `GET/POST /api/dogs`, `POST /api/dogs/join` (`src/modules/dogs/dog.controller.ts`)
- `POST /api/care/nudges` (`src/modules/care/care.controller.ts`)

**백엔드는 있는데 화면이 없는 기능이 많다.** 공동 보호자 케어(`/api/care/*`),
오늘의 산책 판단(`/api/walk-routes/warnings`), 초대 코드 가입
(`/api/onboarding/join`)은 백엔드가 진짜로 동작하지만 UI가 호출하지 않는다.
"이 기능 만들어줘"를 받으면 백엔드부터 만들지 말고 이미 있는지 먼저 확인할 것.

**산책 기록에 알려진 구멍이 넷 있다.** 건드릴 때 참고할 것.
- 경로는 산책 중 서버로 전송되지 않는다. 시작·종료 두 번만 통신하고 중간 좌표는
  브라우저 `localStorage`에만 쌓인다. 스토리지가 없으면 복구 시 거리·경로가 0이 된다
  (`app/walkTracking.ts`의 복구 분기가 `tracking.start()`로 초기화한다).
- 선택한 추천 코스가 기록에 저장되지 않는다. `startWalkRecordSchema`는 `dogId`와
  `startedAt`만 받고, `walk_records`에 코스 참조 컬럼이 없다.
- 일시정지는 클라이언트 상태일 뿐 서버에 없다. `walk_records`에 `status` 컬럼이 없고
  `ended_at is null`로 진행 중을 판정한다.
- `staticMapUrl`은 DB 컬럼·스키마·컨트롤러까지 있는데 UI가 한 번도 보내지 않는다.

**`supabase/migrations/0001_init.sql`을 고쳐도 DB는 안 바뀐다.** `create table if
not exists`라서 이미 존재하는 테이블에는 아무 효과가 없다. 새 번호 파일을 만들고
`alter table ... add column if not exists`를 쓴 뒤, `src/lib/schema-check.ts`의
`expectedSchema`에 추가하고 `npm.cmd run db:check`로 확인한다.

**서비스 지역은 서울 전역 + 용인 명지대 반경 3km다.** 서울 전용 데이터에만
의존하는 기능은 시연 장소인 용인에서 죽는다. 전국 표준데이터로 동작해야 하고,
서울 전용 소스는 정확도 보강용으로만 쓴다.

**GraphHopper는 로컬 인스턴스(`graphhopper/`, gitignored)가 떠 있어야 추천이
동작한다.** 재부팅하면 수동으로 다시 띄워야 한다.

## MVP 제외 항목 — 요청받아도 만들지 않는다

소셜 로그인 · 반려견 다중 등록 · 사용자 제보/검수 · 관리자 웹 페이지 ·
구독/결제 · 실시간 푸시 알림 · 코스 겹침 조절 · 지역 내 산책 백분율 ·
사진 업로드 · 노면 온도/제설제 데이터

## 명령어

```bash
npm.cmd run dev          # Next dev server, localhost:3000 (API + UI 같은 포트)
npm.cmd run check        # tsc --noEmit — 완료 전 필수
npm.cmd run check:jobs   # jobs/ 타입체크 — 완료 전 필수
npm.cmd run db:check     # 코드가 기대하는 스키마와 실제 DB 비교
```

**자동화된 테스트는 없다.** `.test.ts` / `.spec.ts` 파일이 하나도 없고 테스트
러너도 설치돼 있지 않다. 테스트를 찾아 헤매지 말 것. 검증은 타입 체크 +
`localhost:3000`에서 직접 확인으로 한다. 테스트를 새로 도입하려면 먼저 물어볼 것.

## 회귀 체크리스트

**작업을 끝낼 때마다 `localhost:3000`에서 아래를 실제로 돌리고 결과를 보고한다.**
타입 체크는 이걸 대신하지 못한다 — 501을 반환하는 빈 껍데기도 타입 체크는 통과한다.
기능이 늘어나면 이 목록도 같이 늘린다.

1. 로그인이 된다
2. 강아지 미등록 계정은 등록 안내가 보이고, 등록이 된다
3. 코스 추천이 3개 나온다
4. 산책 시작 → 종료 → 기록에 남는다
5. 산책 캘린더에 그 기록이 보인다

깨진 항목이 있으면 **완료가 아니다.** 고치거나, 못 고치면 그대로 보고한다.

## 작업 완료 보고 형식

```
작업 N 완료
- 새로 만든 파일: (없으면 "없음")
- 지운 파일: (없으면 "없음")
- 고친 파일 + 각각 고친 이유
- 완료 조건 1~N 각각을 어떻게 확인했는지
- 회귀 체크리스트 결과
- 커밋 해시
```

새 파일을 만들었다면 **왜 기존 파일을 고치는 대신 새로 만들었는지** 반드시 적는다.

## 보안

`.env`, `.env.local`, `DATABASE_URL`은 절대 커밋하지 않는다.
`GET /api/dev/demo-session`은 자격 증명 검사 없이 유효한 토큰을 발급한다.
개발 전용이며 배포 환경에 도달해서는 안 된다.
