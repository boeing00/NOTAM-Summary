# NOTAM & Route Compliance EFB

조종사용 단일 파일 웹앱. OFP(운항계획서) PDF를 브라우저에서 파싱해 NOTAM을 전량
나열하고, **FPL 항로와 NOTAM 제한 조건을 교차 대조**한다.

라이브: https://boeing00.github.io/NOTAM-Summary/
저장소: `boeing00/NOTAM-Summary` · 로컬 `C:\Users\moons\NOTAM-Summary`
배포: main 푸시 → GitHub Pages, 약 30~60초. 확인은 아래로.

```bash
curl -s "https://boeing00.github.io/NOTAM-Summary/index.html?cb=$RANDOM" | grep -c parseCdrTable
```

## 파일

| 파일 | 역할 |
|---|---|
| `notam_engine.js` | **엔진.** 순수 함수만. DOM·렌더·앱 상태 없음. 두 화면이 공유한다 |
| `index.html` | 데스크톱 화면. UI·스타일·브리핑 렌더 |
| `ipad.html` | 아이패드 화면. 목록 뷰(PACKAGE 1·3을 주제별로 묶음) + 원문 PDF 뷰 |
| `aar223_text.js` / `aar202_text.js` | 번들 샘플. OFP 원문 전체를 JS 문자열 하나로 담고 있음 |
| `sw.js`, `manifest.json` | PWA |
| `python_cli/` | 별개의 파이썬 CLI. 앱과 공유 코드 없음 |

빌드 단계는 없다. 엔진은 평범한 `<script src>`로 로드되어 전역을 정의하고,
파일 끝의 `module.exports`는 node에서만 발화한다(회귀 하네스용, 브라우저에선 무시).

**엔진을 고치면 두 화면이 같이 바뀐다.** 그게 분리한 이유다.

```bash
node --check notam_engine.js
python -c "
import io,re
s=io.open('index.html',encoding='utf-8').read()
io.open('chk.js','w',encoding='utf-8',newline='\n').write(re.findall(r'<script>([\s\S]*?)</script>',s)[-1])
" && node --check chk.js && rm chk.js
```

엔진 분리는 **동작이 바뀌면 안 되는 순수 이동**이었다. 회귀 하네스로 4편 PDF ×
flat/lines 8회를 전후 대조해 바이트 단위 동일을 확인했다. 엔진을 다시 옮길 일이
있으면 같은 방식으로 증명할 것.

## 절대 규칙

**없는 것을 지어내지 않는다.** NOTAM 번호·유효기간·좌표를 합성하지 않는다.

**기계가 계산하지 않은 준수 판정을 쓰지 않는다.** 근거를 보여주고 판단은 조종사가
한다. 화면 문구가 "위반"이 아니라 **"확인 필요"**인 이유다. 거짓 경보의 비용이
누락의 비용만큼 크다.

**딱 하나의 예외가 기하 계산이다.** 거리·고도·포함 여부는 산술이지 독해가 아니므로
결과를 단정한다. 그 외에는 원문을 띄우고 강조만 한다.

이 원칙 때문에 두 번 거절한 적이 있다. 사용자가 필터를 조여달라고 했을 때
항목을 **숨기지 않고** 순위와 라벨만 조정했다. 근거: `CZEG F4091/26`은 지명된
픽스가 회랑이 아니라 경계 참조였다 — 숨겼으면 판단 근거가 사라졌을 것이다.

## 문서가 스스로 선언한 구조 — 추론하지 말고 읽을 것

OFP는 NOTAM을 세 묶음으로 나눠 인쇄한다. 4편 샘플 전부 형식이 같다.

| | 범위 | 태그 |
|---|---|---|
| PACKAGE 1 | 출발·목적지·목적지 교체 | `[DEP]` `[DEST]` `[ALTN]` |
| PACKAGE 2 | 재출항·ETP·항로상 회항 공항 | `[REFILE]` `[ETP]` `[ERA]` |
| PACKAGE 3 | 항로. `FIR:` 헤더가 붙는다 | 태그 없음 |

종료 문구가 1번만 다르다 — `END OF PACKAGE 1`, `END OF NOTAM PACKAGE 2|3`.
`parseNotamSections()`가 `END OF (?:NOTAM )?PACKAGE [123]`로 둘 다 받는다.

