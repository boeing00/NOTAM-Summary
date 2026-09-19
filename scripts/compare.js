/**
 * 스냅샷 두 개를 전수 대조하고 바뀐 항목만 낸다.
 *
 *   node scripts/compare.js before.json after.json
 *
 * 변경이 있으면 종료 코드 1이다. 실패라는 뜻이 아니라 **읽으라는 뜻**이다 —
 * 의도한 변경이면 그 목록이 곧 커밋 본문에 적을 근거다.
 */
const fs = require('fs');

const FIELDS = ['pkg', 'reason', 'shaded', 'cat', 'subj', 'ko'];

function compare(A, B) {
    let total = 0, changed = 0;
    const names = Array.from(new Set(Object.keys(A).concat(Object.keys(B))));

    for (const name of names) {
        const a = A[name] || [], b = B[name] || [];
        if (a.length !== b.length) {
            console.log('!! ' + name + ' 건수가 다르다: ' + a.length + ' -> ' + b.length +
                '  (파서가 블록 경계를 다르게 잡았다는 뜻이다)');
        }
        for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
            total += 1;
            const diff = FIELDS.filter((f) =>
                JSON.stringify(a[i][f]) !== JSON.stringify(b[i][f]));
            if (!diff.length) continue;
            changed += 1;
            console.log('\n--- ' + name + ' ' + a[i].k + '   (' + diff.join(', ') + ')');
            for (const f of diff) {
                console.log('  전: ' + JSON.stringify(a[i][f]));
                console.log('  후: ' + JSON.stringify(b[i][f]));
            }
        }
    }
    return { total, changed };
}

function main() {
    const [, , before, after] = process.argv;
    if (!before || !after) {
        console.error('사용법: node scripts/compare.js <before.json> <after.json>');
        process.exit(2);
    }
    const r = compare(
        JSON.parse(fs.readFileSync(before, 'utf8')),
        JSON.parse(fs.readFileSync(after, 'utf8'))
    );
    console.log('\n전수 ' + r.total + '건 중 변경 ' + r.changed + '건');
    process.exit(r.changed ? 1 : 0);
}

if (require.main === module) main();
module.exports = { compare };
