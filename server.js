#!/usr/bin/env node
'use strict';

/*
 * keepawake — 蓋を閉じてもMacを起こしたままにする小さなローカルアプリ
 *
 * 仕組み: macOS標準の `pmset -a disablesleep 1/0` を切り替えるだけ。
 *         Intel / Apple Silicon 両対応。root権限が要るので sudo 経由で叩く。
 *         `sudo -n`（非対話）を使うので、パスワードが要る設定だと即失敗して
 *         UIにエラーが出る（ハングしない）。→ README の sudoers 設定を推奨。
 */

const http = require('http');
const { execFile } = require('child_process');

const PORT = process.env.PORT || 3939;
const HOST = '127.0.0.1'; // ローカルのみ。外からは開けない。

// 最後にブラウザから連絡があった時刻。これを見て「誰も見ていない」を判断する。
let lastSeen = Date.now();

function sh(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 8000 }, (err, stdout, stderr) => {
      if (err) reject(new Error((stderr || err.message).trim()));
      else resolve(stdout);
    });
  });
}

// 現在の状態を pmset から読む
async function isAwake() {
  const out = await sh('pmset', ['-g']);
  const m = out.match(/SleepDisabled\s+(\d)/);
  return m ? m[1] === '1' : false;
}

// disablesleep を 1/0 に。sudo -n で非対話実行。
async function setAwake(on) {
  await sh('sudo', ['-n', 'pmset', '-a', 'disablesleep', on ? '1' : '0']);
}

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  lastSeen = Date.now(); // ブラウザから連絡があった＝まだ使われている
  try {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(PAGE);
    }

    if (req.method === 'GET' && req.url === '/status') {
      const awake = await isAwake();
      return json(res, 200, { awake });
    }

    if (req.method === 'POST' && req.url === '/toggle') {
      const current = await isAwake();
      await setAwake(!current);
      const awake = await isAwake();
      return json(res, 200, { awake });
    }

    // ブラウザからきれいに停止（解除してからサーバー終了）
    if (req.method === 'POST' && req.url === '/quit') {
      json(res, 200, { bye: true });
      setTimeout(cleanup, 150);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('not found');
  } catch (e) {
    // sudoが設定されていない等はここに来る
    json(res, 500, { error: e.message });
  }
});

// 安全網: サーバーを終了したら必ず解除する（"常にON"を残さない）
async function cleanup() {
  try { await setAwake(false); } catch (_) {}
  process.exit(0);
}
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// 自動終了: しばらく誰も見ておらず（ページが閉じられ）、かつ「休止」なら静かに終わる。
// ＝使っていないときはエンジンも消える。覚醒中やページを開いている間は生き続ける。
setInterval(async () => {
  if (Date.now() - lastSeen < 20000) return;      // まだ最近アクセスあり
  let awake = false;
  try { awake = await isAwake(); } catch (_) { return; }
  if (!awake) process.exit(0);                     // 休止＆無人 → 終了（解除は不要、既にoff）
}, 5000).unref();

server.on('error', (err) => {
  // 既に起動済み（.appを二重に開いた等）なら黙って終了。ブラウザ側はランチャーが開く。
  if (err.code === 'EADDRINUSE') { console.log('already running'); process.exit(0); }
  else { console.error(err.message); process.exit(1); }
});

server.listen(PORT, HOST, () => {
  console.log(`\n  keepawake → http://${HOST}:${PORT}\n  停止は Ctrl+C（終了時に自動で解除します）\n`);
});