그 안에 주제 헤더가 또 있다(`◼ RUNWAY`, `◼ RUNWAY LIGHT`, `◼ TAXIWAY`, `◼ NAVAID`,
`◼ AIRWAY` … 4편 통틀어 18종). `NOTAM_CATEGORIES`가 이걸 13개 그룹으로 묶는다.
**`<X> LIGHT`는 `<X>`와 같은 그룹이다** — 활주로 중심선등과 활주로 폐쇄는 같은 활주로고,
그 활주로를 찾는 조종사는 둘 다 한자리에서 봐야 한다. 묶는 건 주제 기준,
음영은 성격 기준(`evaluateAutoShading`)으로 **서로 독립**이다.

**PACKAGE 2는 기본 분석 대상이 아니다** (지휘관 지시 2026-09-07). 요청이 있을 때만 켠다.
단 **분석 제외지 목록 제외가 아니다** — 원문 목록에는 남기고 건수를 표시한다.
빼도 리뷰 목록은 안 줄어든다(실측: 리뷰 89건 전부가 PACKAGE 3). 줄어드는 건 분량이다
(AAR223 491 → 218건). 주의: 필드 18의 `RALT/KORD PANC RJCC`는 FPL에 신고된 공항인데
문서상 PACKAGE 2의 `[ETP]`에 있어, 빼면 공항 통계에서 빠진다.

주제 헤더는 **다음 NOTAM 헤더 전에 놓여 앞 NOTAM 본문으로 샌다.** `◼`가 나오면 블록을
끊는다 — `[DEST]` 누출과 같은 계열이고, 안 끊으면 마지막 항목이 `... U/S ◼ RUNWAY LIGHT`가 된다.

## 원문 PDF 위에 표시하기 (`ipad.html` 원문 뷰)

`extractPdfLayout()`이 텍스트와 **좌표를 한 번에** 낸다. 조각마다 `fullText` 오프셋과
페이지 위 상자(y는 위에서부터)를 갖고, NOTAM은 자기 문자범위(`at`/`to`)를 갖는다.
둘을 겹치면 어느 쪽 어느 사각형을 칠할지 정해진다.

`extractTextFromPdfFile()`은 이제 그 위의 얇은 껍데기다. **텍스트 조립이 한 곳이어야**
엔진이 파싱하는 문자열과 오버레이가 색인하는 문자열이 갈라지지 않는다. 이 통합이
텍스트를 한 바이트도 바꾸지 않았음을 실 PDF 4편으로 확인했다(구현 전후 문자열 동일,
조각 143,150개 오프셋 정합 100%).

주의할 점 둘:

- **`join("\n")`과 hasEOL마다 `"\n"` 덧붙이기는 페이지 끝에서 갈린다.** 마지막 조각이
  줄을 끝내면 후자에만 개행이 남는다. 끝의 개행 하나를 떼야 같아진다.
- **페이지는 보이는 것만 그리고 멀어지면 놓는다.** 99쪽을 레티나로 다 들고 있으면
  250MB가 넘어 사파리가 탭을 죽인다. `IntersectionObserver`로 앞뒤 한 화면만 그리면
  25쪽에서 80쪽으로 건너뛰어도 캔버스 18개 · 45MB로 평평하다.

한 NOTAM이 페이지 경계를 넘으면 양쪽 페이지에 표시된다(`A7258/26`이 25·26쪽에 걸친다).
그래서 표시 개수(527)가 NOTAM 수(491)보다 많다.

## 교차 대조 엔진 (`notam_engine.js`)

진입점은 둘이다. `analyseFlight(fullText)`는 **전 항목**을 판정해 돌려주고(순위·필터·절단
없음 — 무엇을 보여줄지는 화면이 정한다), `buildCrossCheck()`는 상위 40건 요약을 낸다.
둘 다 `buildCrossCheckContext()`로 같은 ctx를 만든다 — **두 화면이 비행을 다르게
구성하면 안 된다.**

### 파이프라인

```
OFP PDF ─pdf.js─→ 원문 텍스트
   ├─ parseIcaoFpl()          15항 항로 · 18항 EET/DOF/RALT
   ├─ extractRouteTokens()    fixes / airways / navaids / 위경도점
   ├─ routeLegs()             "GTC L512 TENAS" → L512 구간은 GTC~TENAS
   ├─ parseOfpWaypoints()     OFP 웨이포인트 표 (좌표 + 누적시간 + FIR 경계)
   └─ crossCheckNotam()       NOTAM 1건씩 대조
```

