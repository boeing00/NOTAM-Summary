/**
 * 불변식 검사. CLAUDE.md "고쳐놓은 함정"에 적힌 것들이 다시 들어오지 않았는지 본다.
 *
 *   node scripts/audit.js
 *
 * 위반이 있으면 종료 코드 1.
 *
 * 규칙을 여기서 다시 구현하지 않는다. 엔진의 내부 정규식을 복사해 오면
 * 두 벌이 되어 갈라지고, 그게 바로 이 파일이 잡으려는 버그다(활주로/유도로
 * 가드가 음영 판정에만 있고 해설기에는 없어서 유도로 폐쇄가 "활주로 전면
 * 폐쇄"로 설명됐다). 여기서는 **결과가 서로 모순되지 않는지**만 묻는다.
 */
const { snapshot, loadSample, SAMPLES } = require('./snapshot.js');
const path = require('path');
const engine = require(path.join(__dirname, '..', 'notam_engine.js'));

/** 해설이 활주로 전면 폐쇄를 주장하는가. */
const claimsRunwayClosure = (ko) => /활주로\s.*전면\s*폐쇄/.test(String(ko || ''));

const CHECKS = [
    {
        name: '유도로 항목이 활주로 전면 폐쇄를 주장하지 않는다',
        why: '유도로 NOTAM은 위치를 말하려고 활주로를 언급한다. ' +
             'TWY FB BTN RWY 04L/22R AND RWY 04R/22L CLSD 가 닫는 건 TWY FB다.',
        bad: (n) => n.categoryKey === 'TAXIWAY' && claimsRunwayClosure(n.koreanExplanation)
    },
    {
        name: '활주로 전면 폐쇄 해설과 음영 판정이 어긋나지 않는다',
        why: '같은 질문에 답하는 두 규칙이 갈라졌다는 뜻이다. ' +
             '한쪽만 고치면 화면에서 배지와 문장이 서로 다른 말을 한다.',
        bad: (n) => claimsRunwayClosure(n.koreanExplanation) && n.reasonCategory !== 'CRITICAL'
    },
    {
        name: '해설이 발행 station 과 다른 공항을 괄호로 가리키지 않는다',
        why: '활주로 번호는 공항 간에 유일하지 않다. 보스턴 폐쇄가 인천으로 ' +
             '설명되던 함정(KBOS A1380/26).',
        bad: (n) => {
            const m = String(n.koreanExplanation || '').match(/\(([A-Z]{4})\)/);
            return !!m && m[1] !== n.station;
        }
    },
    {
        name: '모든 항목이 PACKAGE 1·2·3 중 하나에 속한다',
        why: 'pkg 0 은 어느 구획에도 안 들어갔다는 뜻이고, 구획 경계 파싱이 ' +
             '깨졌다는 신호다. 추측으로 메우지 않고 0 으로 보고하게 되어 있다.',
        bad: (n) => !(n.pkg >= 1 && n.pkg <= 3)
    },
    {
        name: '음영 처리된 항목은 CRITICAL 이 아니다',
        why: 'Important(CRITICAL)는 절대 음영 불가 대상이다.',
        bad: (n) => n.autoShaded && n.reasonCategory === 'CRITICAL'
    }
];

function main() {
    const docs = SAMPLES.map(([name, file, varName]) => [
        name,
        engine.parseAllRawNotamsWithShading(loadSample(file, varName))
    ]);

    console.log('샘플: ' + docs.map(([n, l]) => n + ' ' + l.length + '건').join(', ') + '\n');

    let failed = 0;
    for (const check of CHECKS) {
        const hits = [];
        for (const [name, list] of docs) {
            list.forEach((n) => { if (check.bad(n)) hits.push([name, n]); });
        }
        if (!hits.length) {
            console.log('  OK   ' + check.name);
            continue;
        }
        failed += 1;
        console.log('\n  위반 ' + check.name + '  — ' + hits.length + '건');
        console.log('       ' + check.why);
        hits.slice(0, 10).forEach(([name, n]) => {
            const e = String(n.raw).toUpperCase().match(/E\)\s*([\s\S]{0,100})/);
            console.log('\n       ' + name + ' ' + n.id +
                '  [' + n.reasonCategory + '] 분류=' + n.categoryKey + ' 대상=' + n.subjectLabel);
            console.log('       원문 E) ' + (e ? e[1].replace(/\s+/g, ' ').trim() : '?'));
            console.log('       해설    ' + n.koreanExplanation);
        });
        if (hits.length > 10) console.log('\n       ... 외 ' + (hits.length - 10) + '건');
        console.log('');
    }

    console.log('\n검사 ' + CHECKS.length + '개 중 ' +
        (failed ? '위반 ' + failed + '개' : '전부 통과') + '.');
    process.exit(failed ? 1 : 0);
}

if (require.main === module) main();
module.exports = { CHECKS, claimsRunwayClosure };
