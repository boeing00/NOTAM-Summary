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
| `index.html` | **앱 전체.** 약 3,000줄. 엔진·UI·스타일이 전부 여기 인라인 |
| `aar223_text.js` / `aar202_text.js` | 번들 샘플. OFP 원문 전체를 JS 문자열 하나로 담고 있음 |
| `sw.js`, `manifest.json` | PWA |
| `notam_engine.js` | **빈 껍데기.** "NOT LOADED" 주석만 있음. 삭제 여부 미결 |
| `python_cli/` | 별개의 파이썬 CLI. 앱과 공유 코드 없음 |

`index.html` 하나뿐이므로 빌드 단계가 없다. 문법 검사는 이렇게:

```bash
python -c "
import io,re
s=io.open('index.html',encoding='utf-8').read()
io.open('chk.js','w',encoding='utf-8',newline='\n').write(re.findall(r'<script>([\s\S]*?)</script>',s)[-1])
" && node --check chk.js && rm chk.js
```

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

## 교차 대조 엔진 (`index.html`)

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

AAR224는 `NOTAM-Summary`에 없다 — `pilot_Briefing_tool`의
`frontend/src/data/sample_aar224_kjfk.json`에 있다(별개 저장소).

**`PAZA A2472/26` 판정 (손계산 검증됨)**
- 2.A CZEG 지정 픽스: AAR223 `GOATS` ✅ / AAR224 `GAHAM` ✅
- 2.C KZAK: AAR202 진입점 53.933N 158.918W → 지정 구간 1,463NM 중 245NM(16.7%) 지점 = 안쪽 ✅, 금지 사각형 최근접 184NM ✅
- 3.A R220 조인: AAR223 `NATES`(171.975E)가 `NIKLL`(169.343E)보다 동쪽 ✅
- 4.A: AAR202 `AMOND`가 R580상 `OBOYD`보다 112NM 남쪽 ✅ / AAR224는 OPHET·OBOYD를 지나 ORCCA까지 R580 유지 → **R580 연장 좌표가 문서에 없어 판정 보류**
- 5항 KUNAD/LUMES/KOKES: 세 편 모두 항로에 없음

**`RJJJ Q2053/26` (CDR)** — L512 개방 29일 1200~2200Z, AAR223 통과 1919~2010Z,
개방 시간 내, 여유 110분. 앱이 자동 판정한다.

## 미결 사항

1. **`notam_engine.js` 삭제 여부** — 지금은 "NOT LOADED" 주석뿐
2. **RKRR 한국식 CDR2 표 파서** — `Z0632/26`. 구간 양 끝 지점이 우리 항로에 있는지로 매칭하면 됨
3. **`ZENNA`/`SAYNT` 좌표 없음** — A2472/26 2.C 첫 대안은 판정 불가(둘째 좌표 대안이 충족되므로 실무상 무해)
4. **localhost 전용 `SyntaxError: Unexpected token ')'`** — 내 변경 이전 HEAD에서도 재현, 라이브에는 없음. 환경 문제로 판단하고 손대지 않음

## 관련 저장소 (헷갈리지 말 것)

| 저장소 | 위치 | 무엇 |
|---|---|---|
| **NOTAM-Summary** | `C:\Users\moons\NOTAM-Summary` | 이 앱 |
| pilot_Briefing_tool | `C:\Users\moons\AndroidStudioProjects\pilot_Briefing_tool` | Vite+React EFB, Gemini 브라우저 직접 호출 |
| OFP-Analyzer | `C:\Users\moons\OFP-Analyzer` | 단일 HTML CFP 분석기 (`build.js`로 합침) |
| NOTAM-Briefer | `C:\Users\moons\NOTAM-Briefer` | 4탭 브리핑 앱 |
