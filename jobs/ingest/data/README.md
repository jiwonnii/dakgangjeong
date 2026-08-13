# 표준데이터 로컬 파일

data.go.kr에서 다운로드한 표준데이터 CSV/XLSX/XLS 파일을 이 폴더에 그대로 저장하세요.
파일명(확장자 제외)은 아래 표와 정확히 일치해야 합니다. CSV/XLSX/구형 XLS 셋 다
지원하며, CSV는 EUC-KR/CP949 인코딩도 자동 처리됩니다. 구형 XLS는 1행이 비어있고
헤더가 2행에 있는 경우도 자동 감지합니다 (data.go.kr XLS 다운로드 템플릿 특징).

`speed-bumps.csv`는 예외 — data.go.kr에 전국 통합 파일이 없어서 서울/용인 지역별
파일을 받아 하나로 병합해뒀습니다. 새로 받을 경우 두 지역 CSV를 헤더 기준으로
합쳐서 넣어주세요.

**공원(전국도시공원정보표준데이터)은 예외입니다.** data.go.kr에 파일 다운로드 옵션이
없어 OpenAPI 활용신청으로 받습니다 — `npm run ingest:parks`는 이 폴더가 아니라
`PUBLIC_DATA_API_KEY`로 직접 API를 호출합니다.

| 파일명 (확장자 제외) | 데이터셋 | 사용하는 스크립트 |
| --- | --- | --- |
| `street-trees` | 전국가로수길정보표준데이터 | `npm run ingest:street-trees` |
| `streetlights` | 전국보안등정보표준데이터 | `npm run ingest:streetlights`, `npm run ingest:road-segments` |
| `risk-zones` | 전국교통사고다발지역표준데이터 | `npm run ingest:risk-zones` |
| `pedestrian-only-roads` | 전국보행자전용도로표준데이터 | `npm run ingest:road-segments` |
| `pedestrian-priority-roads` | 전국보행자우선도로표준데이터 | `npm run ingest:road-segments` |
| `school-zones` | 전국어린이보호구역표준데이터 | `npm run ingest:road-segments` |
| `speed-bumps` | 전국과속방지턱표준데이터 | `npm run ingest:road-segments` |

예: `pedestrian-only-roads.csv` 또는 `pedestrian-only-roads.xlsx`

이 폴더에 있는 실제 파일은 커밋하지 마세요 (용량 크고, 재다운로드 가능한 공개 데이터).