### `parseOfpWaypoints()` — 이 문서에서 가장 값진 자료

15항에는 **시각이 전혀 없다.** OFP의 3줄 블록이 언제 어디에 있는지 말해주는
유일한 곳이고, FIR 경계를 넘는 지점의 이름도 여기 있다.

```
0043  N36 22.4  131 330 ---/015 2906 33 28034P030 01 495   005  025
LANAT E131 25.7 133        /                      43 525 00.36 0312/
/ RJJJ FIR      122   FUKUOKA                     LANAT
```

1줄: 거리, 위도 · 2줄: 지점명, 경도, **누적시간(`00.36`)** · 3줄: FIR 경계(있을 때)

AAR223 기준 66개 지점 중 62개가 시각을 갖는다. `ctx.wpMin[지점명] = 분`,
`ctx.baseMs = DOF + ETD`.

### 분류 규칙

```js
routeRelated = inWindow && !stationMatch && (firMatch || strong.length > 0)
needsReview  = routeRelated && limits.length > 0 && !navaidNoise
```

- `strong` = 항로 픽스/항공로 일치, `weak` = 항법시설 일치
- `navaidNoise` — 항법시설 U/S인데 **우리 항로 시설이 하나도 안 나올 때만** 제외.
  같은 줄에 시설명과 U/S 표현이 있어야 하고, **TRIGGER NOTAM / AIP SUP은 절대
  제외하지 않는다**(예고 범위를 알 수 없음).
- `scopedElsewhere` — 지명된 게 전부 우리 항로 밖이면 하단으로

### 픽스 오탐 제어

5글자 대문자 토큰을 그냥 픽스로 보면 `CONST` `CRANE` `AVOID` `ATOLL`이 다 걸린다.
**`ROUTE_CUES`가 3토큰 이내에 있어야** 픽스로 인정한다(338 → 81건). 여기에
`PROSE_5` 불용어 목록을 더한다. 토크나이저는 `/[^A-Z0-9]+/`로 쪼갠다 —
`Y722/B576`은 한 토큰이 아니라 둘이다.

### 기하

- `geoCheck` — 도형까지의 **거리**. 원/다각형.
- `zoneCheck` — **포함·교차**. 금지 공역(`MUST NOT FLT PLAN THROUGH`)과
  좌표 구간선(`BTN <좌표> AND <좌표>`).
- `shiftLon()` — 경도를 한 프레임에 모은다. **이 노선들은 전부 날짜변경선을
  넘는다.** 170E와 152W를 생경도로 빼면 38°가 322°가 된다.

**측정 대상은 OFP 웨이포인트 표로 만든 폴리라인이다** (`buildRouteTrack`). 15항에는
좌표로 신고된 대양점 몇 개뿐이라(JFK편 10점, LAX편 5점) 육상 구간에는 비교할 점이
아예 없었다. 서울 반경 2NM 비행금지구역 `RKRR D1768/26`을 **2,704NM 떨어졌다**고
보고하고 있었다 — 가장 가까운 게 태평양 한복판 점이었기 때문이다. 표를 쓰면 **6NM**이다.
15항 점은 표가 없는 문서를 위한 폴백으로 남아 있고, 어느 쪽으로 쟀는지는 `geomSource`가 말한다.

`splitWaypointRuns()` — 표는 하나가 아니다. 계획 항로, 회항/재출항 항로(누적시각이
0으로 리셋된다: NODAN 12.34 다음 NANAC **00.16**), 그리고 판에 따라 계획 항로 재인쇄.
누적시각이 줄어드는 지점이 경계다. **가장 긴 런이 계획 항로다.** `ctx.wpMin`을 이 런에서만
채운다 — 이름을 키로 뒤가 이기게 넣고 있어서 **회항 시각이 계획 시각을 덮어쓰고 있었다.**

`planarLegs()` — 평면 판정(`pointInPolygon`/`segCross`)에 넘길 구간을 고른다.
`shiftLon`이 접은 프레임의 **반대편에 있는 구간은 양 끝이 +179와 −179로 나와** 그
사이 직선이 프레임 전체를 가로지르며 없는 교차를 만든다. 15항 대양점 몇 개일 때는
드러나지 않다가 경도 200°를 가로지르는 60점 트랙에서 터진다. 연속 웨이포인트가
경도 90°를 벌리는 일은 없으므로, 그만큼 벌어졌으면 비행 경로가 아니라 접힘이다.

