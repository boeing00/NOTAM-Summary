/**
 * AI 해설 프록시.
 *
 * 이 앱은 정적 사이트다. 키를 클라이언트에 넣으면 공개되므로, 키는 여기
 * 환경변수에만 둔다. Vercel 은 `api/*.js` 를 설정 없이 서버리스 함수로 잡으므로
 * `vercel.json` 을 만들지 않는다 — CLAUDE.md 가 금지한 그것이다(cleanUrls 가
 * `/index.html` 을 308 로 만들고, 리디렉션된 응답을 서비스워커가 내비게이션에
 * 돌려주면 브라우저가 거부한다).
 *
 * 환경변수
 *   ANTHROPIC_API_KEY   필수. 없으면 이 경로는 503 을 내고 화면은 "본인 키를
 *                       넣으십시오"로 떨어진다.
 *   EXPLAIN_TOKEN       선택. 걸어 두면 X-Explain-Token 헤더가 일치해야 한다.
 *                       주소를 아는 누구나 호출해 쿼터를 태울 수 있기 때문이다.
 *
 * 이 함수는 **중계만 한다.** 프롬프트를 만들지도, 결과를 손보지도 않는다 —
 * 무엇을 묻고 무엇을 믿을지는 화면이 정하고(index.html 의 aiGuard), 그래야
 * 규칙이 한 곳에만 있다.
 */

const API = 'https://api.anthropic.com/v1/messages';
const MAX_BODY = 200 * 1024;     // 한 FIR 분량이면 넉넉하다

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'POST 만 받습니다' });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    // 열쇠가 없다는 것과 호출이 실패했다는 것은 다른 사실이다. 화면이 전자를
    // 보면 본인 키 입력란을 안내하고, 후자면 다시 시도하라고 말한다.
    return res.status(503).json({ error: 'NO_SERVER_KEY' });
  }

  const want = process.env.EXPLAIN_TOKEN;
  if (want && req.headers['x-explain-token'] !== want) {
    return res.status(401).json({ error: 'BAD_TOKEN' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    if (body.length > MAX_BODY) return res.status(413).json({ error: 'TOO_LARGE' });
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'BAD_JSON' }); }
  }
  if (!body || typeof body.prompt !== 'string' || !body.prompt.trim()) {
    return res.status(400).json({ error: 'NO_PROMPT' });
  }
  if (body.prompt.length > MAX_BODY) return res.status(413).json({ error: 'TOO_LARGE' });

  try {
    const upstream = await fetch(API, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: body.model || 'claude-sonnet-5-5',
        max_tokens: Math.min(body.max_tokens || 1400, 4000),
        system: body.system || undefined,
        messages: [{ role: 'user', content: body.prompt }]
      })
    });

    const data = await upstream.json();
    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: 'UPSTREAM',
        detail: (data && data.error && data.error.message) || String(upstream.status)
      });
    }
    const text = (data.content || [])
      .filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim();
    return res.status(200).json({ text, model: data.model, usage: data.usage });
  } catch (err) {
    return res.status(502).json({ error: 'FETCH_FAILED', detail: String(err && err.message) });
  }
};
