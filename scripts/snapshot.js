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

/** 한 문서의 전 항목을, 대조에 쓸 필드만 남겨서. */
function snapshot(text) {
    return engine.parseAllRawNotamsWithShading(text).map((n, i) => ({
        // NOTAM 번호는 유일하지 않다(CLAUDE.md). 위치를 키에 넣는다.
        k: i + ' ' + n.id,
        pkg: n.pkg,
        reason: n.reasonCategory,
        shaded: n.autoShaded,
        cat: n.categoryKey,
        subj: n.subjectLabel,
        ko: n.koreanExplanation
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
