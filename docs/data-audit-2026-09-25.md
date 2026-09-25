# F1 캘린더 데이터 점검 — 2026-09-25

[운영자 안내로 돌아가기](../README.operator.md) · [전체 160개 세션 대조표 CSV](data-audit-2026-09-25.csv)

## 범위와 방법

공개 한국어 캘린더의 ICS 160개 이벤트를 모두 읽고, F1 공식 2026·2027 시즌 목록 및 경기·테스트 상세 페이지 37개와 대조했다. 시각이 있는 일정은 시작·종료 시각을 같은 UTC 시점으로 비교했고, 종일 일정은 공식 세션의 예정일 및 TBC 상태를 비교했다. 국가·서킷 표기는 공식 상세 페이지의 서킷명과 현재 한국어 사전을 대조했다.

CSV와 시각·예정일 대조 결과는 ⏳ 표시를 적용하기 전 공개 피드의 스냅샷이다. 이후 확인한 ⏳ 적용 완료와 원본의 취소 표시는 아래에 별도로 기록했다. 공개 피드에 포함된 일정의 정확성과 시즌 전체의 포함 여부를 따로 확인했다.

## 결과

| 검사 | 결과 |
| --- | --- |
| 공개 일정 | 160개, UID 중복 0개, 시즌·대회·세션 중복 0개 |
| 2026년 | 10개 GP, 50개 세션. 시작·종료 시각 모두 공식 시간표와 일치 |
| 2027년 | 22개 GP, 110개 세션. 전부 종일 일정이며 공식 예정일·시간 미정 상태와 일치 |
| 세션 구성 | 등록된 각 GP의 연습·예선·스프린트·결승 구성이 공식 상세 시간표와 일치 |
| 장소 | 160개 모두 국가와 한국어 서킷명이 있고 공식 서킷의 사전 변환 결과와 일치 |
| 설명 | 160개 모두 해당 연도의 F1 공식 시즌 일정 링크 |
| 프리시즌 테스트 | 현재 코드에서 제외. 공개 캘린더에 없음 |

## 공식 웹사이트와 구독 원본의 차이

### 2027년 영국·오스트리아 GP

2027년 공식 목록은 24개 GP이며 현재 공개 캘린더는 22개 GP다. 다음 두 대회의 총 10개 세션이 없다.