`extractProhibitedAreas`는 **금지 문구 뒤에 이어지는 좌표만** 취한다. NOTAM 하나에
서로 다른 좌표 묶음이 여럿 있다.

`extractGeoArea`의 다각형은 **연속된 좌표 런**만 쓴다. 꼭짓점 사이는
`TO`/`AND`/`THENCE`로만 이어지므로 그 외 문구가 끼면 절을 끊는다. 거리 임계값은
오답이다 — `A2472/26`의 해당 간격이 51자다.

### 조항별 준수 대조 (`checkStatedConditions`)

일부 NOTAM은 공역을 서술하지 않고 **비행계획이 만족해야 할 번호 붙은 조건**을 나열한다.
`PAZA A2472/26`(USER PREFERRED ROUTE FLIGHT PLANNING GUIDELINES)과 `PAZA A0176/26`이
전형이다. 조항을 **읽는** 것은 이 파일이 할 수 없는 일이지만, **시험하는** 것은 할 수 있다 —
"GOATS가 우리가 신고한 픽스에 있는가", "NATES가 NIKLL보다 동쪽인가",
"순항고도가 FL310 이하인가"는 집합 연산과 산술이고, 그게 절대 규칙이 인정한 예외다.

조항은 **전부 나열하고** 각각 한 가지 상태를 받는다.

| | 뜻 |
|---|---|
| 충족 | 문서에 인쇄된 값으로 시험이 돌았고 통과했다 |
| 확인 필요 | 시험이 돌았고 요구하는 것을 찾지 못했다 |
| 해당 없음 | 조항 자신의 전제가 이 비행에 대해 거짓이다 |
| 판정 불가 | 시험에 필요한 입력이 이 문서에 없다 |
| 직접 확인 | 이 문장에 맞는 기계 판정 규칙이 없다 |

**"확인 필요"는 의도적으로 "위반"이 아니다.** 항로 파싱이 불완전해서 시험이 실패할 수도
있고, 거짓 경보의 비용은 누락만큼 크다. 화면에는 계산 결과를 입력값과 함께 내놓는다.

구현된 시험 형태 6종: `MUST FLT PLAN OVER ONE OF THE FOLLOWING FIXES:` 목록,
`JOIN <항공로> OVER OR <방위> OF <픽스>`, `CROSS <픽스> AT OR BLW/ABV FL<nnn>`,
`CROSS <픽스> BTN <hhmm> UTC AND <hhmm> UTC`,
`MUST BE ESTABLISHED EITHER: (A)… (B)…`, `RTES/FIXES ARE NOT AVBL: (A)… (B)…`.

**함정 셋 — 전부 실물에서 터졌다.**

**전제를 먼저 판정하지 않으면 거짓 경보가 난다.** `A0176/26` 1항은
"FLTS ENTERING ANCHORAGE FIR **N OF 620000N1410000W**"에만 걸린다. AAR202·AAR224는
`OMOTO`(48.99N)로 PAZA에 들어가므로 애초에 대상이 아닌데, 전제를 안 보면 둘 다
"확인 필요"가 뜬다. 진입점은 웨이포인트 표의 FIR 경계 행에서 온다(`firEntryPoint`).

**목록의 여러 토큰은 픽스가 아니라 경로다.** 같은 NOTAM 2항의
`(A) FIORD, CHAPO, FANES, GOATS DCT FYU`를 픽스 넷으로 읽으면 `GOATS`를 사용 불가로
찍는다 — 그런데 **같은 NOTAM 1항이 요구하는 게 `GOATS DCT BTT`**고 AAR223이 실제로
그렇게 신고했다. 못 쓰는 건 `GOATS-FYU` 구간이지 `GOATS`가 아니다. `hasLeg()`가
15항 토큰 순서로 인접 여부를 본다.

**절 제목은 조항이 아니다.** `2. USER PREFERRED ROUTE ENTERY/EXIT BTN CZEG, CZVR OR
KZAK FIR:`는 아래 A·B·C를 소개할 뿐 자기 의무가 없다. 이것까지 "직접 확인"으로 세면
정작 판정된 조항이 묻힌다.

**검증**: CLAUDE.md 손계산값과 전부 일치한다 — AAR223 2.A `GOATS` ✅,
3.A `NATES`(171.97E) > `NIKLL`(169.34E) ✅, AAR202 CZEG 미통과 → 해당 없음,
5항 `KUNAD/LUMES/KOKES` 3편 모두 항로에 없음. 4편 통틀어 "확인 필요" 0건이다.

