# 회귀 하네스

엔진(`notam_engine.js`)을 고칠 때 **바뀌면 안 되는 것이 안 바뀌었음을 보이기 위한** 도구다.
의존성 없음. node 만 있으면 된다. 빌드 단계는 여전히 없다.

## 엔진을 고칠 때

```bash
node scripts/snapshot.js before.json     # 고치기 전
#   ... 엔진을 고친다 ...
node scripts/snapshot.js after.json
node scripts/compare.js before.json after.json
node scripts/audit.js
```

`compare.js` 가 내놓는 **변경 항목 목록이 곧 검토 대상이다.** 의도한 것만 바뀌었는지
눈으로 확인하고, 그 숫자를 커밋 본문에 적는다. 변경이 있으면 종료 코드 1인데
실패라는 뜻이 아니라 읽으라는 뜻이다.

`audit.js` 는 다르다. 위반이 나오면 **버그다.**

## 파일

| | |
|---|---|
| `snapshot.js` | 번들 샘플 2편(826건)의 전 항목을 `{pkg, reason, shaded, cat, subj, ko}` 로 기록 |
| `compare.js` | 스냅샷 둘을 전수 대조하고 바뀐 항목만 출력 |
| `audit.js` | 불변식 검사 5종. CLAUDE.md "고쳐놓은 함정"이 다시 들어왔는지 본다 |

## audit.js 가 보는 것

1. 유도로 항목이 활주로 전면 폐쇄를 주장하지 않는다
2. 활주로 전면 폐쇄 해설과 음영 판정이 어긋나지 않는다
3. 해설이 발행 station 과 다른 공항을 괄호로 가리키지 않는다
4. 모든 항목이 PACKAGE 1·2·3 중 하나에 속한다
5. 음영 처리된 항목은 CRITICAL 이 아니다

**규칙을 여기서 다시 구현하지 않는다.** 엔진의 내부 정규식을 복사해 오면 두 벌이 되어
갈라지고, 그게 바로 이 파일이 잡으려는 버그다 — 활주로/유도로 가드가 음영 판정 안에만
있고 해설기에는 없어서 `KJFK A7030/26`(`E) TWY FB BTN RWY 04L/22R AND RWY 04R/22L CLSD`)이
"활주로 04R/22L 전면 폐쇄"로 설명되고 있었다. 여기서는 **엔진이 낸 결과들이 서로 모순되지
않는지**만 묻는다.

검사 1·2는 그 버그로 확인했다. 가드를 빼면 둘 다 그 2건을 잡고 원문 `E)` 절까지 찍는다.

## 한계 — 이걸로 충분하지 않은 경우

번들 샘플은 **업로드 경로를 재현하지 못한다.** 샘플에는 줄바꿈이 있어 줄 앵커를 쓰는
파서가 동작하지만, 실제 PDF 업로드 경로는 한때 `parseOfpWaypoints` · `parseCdrTable` ·
`parseDailyWindow` 가 통째로 죽어 있었는데도 데모는 멀쩡했다(CLAUDE.md 참조).

**줄 앵커·PDF 텍스트 조립·좌표 추출을 건드렸다면** 실 PDF 4편을 브라우저로 따로 확인할 것.
파일 목록은 CLAUDE.md "샘플 데이터 사실"에 있고, **파일명이 편명과 어긋나니 믿지 말 것.**

기하·시공간 판정(`geoCheck` · `trackNearest` · `checkStatedConditions`)은 아직 이 하네스가
보지 않는다. 손검산값은 CLAUDE.md 에 있다.