/* ------------------------------------------------------------------ */
/*  UI: 陰翳のなかで静かに灯る一つのオーブ。ON=温かい残り火 / OFF=沈黙  */
/* ------------------------------------------------------------------ */
const PAGE = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>keepawake</title>
<style>
  :root{
    --ink:#14110E;          /* 温かい墨黒（陰翳） */
    --ink-lift:#1C1814;
    --paper:#E8E2D6;        /* 生成りの白 */
    --muted:#6B6459;
    --ember:#C99A5B;        /* 残り火のアンバー */
    --ember-soft:#8f6f3f;
    --line:rgba(232,226,214,.10);
  }
  *{box-sizing:border-box}
  html,body{height:100%}
  body{
    margin:0; background:var(--ink); color:var(--paper);
    font-family:"Hiragino Sans","Helvetica Neue",-apple-system,system-ui,sans-serif;
    -webkit-font-smoothing:antialiased;
    display:flex; align-items:center; justify-content:center;
    min-height:100dvh; padding:6vh 24px; overflow:hidden;
  }
  .stage{ width:100%; max-width:360px; text-align:center; }

  /* 見出し: 主張しない小さな一行 */
  .eyebrow{
    font-size:11px; letter-spacing:.42em; text-transform:uppercase;
    color:var(--muted); margin:0 0 40px; padding-left:.42em;
  }

  /* 中央のオーブ = 唯一の操作対象 */
  .orb{
    appearance:none; border:none; cursor:pointer; background:transparent;
    width:190px; height:190px; margin:0 auto; padding:0;
    display:grid; place-items:center; position:relative;
    border-radius:50%;
  }
  .disc{
    width:150px; height:150px; border-radius:50%;
    background:radial-gradient(circle at 50% 42%, var(--ink-lift), #0d0b09 78%);
    border:1px solid var(--line);
    transition:box-shadow .9s ease, border-color .9s ease, background .9s ease;
    display:grid; place-items:center;
    position:relative; z-index:2;
  }
  .core{
    width:12px; height:12px; border-radius:50%;
    background:var(--muted);
    transition:background .9s ease, box-shadow .9s ease, transform .9s ease;
  }
  /* 覚醒時: 温かく灯る */
  body.awake .disc{
    border-color:rgba(201,154,91,.35);
    background:radial-gradient(circle at 50% 40%, #2a2016, #100c08 80%);
    box-shadow:0 0 60px -6px rgba(201,154,91,.28), inset 0 0 40px -10px rgba(201,154,91,.22);
  }
  body.awake .core{
    background:var(--ember);
    transform:scale(1.25);
    box-shadow:0 0 22px 3px rgba(201,154,91,.65);
  }
  .orb:focus-visible{ outline:2px solid var(--ember-soft); outline-offset:8px; }

  /* 地平線の光: 中心から左右へ伸びる。覚醒時のみ。休止では出さない。 */
  .horizon{
    position:absolute; left:50%; top:50%; z-index:1;
    width:1400px; height:64px; pointer-events:none;
    transform:translate(-50%,-50%) scaleX(0);
    transform-origin:center center;
    opacity:0;
    transition:transform 3.4s cubic-bezier(.16,.8,.28,1), opacity 2.2s ease;
  }
  .hz-glow, .hz-beam{
    position:absolute; left:0; top:50%; width:100%;
    transform:translateY(-50%);
  }
  .hz-glow{                        /* 太くぼやけた光のにじみ */
    height:64px;
    background:linear-gradient(to right,
      transparent 0%, rgba(201,154,91,.22) 50%, transparent 100%);
    filter:blur(16px);
  }
  .hz-beam{                        /* 中心を通る細い光の線 */
    height:2px;
    background:linear-gradient(to right,
      transparent 8%, rgba(201,154,91,.6) 50%, transparent 92%);
    filter:blur(1.4px);
  }
  body.awake .horizon{
    transform:translate(-50%,-50%) scaleX(1);
    opacity:1;
  }

  /* 状態テキスト */
  .state{ margin:34px 0 4px; height:1.4em; }
  .state b{ font-weight:600; font-size:17px; letter-spacing:.16em; }
  .sub{ font-size:12px; color:var(--muted); letter-spacing:.08em; min-height:1.2em; margin-top:22px; }

  .err{ margin-top:22px; font-size:12px; line-height:1.7; color:#c98b6b;
        opacity:0; transition:opacity .4s; max-width:300px; margin-left:auto; margin-right:auto; }
  .err.show{ opacity:1; }
  .err code{ color:var(--paper); background:rgba(232,226,214,.08); padding:1px 5px; border-radius:3px; }

  @media (prefers-reduced-motion: reduce){
    .disc,.core,.horizon{ transition:none }
  }
</style>
</head>
<body>
  <main class="stage">
    <p class="eyebrow">keep awake</p>

    <button class="orb" id="orb" aria-pressed="false" aria-label="覚醒を切り替え">
      <span class="horizon"><span class="hz-glow"></span><span class="hz-beam"></span></span>
      <span class="disc"><span class="core"></span></span>
    </button>

    <div class="state"><b id="label">— — —</b></div>
    <div class="sub" id="sub">状態を確認中</div>

    <p class="err" id="err"></p>
  </main>

<script>
  const body  = document.body;
  const orb   = document.getElementById('orb');
  const label = document.getElementById('label');
  const sub   = document.getElementById('sub');
  const errEl = document.getElementById('err');
  let busy = false;

  function paint(awake){
    body.classList.toggle('awake', awake);
    orb.setAttribute('aria-pressed', String(awake));
    label.textContent = awake ? '覚醒' : '休止';
    sub.textContent   = awake ? '蓋を閉じても動き続けます' : '通常どおりスリープします';
  }

  function showErr(msg){
    errEl.innerHTML = msg;
    errEl.classList.add('show');
  }
  function clearErr(){ errEl.classList.remove('show'); }

  async function refresh(){
    try{
      const r = await fetch('/status');
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      if (!busy) paint(d.awake);
      clearErr();
    }catch(e){ /* 起動直後などは黙って再試行 */ }
  }

  orb.addEventListener('click', async () => {
    if (busy) return;
    busy = true; sub.textContent = '切り替え中…';
    try{
      const r = await fetch('/toggle', { method:'POST' });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      paint(d.awake);
      clearErr();
    }catch(e){
      const m = String(e.message||e);
      if (/sudo|password|a terminal/i.test(m)){
        showErr('sudoの権限設定が未完了です。READMEの<code>sudoers</code>設定を一度だけ実行してください。');
      }else{
        showErr('切り替えに失敗しました: <code>'+m.replace(/[<>&]/g,'')+'</code>');
      }
    }finally{ busy = false; }
  });

  refresh();
  setInterval(refresh, 4000);
</script>
</body>
</html>`;