### FIR별 운항 요약 (`buildFirBriefing`) — 첫 화면

조종사는 항로를 NOTAM 번호 목록이 아니라 **공역의 연속**으로 읽는다. FIR을 통과 순서대로
걸으면서 각 FIR에 그 아래 신고된 항목과 계산된 근거를 붙인다.

```
KZNY@0600Z → KZBW@0602Z → CZUL@0640Z → CZWG@0816Z → CZEG@0913Z
   → PAZA@1155Z → RJJJ@1645Z → RKRR@2000Z
```

- **진입 시각·지점은 웨이포인트 표의 FIR 경계 행에서 온다** (`firCrossings`). EET는 폴백이고,
  폴백을 쓴 구간은 화면에 "EET 추정"으로 표시한다.
- **출발 FIR은 EET에 없다.** 18항 EET는 *진입하는* FIR만 적는다. 그래서
  **PACKAGE 3에 NOTAM을 내면서 EET에 없는 FIR이 출발 FIR**이다 — JFK 출발이면 KZNY,
  인천 출발이면 RKRR. 공항 ICAO로 추측하지 않는다.
- **`ADIZ`는 FIR이 아니다.** 웨이포인트 표가 같은 칸에 찍는다. 안 걸러내면 AAR202가
  `KZAK → ADIZ → KZSE`로 읽힌다. EET 파서가 같은 이유로 이미 거르고 있었다.
- 공항 NOTAM(PACKAGE 1)은 **첫 FIR과 마지막 FIR**에 붙는다 — 문서가 어느 공항이
  출발·목적지·교체인지 말하므로 지리를 추측할 필요가 없다.
- 어느 FIR에도 안 붙은 항목은 `orphans`로 따로 낸다. **빠뜨리면 요약이 완결된 것처럼
  보인다.** 4편 실측 전부 0건.

**마무리 문장에 "전 구간 수용, 안심하고 운항하십시오"를 쓰지 않는다.** 정직하게 끝낼 수
있는 말은 "근거를 낸 것이 N건, 원문을 읽어야 하는 것이 M건"뿐이다. 지휘관이 그런 형태의
요약(다른 LLM 출력)을 예시로 준 적이 있는데, 거기엔 계산한 적 없는
"RVR 기준도 충족하여 정상 착륙 가능"과 "완벽히 수용" 같은 문장이 들어 있었다. 나머지는
전부 이미 계산하던 값이라 그대로 서술로 냈고, 그 두 종류만 뺐다.

### CDR (조건부 항공로)

`parseCdrTable` → `cdrCheck`. 항공로 이름·타임스탬프 개방창·OFP 통과시각이 모두
있어 **판정까지 가능한 드문 유형**이다. 지연 여유(분)도 함께 낸다.

RJJJ 형식(`1)  L512  2608291200/2608292200  MEA`)만 읽는다.
**RKRR 한국식 CDR2는 못 읽는다** — 구간명이 `MASTA-UPGOS`처럼 픽스 쌍이고 시각이
8자리(MMDDHHmm, 연도 없음)다. 목록에는 올리되 자동 판정은 하지 않는다.

## 고쳐놓은 함정 (다시 넣지 말 것)

**`segNm`의 부호 없는 along-track.** `Math.acos`는 `[0, π]`만 반환하므로
`if (along < 0)` 가드가 한 번도 작동하지 않았다. 구간 **뒤쪽** 점이 무한 연장된
대권까지의 거리로 측정됐다 — 515NM 뒤 꼭짓점을 65NM으로 보고. `cos(delta)`로
부호를 준다.

**`\bF(\d{3})\b`는 0건을 매칭한다.** `N0493F310`에 단어 경계가 없다.
`F(\d{3})(?![0-9])` — 11건.

**EET 파서**가 `ADIZ`를 FIR로 잡고 `160W0614`에서 스캔을 멈춰 KZAK 이후를 통째로
잃었다. `[\s\S]*?` 전방탐색 + `ADIZ` 건너뛰기.

