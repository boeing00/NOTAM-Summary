/**
 * 화면 렌더 검사. 엔진이 아니라 **index.html 의 화면 코드**를 돌린다.
 *
 *   node scripts/screen.js
 *
 * 위반이 있으면 종료 코드 1.
 *
 * 왜 필요한가: audit.js 는 notam_engine.js 만 본다. 화면 코드는 브라우저에서만
 * 돌기 때문에 한 번도 검사된 적이 없었고, 그래서 `keep()` 을 지웠을 때 목록
 * 뷰가 통째로 죽은 채("분석에 실패했습니다: keep is not defined") 커밋까지
 * 갔다. 문서를 열면 render() 가 먼저 도는데, 사람이 보고서 탭만 확인하면
 * 그대로 지나간다.
 *
 * 어떻게: node 의 vm 위에 **아주 얇은 DOM 흉내**를 세우고 엔진·샘플·화면
 * 스크립트를 한 덩어리로 실행한 뒤, show() 를 불러 세 뷰를 실제로 그린다.
 * 브라우저가 아니므로 레이아웃·스타일은 모른다 — 이 검사가 답하는 것은
 * **"터지지 않고, 항목을 잃지 않는가"** 하나다.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

/** index.html 의 마지막 <script> 블록 — 화면 코드 전부가 여기 있다. */
function inlineScript(file) {
    const blocks = read(file).match(/<script>([\s\S]*?)<\/script>/g) || [];
    if (!blocks.length) throw new Error(file + ' 에 인라인 <script> 가 없다');
    return blocks[blocks.length - 1].replace(/^<script>/, '').replace(/<\/script>$/, '');
}

/* ------------------------------------------------------------------ *
 * 아주 얇은 DOM. 화면 코드가 부르는 것만 있으면 된다 — 없는 걸 부르면
 * 그 자체가 검사 결과다(터진다).
 * ------------------------------------------------------------------ */
function makeEl(tag) {
    return {
        tagName: String(tag || 'div').toUpperCase(),
        innerHTML: '', textContent: '', value: '', title: '', hidden: false,
        style: {}, dataset: {}, className: '',
        classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
        addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
        appendChild() {}, removeChild() {}, remove() {},
        setAttribute() {}, getAttribute() { return null; }, hasAttribute() { return false; },
        scrollIntoView() {}, focus() {}, click() {},
        querySelector() { return null; }, querySelectorAll() { return []; },
        closest() { return null; },
        getBoundingClientRect() { return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }; },
        parentElement: null, firstElementChild: null, lastElementChild: null
    };
}