| 대회 | 공식 예정일(현지 날짜) | 공식 페이지 |
| --- | --- | --- |
| 영국 GP | 2027-07-02 ~ 07-04 | [공식 시간표](https://www.formula1.com/en/racing/2027/great-britain) |
| 오스트리아 GP | 2027-07-09 ~ 07-11 | [공식 시간표](https://www.formula1.com/en/racing/2027/austria) |

원본 `Formula 1` 표시를 켠 사용자 화면에서 7월 2~4일과 7월 9~11일의 원본 일정 총 10개에 `CALLED OFF`가 붙어 있음을 확인했다. 화면에서는 전체 제목이 잘려 있지만, 공개 캘린더에 없는 두 대회의 공식 주말 및 세션 수와 대응한다. 현재 코드는 이 문구를 취소로 분류해 등록 대상에서 제외하고, 이미 관리 중인 대응 일정은 삭제한다. 원본에 일정 자체가 없는 것으로 보았던 초기 추정을 이 화면 확인으로 정정했다.

같은 시점에 다시 확인한 [F1 공식 시즌 목록](https://www.formula1.com/en/racing/2027)과 위 경기별 공식 페이지에는 두 대회가 계속 등재되어 있다. 확인된 사실은 **구독 원본에는 취소 표시가 있고, 공식 웹사이트에는 일정이 남아 있다는 상태 불일치**다. 실제 대회 취소 여부와 공급자가 취소로 표시한 이유는 확정하지 않았다. 공식 웹페이지의 취소 표시 없는 제목·장소를 넣은 로컬 변환에서는 각 5개 세션이 정상 분류됐다. 현재 동기화는 원본의 취소 표시를 따른다.

### 2026년 과거 일정

2026년 공식 목록은 현재 23개 GP이며, 공개 캘린더에는 스페인 GP부터 아부다비 GP까지 10개 GP만 있다. 다음 13개 GP의 과거 일정은 공개 캘린더에 없다: 호주, 중국, 일본, 마이애미, 캐나다, 모나코, 바르셀로나 카탈루냐, 오스트리아, 영국, 벨기에, 헝가리, 네덜란드, 이탈리아. 원본의 보관 범위와 구독 시점 등을 추가 확인해야 하며, 현재 캘린더를 2026년 전체 기록으로 볼 수 없다.

## 프리시즌 테스트의 현재 처리

`src/Core.js`는 제목의 `testing`, `pre season`, `test day`를 제외 조건으로 사용한다. 따라서 테스트를 P1/P2/P3 또는 결승으로 표시하지 않는다. F2/F3/F1 Academy와 홍보·하이라이트도 제외한다.

공식 웹사이트에는 다음 테스트가 표시된다.

| 구분 | 공식 예정일 | 공식 페이지 |
| --- | --- | --- |
| 2026년 테스트 1차 | 2월 11~13일, 3일 | [일정](https://www.formula1.com/en/racing/2026/pre-season-testing-1) |
| 2026년 테스트 2차 | 2월 18~20일, 3일 | [일정](https://www.formula1.com/en/racing/2026/pre-season-testing-2) |
| 2027년 테스트 | 2월 24~27일, 4일, 시간 미정 | [일정](https://www.formula1.com/en/racing/2027/pre-season-testing) |

테스트를 포함하는 기능은 현재 구현되어 있지 않다. 향후 추가한다면 경기 주말 연습 주행과 구분하는 세션 코드, 같은 시즌 내 테스트 차수와 일차 식별이 필요하다.

## 시간 미정 표시

시간이 미정인 경기 제목은 `[G] ⏳ 벨기에 GP`처럼 대괄호와 이름 사이에 ⏳를 붙인다. 종일 일정과 알림 없음 처리를 유지하고, 원본에 확정 시간이 들어오면 같은 일정에 시각을 반영하면서 ⏳를 제거한다.

Apps Script 적용 후 2026-09-25 16:33:56 KST까지 80개와 30개를 나누어 총 110개 갱신했다. 16:34:12 재실행 로그에서는 160개 모두 변경 없음·경고 없음·남은 작업 0을 확인했고, 사용자 화면에서도 ⏳ 표시를 확인했다.

종일 일정은 원본 예정일을 보존한 것으로, 확정된 한국 날짜·시각을 뜻하지 않는다. 시간이 확정돼 한국 시간으로 변환하면 날짜가 하루 바뀔 수 있다.

## 검증 한계

- 원본 Google 캘린더의 공개 ICS 주소는 HTTP 404여서 이 환경에서 원본 175개 항목 전체를 직접 읽지 못했다. 원본의 제외 항목별 수와 실제 제목을 전부 검증했다고 주장하지 않는다.
- 공개 ICS는 소유자 계정의 알림 설정과 내부 동기화 태그 검증을 대신하지 않는다. 취소·삭제 처리는 코드와 해당 로컬 테스트로 확인했으며, 실서비스 일정을 지우는 실험은 하지 않았다.
- 동기화의 `warnings: []`, `remaining: 0`은 수신한 원본과의 대조 결과다. 공식 웹사이트에 있는 대회가 구독 원본에서 빠지거나 취소로 표시되는 불일치를 탐지하는 검사는 현재 구현에 없다.
- 공식 페이지의 TBC 세션은 내부 데이터에 임시 시각이 있어도 확정 시각으로 사용하지 않았다.

## 대조표 읽는 방법

[CSV](data-audit-2026-09-25.csv)는 160개 세션의 시즌·대회·세션 코드, 시작·종료, 한국어 장소, 공식 서킷명, 공식 페이지, 불일치 항목을 담는다. 시간 지정 일정은 `+09:00`이 있는 한국 시각이며, 종일 일정은 `YYYYMMDD` 형식의 원본 예정일이다. 종일 일정의 종료 날짜는 마지막 표시일 다음 날이다. `findings`가 비어 있으면 해당 세션에서 검사한 항목에 불일치가 없다는 뜻이며, 시즌 전체에 빠진 대회가 없다는 뜻은 아니다.

## 등록된 GP별 대조

| 시즌 | GP | 세션 수 | 표시 | 시각·예정일 대조 |
| --- | --- | --- | --- | --- |
| 2026 | [라스베이거스 GP](https://www.formula1.com/en/racing/2026/las-vegas) | 5 | 시간 지정 | 일치 |
| 2026 | [멕시코 GP](https://www.formula1.com/en/racing/2026/mexico) | 5 | 시간 지정 | 일치 |
| 2026 | [미국 GP](https://www.formula1.com/en/racing/2026/united-states) | 5 | 시간 지정 | 일치 |
| 2026 | [바레인 GP](https://www.formula1.com/en/racing/2026/bahrain) | 5 | 시간 지정 | 일치 |
| 2026 | [브라질 GP](https://www.formula1.com/en/racing/2026/brazil) | 5 | 시간 지정 | 일치 |
| 2026 | [스페인 GP](https://www.formula1.com/en/racing/2026/spain) | 5 | 시간 지정 | 일치 |
| 2026 | [싱가포르 GP](https://www.formula1.com/en/racing/2026/singapore) | 5 | 시간 지정 | 일치 |
| 2026 | [아부다비 GP](https://www.formula1.com/en/racing/2026/united-arab-emirates) | 5 | 시간 지정 | 일치 |
| 2026 | [아제르바이잔 GP](https://www.formula1.com/en/racing/2026/azerbaijan) | 5 | 시간 지정 | 일치 |
| 2026 | [카타르 GP](https://www.formula1.com/en/racing/2026/qatar) | 5 | 시간 지정 | 일치 |
| 2027 | [라스베이거스 GP](https://www.formula1.com/en/racing/2027/las-vegas) | 5 | 종일 · 시간 미정 | 일치 |
| 2027 | [마이애미 GP](https://www.formula1.com/en/racing/2027/miami) | 5 | 종일 · 시간 미정 | 일치 |
| 2027 | [멕시코 GP](https://www.formula1.com/en/racing/2027/mexico) | 5 | 종일 · 시간 미정 | 일치 |
| 2027 | [모나코 GP](https://www.formula1.com/en/racing/2027/monaco) | 5 | 종일 · 시간 미정 | 일치 |
| 2027 | [미국 GP](https://www.formula1.com/en/racing/2027/united-states) | 5 | 종일 · 시간 미정 | 일치 |
| 2027 | [바레인 GP](https://www.formula1.com/en/racing/2027/bahrain) | 5 | 종일 · 시간 미정 | 일치 |
| 2027 | [벨기에 GP](https://www.formula1.com/en/racing/2027/belgium) | 5 | 종일 · 시간 미정 | 일치 |
| 2027 | [브라질 GP](https://www.formula1.com/en/racing/2027/brazil) | 5 | 종일 · 시간 미정 | 일치 |
| 2027 | [사우디아라비아 GP](https://www.formula1.com/en/racing/2027/saudi-arabia) | 5 | 종일 · 시간 미정 | 일치 |
| 2027 | [스페인 GP](https://www.formula1.com/en/racing/2027/spain) | 5 | 종일 · 시간 미정 | 일치 |
| 2027 | [싱가포르 GP](https://www.formula1.com/en/racing/2027/singapore) | 5 | 종일 · 시간 미정 | 일치 |
| 2027 | [아부다비 GP](https://www.formula1.com/en/racing/2027/united-arab-emirates) | 5 | 종일 · 시간 미정 | 일치 |
| 2027 | [아제르바이잔 GP](https://www.formula1.com/en/racing/2027/azerbaijan) | 5 | 종일 · 시간 미정 | 일치 |
| 2027 | [이탈리아 GP](https://www.formula1.com/en/racing/2027/italy) | 5 | 종일 · 시간 미정 | 일치 |
| 2027 | [일본 GP](https://www.formula1.com/en/racing/2027/japan) | 5 | 종일 · 시간 미정 | 일치 |
| 2027 | [중국 GP](https://www.formula1.com/en/racing/2027/china) | 5 | 종일 · 시간 미정 | 일치 |
| 2027 | [카타르 GP](https://www.formula1.com/en/racing/2027/qatar) | 5 | 종일 · 시간 미정 | 일치 |
| 2027 | [캐나다 GP](https://www.formula1.com/en/racing/2027/canada) | 5 | 종일 · 시간 미정 | 일치 |
| 2027 | [튀르키예 GP](https://www.formula1.com/en/racing/2027/turkey) | 5 | 종일 · 시간 미정 | 일치 |
| 2027 | [포르투갈 GP](https://www.formula1.com/en/racing/2027/portugal) | 5 | 종일 · 시간 미정 | 일치 |
| 2027 | [헝가리 GP](https://www.formula1.com/en/racing/2027/hungary) | 5 | 종일 · 시간 미정 | 일치 |
| 2027 | [호주 GP](https://www.formula1.com/en/racing/2027/australia) | 5 | 종일 · 시간 미정 | 일치 |

시즌 포함 여부의 기준: [2026 공식 목록](https://www.formula1.com/en/racing/2026), [2027 공식 목록](https://www.formula1.com/en/racing/2027).