**OFP 본문이 NOTAM 블록으로 샜다.** pdf.js는 `CFP PLAN`을 `CFP   PLAN`으로 준다.
`\s+`로 매칭하고 줄 앵커를 뺀다. `Page \d+`는 **대소문자 구분** — NOTAM 본문의
`PAGE 12`는 살려야 한다. 이 누출이 `RKRR Z0390/26`(28토큰)을 1순위 오탐으로
만들고 있었다.

**NOTAM ID는 유일하지 않다.** 행 상태는 위치 기반 키로.

**줄 앵커를 쓰는 파서는 flat 텍스트에서 조용히 0건이었다.** `extractTextFromPdfFile`이
pdf.js 조각을 `join(" ")`로 이어붙여 줄바꿈이 하나도 없었다. `parseOfpWaypoints`(항상 0행),
`parseCdrTable`(`/^\s*\d+\)/gm`, 항상 0건), `parseDailyWindow`(`/^D\)/m`, 항상 null)가
**프로덕션에서 통째로 죽어 있었다.** 번들 샘플에는 줄바꿈이 있어 데모만 동작했다.
지금은 `item.hasEOL`로 줄을 복원한다 — 업로드 경로와 데모 경로가 같은 형태를 만든다.

**활주로는 두 방향을 한꺼번에 고시한다.** `RWY 04R/22L CLSD`. CRITICAL 판정 정규식에
`(?:/\d{1,2}[LCR]?)?`가 없어 **전면 폐쇄를 전부 놓쳤다** — 출발 당일 교차 활주로 두 개를
닫은 `KJFK A7259/26`·`A7258/26`, CLAUDE.md가 1순위로 적어둔 `KLAX A4733/26`까지.
단, 넓히면 `TWY FB BTN RWY 04L/22R AND RWY 04R/22L CLSD`가 딸려 온다 — 닫힌 건
유도로다. `E)` 절이 `TWY`로 시작하면 제외한다.

**등화 판정이 어순을 탔다.** 규칙이 `TWY...LGT`·`LGT U/S`·`ENTRY LGT...U/S` 같은
특정 어구를 찾고 있어서, `RWY 04R LEAD OFF LGT AT TWY FB U/S`(LGT가 TWY보다 앞이고
U/S와 떨어져 있다)가 일반 항목으로 떨어졌다. lead-on/lead-off·stop bar 7건이 같은 이유로
새고 있었다. 등화는 어순과 무관하게 등화이므로 **등화 자체**(`LGT|LIGHT|STOP BAR|PAPI…`)를
매칭한다. 4편 전수로 확인했다 — 정확히 그 7건만 늘고 다른 건 안 늘었다. 활주로 폐쇄는
CRITICAL을 먼저 보므로 영향 없다.

**분류 안에서는 대상 단위로 묶는다** (`extractSubject`). 헤더는 "RUNWAY"라고만 하지
어느 활주로인지 말하지 않는다. **04R과 22L은 같은 활주로**이므로(상호 = n+18을 1~36으로
감고 L↔R 교환) 한 그룹이다 — `RWY 04R/22L CLSD`와 `RWY 04R LEAD OFF LGT`가 같은 자리에
온다. 유도로 NOTAM은 위치를 말하려고 활주로를 언급한다(`TWY FB BTN RWY 04L/22R AND
RWY 04R/22L CLSD`는 TWY FB를 닫는다) — 먼저 나온 활주로를 집으면 엉뚱한 데로 간다.
**헤더가 어느 종류인지 이미 말하므로 그것이 우선순위를 정한다.**

**푸시했는데 브라우저가 구버전을 준다.** 서비스워커가 아니라 **브라우저 HTTP 캐시**다.
GitHub Pages는 HTML에 `Cache-Control: max-age=600`을 붙이고, Pages에서는 이 헤더를
바꿀 수 없다. 진단은 이렇게 갈린다 — `./ipad.html?probe=랜덤`은 새 파일인데
`./ipad.html`은 구 파일이면 HTTP 캐시고, 서비스워커면 `caches.keys()`에 뭔가 있다.

이 때문에 두 가지를 고쳤다. **`fetch(e.request)`는 HTTP 캐시를 거친다** — network-first가
이름값을 하려면 동일 출처 요청은 `new Request(req, {cache:'reload'})`로 우회해야 한다.
CDN 파일은 버전 고정이고 기내 와이파이에서 재다운로드가 더 비싸므로 그대로 둔다.
그리고 **`ipad.html`이 서비스워커를 등록하지 않고 있었다** — 등록은 `index.html`에만
있었으므로, 이 페이지를 홈 화면에 추가한 조종사는 오프라인 사본이 아예 없었다.