function makeSandbox() {
    const els = new Map();
    const document = {
        getElementById(id) {
            if (!els.has(id)) els.set(id, makeEl('div'));
            return els.get(id);
        },
        querySelector() { return null; },
        querySelectorAll() { return []; },
        createElement(t) { return makeEl(t); },
        addEventListener() {}, removeEventListener() {},
        body: makeEl('body'),
        documentElement: makeEl('html'),
        scripts: [],
        visibilityState: 'visible'
    };
    const sandbox = {
        document,
        navigator: {},                       // serviceWorker 없음 → 등록 경로를 타지 않는다
        location: { reload() {}, href: 'http://localhost/' },
        // show() 가 페인트를 위해 한 번 양보한다. 검사에서는 즉시 돌린다.
        setTimeout(fn) { if (typeof fn === 'function') fn(); return 0; },
        clearTimeout() {}, setInterval() { return 0; }, clearInterval() {},
        console,
        __els: els
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.window.addEventListener = () => {};
    sandbox.window.scrollTo = () => {};
    sandbox.window.matchMedia = () => ({ matches: false, addEventListener() {} });
    // 화면 코드가 로드 시점에 워커 경로를 박는다. PDF 를 여는 경로는 이
    // 검사의 대상이 아니다(번들 샘플로 도는 검사다) — 자리만 있으면 된다.
    sandbox.pdfjsLib = { GlobalWorkerOptions: {}, getDocument() { throw new Error('not used'); } };
    sandbox.MutationObserver = function () { return { observe() {}, disconnect() {} }; };
    sandbox.IntersectionObserver = function () { return { observe() {}, disconnect() {} }; };
    return sandbox;
}

/* ------------------------------------------------------------------ */

const count = (hay, needle) => hay.split(needle).length - 1;

const SAMPLES = [
    ['AAR223', 'aar223_text.js', 'SAMPLE_AAR223_FULL_TEXT'],
    ['AAR202', 'aar202_text.js', 'SAMPLE_AAR202_FULL_TEXT']
];

function runOne(name, file, varName, fail) {
    const sandbox = makeSandbox();
    vm.createContext(sandbox);

    // 엔진 → 샘플 → 화면 코드 → 검사. 한 스크립트로 붙여야 최상위 const 가
    // 서로 보인다(각각 돌리면 렉시컬 스코프가 갈린다).
    const src = [
        read('notam_engine.js'),
        read(file),
        inlineScript('index.html'),
        // 최상위 let/const 는 렉시컬 바인딩이라 sandbox 속성으로 안 보인다.
        // 같은 스크립트 안에서 닫아 잡아 꺼낸다.
        'globalThis.__run = function () { show(' + varName + ', ' + JSON.stringify(name) + '); };\n' +
        'globalThis.__state = function () {\n' +
        '  return { total: DATA ? DATA.items.length : 0,\n' +
        '           pkg1: DATA ? DATA.items.filter(function (i) { return i.pkg === 1; }).length : 0 };\n' +
        '};'
    ].join('\n;\n');

    try {
        vm.runInContext(src, sandbox, { filename: 'screen-bundle.js' });
    } catch (e) {
        fail(name + ' 화면 코드 로드 중 터짐: ' + e.message);
        return;
    }

    try {
        sandbox.__run();
    } catch (e) {
        fail(name + ' show() 가 터짐: ' + e.message);
        return;
    }

    const el = (id) => sandbox.__els.get(id) || makeEl('div');
    const out = el('out').innerHTML;

    // show() 는 render() 실패를 try/catch 로 잡아 화면에 배너만 띄운다.
    // 터지지 않았다고 넘어가면 안 되는 이유다 — 정확히 그렇게 놓쳤다.
    if (/class="err"/.test(out)) {
        // 얇은 DOM 이라 innerHTML 을 넣어도 textContent 가 따라오지 않는다.
        // 무엇이 터졌는지 말하지 않는 실패 메시지는 쓸모가 없으므로 직접 벗긴다.
        const msg = out.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
        fail(name + ' 목록 뷰가 오류 배너를 띄웠다 — ' + msg.slice(0, 140));
        return;
    }

    const state = sandbox.__state();
    if (!state.total) { fail(name + ' DATA 가 비었다'); return; }
    const total = state.total;

    const cards = count(out, '<details class="n"');
    if (cards !== total) {
        fail(name + ' 목록 뷰 카드 수가 엔진 항목 수와 다르다: ' +
            cards + ' vs ' + total + ' (접어도 사라지면 안 된다)');
    }

    for (const [v, id, label] of [['report', 'report', '항로'], ['airport', 'airport', '공항']]) {
        try {
            sandbox.setView(v);
        } catch (e) {
            fail(name + ' ' + label + ' 뷰가 터짐: ' + e.message);
            continue;
        }
        const html = el(id).innerHTML;
        if (html.length < 500) {
            fail(name + ' ' + label + ' 뷰가 비었다 (' + html.length + '자)');
        }
    }

    // 공항 뷰는 PACKAGE 1 을 하나도 잃지 않아야 한다.
    const p1 = state.pkg1;
    const ri = count(el("airport").innerHTML, "<div class=\"ri");   // .rid(번호 span)까지 세지 않게 div 로 좁힌다
    if (p1 && ri !== p1) {
        fail(name + ' 공항 뷰 항목 수가 PACKAGE 1 과 다르다: ' + ri + ' vs ' + p1);
    }

    console.log('  OK   ' + name + ' — 목록 ' + cards + '건, 공항 ' + ri + '건, 항로/공항 렌더');
}

function main() {
    const problems = [];
    const fail = (m) => { problems.push(m); console.log('  위반 ' + m); };

    for (const [name, file, varName] of SAMPLES) runOne(name, file, varName, fail);

    console.log('\n' + (problems.length
        ? '화면 렌더 검사 위반 ' + problems.length + '건.'
        : '화면 렌더 검사 통과 — 세 뷰가 터지지 않고 항목을 잃지 않는다.'));
    process.exit(problems.length ? 1 : 0);
}

if (require.main === module) main();
