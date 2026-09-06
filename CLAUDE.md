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

`extractProhibitedAreas`는 **금지 문구 뒤에 이어지는 좌표만** 취한다. NOTAM 하나에
서로 다른 좌표 묶음이 여럿 있다.

`extractGeoArea`의 다각형은 **연속된 좌표 런**만 쓴다. 꼭짓점 사이는
`TO`/`AND`/`THENCE`로만 이어지므로 그 외 문구가 끼면 절을 끊는다. 거리 임계값은
오답이다 — `A2472/26`의 해당 간격이 51자다.

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

1. **항로 폴리라인이 15항 대양점뿐이다** — `geoCheck`/`zoneCheck`에 들어가는
   `ctx.route.pointList`는 15항의 `55N170W` 형태 토큰만 디코딩한 것이다(AAR223 10점,
   AAR202 5점). OFP 웨이포인트 표에는 좌표가 65개 지점 다 있는데 쓰지 않는다.
   증상이 화면에 그대로 찍힌다: `RKRR Z0479/26 이격 2728NM` — 한국 FIR NOTAM인데
   비교할 점이 태평양 한복판밖에 없어서다. 육상 구간의 기하 판정은 지금 근거가 없다.
2. **시각이 붙은 궤적이 없다** — 웨이포인트 표의 누적시각(4편 전부 100% 보유)을 궤적에
   묶으면 "최근접 구간을 지나는 그 시각에 NOTAM이 유효한가"를 물을 수 있다. 지금 시간
   판정은 비행 창 전체 대 FIR 진입 한 순간뿐이다. 기준점은 검증됐다 — `RKSI 14.59` +
   ETD 0600Z = 2059Z = OFP 인쇄 ETA, 즉 **누적시각은 오프블록 기준**이고 `baseMs =
   DOF + ETD`가 맞다. 택시시간 보정 불필요.
3. **웨이포인트 표가 세 덩어리다** — 주항로, 회항/재출항표(누적시각이 리셋된다:
   NODAN 12.34 다음 NANAC **00.16**), 그리고 주항로 재인쇄. 지금은
   `ctx.wpMin[이름] = 분`을 뒤가 이기게 채우므로 **회항 시각이 주항로 시각을 덮어쓴다.**
   단조증가 런으로 끊어야 한다.
4. **RKRR 한국식 CDR2 표 파서** — `Z0632/26`. 구간 양 끝 지점이 우리 항로에 있는지로 매칭하면 됨
3. **`ZENNA`/`SAYNT` 좌표 없음** — A2472/26 2.C 첫 대안은 판정 불가(둘째 좌표 대안이 충족되므로 실무상 무해)
4. **localhost 전용 `SyntaxError: Unexpected token ')'`** — 내 변경 이전 HEAD에서도 재현, 라이브에는 없음. 환경 문제로 판단하고 손대지 않음

## 관련 저장소 (헷갈리지 말 것)

| 저장소 | 위치 | 무엇 |
|---|---|---|
| **NOTAM-Summary** | `C:\Users\moons\NOTAM-Summary` | 이 앱 |
| pilot_Briefing_tool | `C:\Users\moons\AndroidStudioProjects\pilot_Briefing_tool` | Vite+React EFB, Gemini 브라우저 직접 호출 |
| OFP-Analyzer | `C:\Users\moons\OFP-Analyzer` | 단일 HTML CFP 분석기 (`build.js`로 합침) |
| NOTAM-Briefer | `C:\Users\moons\NOTAM-Briefer` | 4탭 브리핑 앱 |