**엔진을 고치면 `?v=` 를 올린다.** `notam_engine.js?v=3.0`은 URL로 캐시되므로 버전을
안 올리면 기존 사용자가 구버전 엔진을 받는다. 실제로 한 번 당했다.

**한국어 해설기가 문구만 보고 고유명사를 하드코딩했다.** `generateKoreanExplanation`의
규칙 다수가 NOTAM을 어구로 알아보고 답에 공항 이름을 박아 넣는다 — `RWY 15L/33R CLSD`면
"인천공항(RKSI)"이라고 답한다. 활주로 번호는 공항 간에 유일하지 않으므로 **보스턴 폐쇄가
인천으로**(`KBOS A1380/26`), **시카고가 뉴욕 JFK로**(`KORD A8450/26`) 설명됐다. 화산
주의보에는 본문에 없는 고도대(`SFC~FL250`)까지 붙었다 — `PAZA A2278/26`은 색상 코드와
경고문뿐이고 고도가 한 글자도 없다.

손으로 쓴 스무 개 분기를 믿는 대신 **답을 발행 station과 대조한다.** 다른 ICAO를
가리키면 규칙이 엉뚱한 공항에 걸린 것이므로 일반 문구로 떨어뜨린다. 괄호 ICAO만 보면
안 된다 — "뉴욕 JFK 공항"에는 ICAO가 아예 없어서 첫 가드를 그대로 통과했다.
`KO_AIRPORT_HINTS`가 도시 이름도 본다. 전수 감사(`audit_invented.js`) 기준 1,530개
항목 중 근거 없는 주장 0건.

**좌표에 공백이 들어간다.** `SHEVELUCH VOLCANO / 563800N 1611900E /` — 위경도 사이가
떨어져 있어 `\d{6}[NS]\d{7}[EW]`가 못 읽었다. 화산 주의보의 이격 거리가 통째로 안
나오고 있었다. 패턴 셋에 `\s?`를 넣고 `decodeLatLon`이 공백을 떼도록 했다 — 4편에서
기하 판정 5건 증가, 이상값 없음.

**감사 스크립트에서 `\b125\b`는 `125FT`를 매칭하지 않는다.** `F`가 단어 문자라 숫자
뒤에 경계가 없다. 이걸로 정상 추출된 크레인 높이를 전부 "지어낸 값"으로 보고했다.
숫자 뒤 경계는 `(?!\d)`로 확인할 것.

## 작업 함정 (에이전트용)

**Bash heredoc이 백슬래시를 먹는다.** 이 세션에서 여러 번 정규식을 깨뜨렸다
(`'\\'` → `'\'`, 문자열 미종료). 백슬래시가 들어가는 패치는 **Write 툴로 파이썬
스크립트를 쓰고** 실행하거나, 치환용 자리표시자(`BS` 등)를 쓴 뒤 마지막에
`chr(92)`로 바꾼다. `Edit` 툴은 안전하다.

**템플릿 리터럴 삼항 경계.** `${x ? \`...\` : \`...\`}`에서 else-arm을 넘어
치환하면 `SyntaxError`가 난다. 패치 후 반드시 `node --check`.

## 샘플 데이터 사실 (재도출 비용이 큼)

| | AAR223 KJFK→RKSI | AAR202 RKSI→KLAX | AAR224 RKSI→KJFK |
|---|---|---|---|
| DOF / ETD | 260829 / 0600Z | 260829 / 0340Z | 260810 / — |
| EET FIR | KZBW CZUL CZWG **CZEG** PAZA RJJJ RKRR | RJJJ PAZA **KZAK** KZSE KZOA KZLA | RJJJ PAZA **CZEG** CZWG CZYZ KZBW KZNY |
| CZEG 게이트 | `GOATS` 66.837N 141.000W | 미통과 | `GAHAM` 62.250N 141.000W |
| PAZA 진입 | — | `OMOTO` 48.995N 160.012E | `OMOTO` |
| 항법시설 | CAM BTT SDE GTC KAE | GTC OAK | — |

**회귀 샘플 PDF 4편** (지휘관 지정 2026-09-07). 파일명이 편명과 어긋나니 믿지 말 것.

