/**
 * 번들 샘플 2편의 전 항목 스냅샷.
 *
 *   node scripts/snapshot.js before.json
 *   ... 엔진을 고친다 ...
 *   node scripts/snapshot.js after.json
 *   node scripts/compare.js before.json after.json
 *
 * 엔진을 고칠 때마다 이걸 돌린다. 바뀌면 안 되는 것이 안 바뀌었음을 보이는
 * 것이 목적이고, 바뀐 항목 목록이 곧 검토 대상이다.
 *
 * 주의: 번들 샘플은 업로드 경로를 재현하지 못한다(CLAUDE.md "샘플 데이터
 * 사실" 참조 — 줄바꿈이 있는 텍스트라 줄 앵커 파서가 여기서만 동작한다).
 * 줄 앵커나 PDF 텍스트 조립을 건드렸다면 실 PDF 4편을 브라우저로 따로 확인할 것.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const engine = require(path.join(ROOT, 'notam_engine.js'));

/** 샘플 파일은 최상위 const 하나다. require 로는 안 잡히므로 읽어서 평가한다. */
function loadSample(file, varName) {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    return eval(src + '; ' + varName);
}

const SAMPLES = [
    ['AAR223', 'aar223_text.js', 'SAMPLE_AAR223_FULL_TEXT'],
    ['AAR202', 'aar202_text.js', 'SAMPLE_AAR202_FULL_TEXT']
];

/* 교차 대조 결과(`xc`)를 한 줄로 줄인다.
 *
 * **이게 없으면 판정을 바꿔도 하네스가 "변경 없음"이라고 답한다.** 실제로 두 번
 * 당했다 — 화면에 그대로 찍히는 `reasonBadge` 를 바꿨을 때, 그리고 일일 운영시간
 * 판정을 "판정 불가"로 바꿨을 때. 분류·음영만 보고 있으면 정작 조종사가 읽는
 * 결론이 바뀐 것을 못 본다.
 *
 * 부동소수는 반올림해 담는다. 의미 없는 끝자리 차이로 매번 diff 가 나면
 * 아무도 목록을 안 읽게 된다. */
function xcDigest(x) {
    if (!x) return null;
    const r1 = (v) => (typeof v === 'number' ? Math.round(v) : v);
    return {
        time: x.timeState,
        stn: x.stationMatch,
        fir: x.firMatch,
        review: x.needsReview,
        relevant: x.relevant,
        limits: (x.limits || []).join('|'),
        route: (x.routeHits || []).join('|'),
        geo: x.geo ? r1(x.geo.minNm) + '/' + x.geo.lateralClear + '/' + x.geo.vertClear : null,
        // **개수만 담으면 판정이 뒤집혀도 못 잡는다.** 금지공역 `entered`
        // false→true, 구간선 `crosses` false→true, CDR `INSIDE→OUTSIDE` 가
        // 전부 "변경 0건"으로 지나갔다. 대상 식별자와 판정값을 같이 담는다.
        zones: x.zones
            ? ((x.zones.banned || []).map((z) => 'B' + z.entered + '/' + r1(z.nearestNm)).join(',') +
               ';' + (x.zones.gates || []).map((g) => 'G' + g.crosses + '/' + r1(g.nearestNm)).join(','))
            : null,
        // passage 는 시각·거리뿐 아니라 **일일창 판정과 최종 활성 여부**까지.
        // 이걸 빼 두었다가 `dailyAt` 우회를 고쳤는데도 "차이 없음" 이 나왔다.
        pass: x.passage
            ? [x.passage.reason, r1(x.passage.utcMin), r1(x.passage.nm) + 'NM',
               'daily=' + String(x.passage.dailyAt),
               'unread=' + String(!!x.passage.dailyUnread),
               'active=' + String(x.passage.active)].join('/')
            : null,
        cdr: (x.cdr || []).map((c) => c.awy + ':' + c.verdict + '/' + r1(c.marginMin)).join('|'),
        cond: (x.conditions || []).map((c) => c.ref + ':' + c.verdict).join('|'),
        // 일일 운영시간은 "안/밖"뿐 아니라 **판정했는지 여부**까지 담아야 한다.
        daily: x.dailyCheck
            ? (x.dailyCheck.complete ? String(x.dailyCheck.inWindow) : '판정불가') +
              '@' + r1(x.dailyCheck.entry)
            : null
    };
}

/** 한 문서의 전 항목을, 대조에 쓸 필드만 남겨서. */
function snapshot(text) {
    const flight = engine.analyseFlight(text);
    const xcByIndex = flight.items.map((it) => xcDigest(it.xc));
    return engine.parseAllRawNotamsWithShading(text).map((n, i) => ({
        // NOTAM 번호는 유일하지 않다(CLAUDE.md). 위치를 키에 넣는다.
        k: i + ' ' + n.id,
        pkg: n.pkg,
        reason: n.reasonCategory,
        shaded: n.autoShaded,
        cat: n.categoryKey,
        subj: n.subjectLabel,
        ko: n.koreanExplanation,
        // 화면에 그대로 찍히는 엔진 산출물이다. 빠뜨리면 문구를 바꿔도
        // compare 가 "변경 0건"이라고 답한다 — 실제로 한 번 놓칠 뻔했다.
        badge: n.reasonBadge,
        detail: n.reasonDetail,
        // 조종사가 실제로 읽는 결론. 분류·음영이 그대로여도 이게 바뀌면
        // 화면이 다른 말을 하고 있다는 뜻이다.
        xc: xcByIndex[i] || null
    }));
}

function main() {
    const out = process.argv[2];
    if (!out) {
        console.error('사용법: node scripts/snapshot.js <출력.json>');
        process.exit(2);
    }
    const result = {};
    for (const [name, file, varName] of SAMPLES) {
        result[name] = snapshot(loadSample(file, varName));
    }
    fs.writeFileSync(out, JSON.stringify(result, null, 1), 'utf8');
    console.log(out + ' 기록: ' +
        Object.entries(result).map(([k, v]) => k + ' ' + v.length + '건').join(', '));
}

if (require.main === module) main();
module.exports = { snapshot, loadSample, SAMPLES, ROOT };
