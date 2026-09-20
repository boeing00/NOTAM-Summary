/**
 * 스냅샷 두 개를 전수 대조하고 바뀐 것만 낸다.
 *
 *   node scripts/compare.js before.json after.json
 *
 * 변경이 있으면 종료 코드 1이다. 실패라는 뜻이 아니라 **읽으라는 뜻**이다 —
 * 의도한 변경이면 그 목록이 곧 커밋 본문에 적을 근거다.
 *
 * **위치로만 맞대면 삭제와 교체를 통째로 놓친다.** 예전 판은 길이가 다르면
 * 메시지만 찍고 `Math.min` 까지만 돌았고, 비교 필드에 항목 식별자가 없었다.
 * 그래서 마지막 항목을 지워도, 필드 여덟 개를 그대로 둔 채 NOTAM 번호만
 * 갈아치워도 "변경 0건"으로 통과했다 — 검증 도구가 거짓 안심을 주고 있었다.
 *
 * 지금은 넷을 따로 센다: 추가 · 삭제 · 이동(순서 변경) · 필드 변경.
 * 하나라도 있으면 종료 코드에 반영한다.
 *
 * **NOTAM 번호는 유일하지 않다**(CLAUDE.md). 그래서 같은 번호가 여러 번
 * 나오면 등장 순서대로 짝을 짓는다 — 번호만으로 집합 연산을 하면 중복이
 * 있는 문서에서 엉뚱한 추가·삭제가 보고된다.
 */
const fs = require('fs');

const FIELDS = ['pkg', 'reason', 'shaded', 'cat', 'subj', 'ko', 'badge', 'detail'];

/** 스냅샷 키는 `<위치> <STATION NUM>` 이다. 위치와 식별자를 갈라 둔다. */
function splitKey(k) {
    const s = String(k == null ? '' : k);
    const sp = s.indexOf(' ');
    if (sp < 0) return { pos: -1, id: s };
    const pos = Number(s.slice(0, sp));
    return { pos: Number.isFinite(pos) ? pos : -1, id: s.slice(sp + 1) };
}

/** 같은 식별자끼리 등장 순서대로 짝짓는다. 남는 쪽이 추가/삭제다. */
function pairById(a, b) {
    const index = (list) => {
        const m = new Map();
        list.forEach((row, i) => {
            const { pos, id } = splitKey(row.k);
            if (!m.has(id)) m.set(id, []);
            m.get(id).push({ row, i, pos });
        });
        return m;
    };
    const ia = index(a), ib = index(b);
    const ids = Array.from(new Set([...ia.keys(), ...ib.keys()]));

    const pairs = [], added = [], removed = [];
    for (const id of ids) {
        const la = ia.get(id) || [], lb = ib.get(id) || [];
        const n = Math.min(la.length, lb.length);
        for (let i = 0; i < n; i += 1) pairs.push({ id, a: la[i], b: lb[i] });
        for (let i = n; i < la.length; i += 1) removed.push({ id, at: la[i] });
        for (let i = n; i < lb.length; i += 1) added.push({ id, at: lb[i] });
    }
    // 보고 순서는 before 기준 위치로. 사람이 문서를 따라 읽는 순서다.
    pairs.sort((x, y) => x.a.i - y.a.i);
    removed.sort((x, y) => x.at.i - y.at.i);
    added.sort((x, y) => x.at.i - y.at.i);
    return { pairs, added, removed };
}

function compare(A, B) {
    const tally = { total: 0, changed: 0, added: 0, removed: 0, moved: 0, docs: 0 };
    const names = Array.from(new Set(Object.keys(A).concat(Object.keys(B))));

    for (const name of names) {
        if (!A[name] || !B[name]) {
            tally.docs += 1;
            console.log('!! ' + name + ' 가 ' + (A[name] ? 'after' : 'before') + ' 에 없다');
            continue;
        }
        const a = A[name], b = B[name];
        if (a.length !== b.length) {
            console.log('!! ' + name + ' 건수가 다르다: ' + a.length + ' -> ' + b.length +
                '  (파서가 블록 경계를 다르게 잡았다는 뜻이다)');
        }

        const { pairs, added, removed } = pairById(a, b);
        tally.total += pairs.length;

        removed.forEach((r) => {
            tally.removed += 1;
            console.log('\n--- ' + name + ' [삭제] ' + r.id + '  (before ' + r.at.i + '번째)');
            console.log('  내용: ' + JSON.stringify(r.at.row.ko || '').slice(0, 120));
        });
        added.forEach((r) => {
            tally.added += 1;
            console.log('\n+++ ' + name + ' [추가] ' + r.id + '  (after ' + r.at.i + '번째)');
            console.log('  내용: ' + JSON.stringify(r.at.row.ko || '').slice(0, 120));
        });

        for (const p of pairs) {
            const diff = FIELDS.filter((f) =>
                JSON.stringify(p.a.row[f]) !== JSON.stringify(p.b.row[f]));
            // 위치가 바뀐 것도 사실이다. 앞 항목이 하나 빠지면 뒤가 전부 밀리므로
            // 개수만 세고 낱낱이 찍지 않는다 — 삭제/추가가 이미 원인을 말한다.
            if (p.a.pos !== p.b.pos) tally.moved += 1;
            if (!diff.length) continue;
            tally.changed += 1;
            console.log('\n--- ' + name + ' ' + p.id + '   (' + diff.join(', ') + ')');
            for (const f of diff) {
                console.log('  전: ' + JSON.stringify(p.a.row[f]));
                console.log('  후: ' + JSON.stringify(p.b.row[f]));
            }
        }
    }
    return tally;
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

    const bits = [];
    if (r.changed) bits.push('필드 변경 ' + r.changed);
    if (r.added) bits.push('추가 ' + r.added);
    if (r.removed) bits.push('삭제 ' + r.removed);
    if (r.moved) bits.push('위치 이동 ' + r.moved);
    if (r.docs) bits.push('문서 불일치 ' + r.docs);

    console.log('\n짝지은 ' + r.total + '건 · ' + (bits.length ? bits.join(' · ') : '차이 없음'));
    process.exit(bits.length ? 1 : 0);
}

if (require.main === module) main();
module.exports = { compare, pairById, splitKey };