| `C:\Users\moons\Downloads\` | 편명 | 구간 | 쪽 |
|---|---|---|---|
| `ImportantFile223.pdf` | AAR223 | KJFK→RKSI | 99 |
| `ImportantFile224 (1).pdf` | AAR224 | RKSI→KJFK | 94 |
| `ImportantFile201.pdf` | **AAR203** | KLAX→RKSI | 72 |
| `ImportantFile (1).pdf` | **AAR202** | RKSI→KLAX | 85 |

전부 2026-08-29 DOF. 왕복 2쌍이라 방향별 회귀가 된다. 번들 샘플(`aar223_text.js`)로만
검증하면 안 된다 — 업로드 경로를 재현하지 못한다.

**`PAZA A2472/26` 판정 (손계산 검증됨)**
- 2.A CZEG 지정 픽스: AAR223 `GOATS` ✅ / AAR224 `GAHAM` ✅
- 2.C KZAK: AAR202 진입점 53.933N 158.918W → 지정 구간 1,463NM 중 245NM(16.7%) 지점 = 안쪽 ✅, 금지 사각형 최근접 184NM ✅
- 3.A R220 조인: AAR223 `NATES`(171.975E)가 `NIKLL`(169.343E)보다 동쪽 ✅
- 4.A: AAR202 `AMOND`가 R580상 `OBOYD`보다 112NM 남쪽 ✅ / AAR224는 OPHET·OBOYD를 지나 ORCCA까지 R580 유지 → **R580 연장 좌표가 문서에 없어 판정 보류**
- 5항 KUNAD/LUMES/KOKES: 세 편 모두 항로에 없음

**`RJJJ Q2053/26` (CDR)** — L512 개방 29일 1200~2200Z, AAR223 통과 1919~2010Z,
개방 시간 내, 여유 110분. 앱이 자동 판정한다.

## 미결 사항

1. **시각이 붙은 궤적이 없다** — 웨이포인트 표의 누적시각(4편 전부 100% 보유)을 궤적에
   묶으면 "최근접 구간을 지나는 그 시각에 NOTAM이 유효한가"를 물을 수 있다. 지금 시간
   판정은 비행 창 전체 대 FIR 진입 한 순간뿐이다. 기준점은 검증됐다 — `RKSI 14.59` +
   ETD 0600Z = 2059Z = OFP 인쇄 ETA, 즉 **누적시각은 오프블록 기준**이고 `baseMs =
   DOF + ETD`가 맞다. 택시시간 보정 불필요.
2. **RKRR 한국식 CDR2 표 파서** — `Z0632/26`. 구간 양 끝 지점이 우리 항로에 있는지로 매칭하면 됨
3. **좌표가 없어 판정 못 하는 조항들** — 문서에는 **우리 항로 위 지점의 좌표만** 인쇄된다.
   그래서 `ZENNA`·`SAYNT`(A2472/26 2.C), `KATCH`(2.B), `AKISU`(3.C)는 판정 불가다.
   항공로 중심선 좌표가 없어 `REMAIN 50NM SOUTH OF A590` 계열(3.C·4.C·5.A)도 마찬가지다.
   반대로 `NIKLL`은 AAR223 표에 있어 3.A가 계산된다 — **가용성은 편마다 다르다.**
4. **`◼ RUNWAY LIGHT` 헤더 아래인데 본문은 유도로인 건이 있다** (`KJFK A4688/26`
   `TWY A CL LGT`). 헤더로는 활주로, 대상으로는 유도로다. 지금은 헤더를 따라 활주로
   분류에 들어가고 소그룹만 `TWY A`가 된다. 어느 쪽이 맞는지 미결.
5. **localhost 전용 `SyntaxError: Unexpected token ')'`** — 내 변경 이전 HEAD에서도 재현, 라이브에는 없음. 환경 문제로 판단하고 손대지 않음

## 관련 저장소 (헷갈리지 말 것)

| 저장소 | 위치 | 무엇 |
|---|---|---|
| **NOTAM-Summary** | `C:\Users\moons\NOTAM-Summary` | 이 앱 |
| pilot_Briefing_tool | `C:\Users\moons\AndroidStudioProjects\pilot_Briefing_tool` | Vite+React EFB, Gemini 브라우저 직접 호출 |
| OFP-Analyzer | `C:\Users\moons\OFP-Analyzer` | 단일 HTML CFP 분석기 (`build.js`로 합침) |
| NOTAM-Briefer | `C:\Users\moons\NOTAM-Briefer` | 4탭 브리핑 앱 |
