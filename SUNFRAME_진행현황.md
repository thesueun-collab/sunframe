# SUNFRAME (frame your memory) 진행 현황 — 2026-10-29 기준

> 출처: Vercel 프로젝트 naeilbakkum-hello 의 배포 기록(커밋 메시지 66건)과 최신 Production 배포(dpl_8XtYwmPxU) 소스.
> `.claude/`, `CLAUDE.md`, `HANDOFF.md`, `docs/` 는 `.vercelignore` 로 업로드에서 빠져 있어 이 백업에 포함되지 않음 (원본은 작업 PC에만 있음).

## 일정별 진행
| 날짜 | 작업 |
|---|---|
| 10-03 | frame your memory 첫 버전: 촬영 → 스티커 → 완성. 노트북은 바로 내려받기, 스티커 흰 테두리 제거 |
| 10-04 | 핸드오프 정리, QR 포스터(poster.html), 이용 장면 애니메이션(demo.html) |
| 10-07 | 강릉커피축제 참여 제안서(A4 1장), 명소별 하단 로고(축제 CI, ?spot=gncoffee) |
| 10-08 | 제안서 문구 다듬기·메일 초안·거치대 변경 기록, 단양 사전 연구제안서 최종안 |
| 10-09 | 카페폭포 체험 QR(PNG·SVG), 카페폭포 전용 스티커 12개, 장소별 스티커 폴더, 스티커 버전 3 |
| 10-25 | 카페폭포 서비스 도입 제안서(초록 테마, A4 1장, 체험 QR) |
| 10-29 | **최신** 이태원 할로윈 에디션(?spot=itaewon): 할로윈 스티커 10개, 검정 프레임·흰 로고, 명소별 프레임 색 표, 포스터형 시작 화면 / 광고 제목 '다음 프레임에서 만나요' |

## 현재 구성 (src/)
- `index.html` + `js/app.js` — 메인 촬영 앱(명소는 Supabase `spots` 표 + 오프라인용 SPOTS)
- `poster.html`, `demo.html`, `slides.html`, `stats.html`(현황판) — `/poster` `/demo` `/slides` `/stats`
- `ad.json` — 완성 화면 광고(인스타 @sunframestudio)
- 스티커: 기본 16개, `cafepokpo/` 12개, `halloween/` 10개
- 부가: `hello.html`(AI 내일바꿈 3기), `블로그초안도우미/`, `에너지움-예약알림/` 제안 보고서·PDF

## 확인 못 한 것
- `.claude/` 안의 메모·할 일 목록, HANDOFF.md 의 다음 단계 → 작업 PC 원본 확인 필요
