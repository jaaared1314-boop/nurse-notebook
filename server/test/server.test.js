'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DATA_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cnc-test-')), 'store.json');
const { createServer, tick } = require('../index');

const TOKEN = 'device-token-for-tests-0001';
const OTHER = 'device-token-for-tests-0002';
const sub = { endpoint: 'https://push.example/abc', keys: { p256dh: 'x', auth: 'y' } };
const DUE = Date.parse('2026-10-15T21:00:00Z');
const MIN = 60 * 1000;

let server;
let base;

before(async () => {
  server = createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((r) => server.close(r)));

async function call(method, route, token, body) {
  const res = await fetch(base + route, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Device-Token': token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: res.status === 204 ? null : await res.json().catch(() => null) };
}

const schedule = (items) => call('POST', '/api/schedule', TOKEN, { items });
const item = (id, dueAt, room) => ({ id, dueAt: new Date(dueAt).toISOString(), room, label: 'Chem stick' });

function recorder() {
  const sent = [];
  const sender = async (s, payload) => { sent.push({ s, payload: JSON.parse(payload) }); };
  return { sent, sender };
}

test('requests without a device token are refused', async () => {
  const r = await call('POST', '/api/schedule', null, { items: [] });
  assert.equal(r.status, 401);
});

test('a phone must subscribe before it can send a schedule', async () => {
  const r = await call('POST', '/api/schedule', OTHER, { items: [] });
  assert.equal(r.status, 404);
});

test('subscribe, then schedule tonight\'s checks', async () => {
  assert.equal((await call('POST', '/api/subscribe', TOKEN, { subscription: sub })).status, 200);
  const r = await schedule([item('ccu17-a', DUE, 'CCU 17')]);
  assert.equal(r.status, 200);
  assert.equal(r.body.count, 1);
});

test('malformed schedules are rejected', async () => {
  assert.equal((await schedule([{ id: 'x', dueAt: 'not a date' }])).status, 400);
  assert.equal((await schedule('nope')).status, 400);
});

test('a pre-alert goes out 15 minutes before, once, and the due alert at the time', async () => {
  const { sent, sender } = recorder();
  await schedule([item('ccu17-a', DUE, 'CCU 17')]);

  await tick(DUE - 20 * MIN, sender);
  assert.equal(sent.length, 0, 'nothing before the 15-minute window');

  await tick(DUE - 10 * MIN, sender);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].payload.title, 'Chem stick due in 15 min');
  assert.equal(sent[0].payload.body, 'CCU 17');

  await tick(DUE - 5 * MIN, sender);
  assert.equal(sent.length, 1, 'pre-alert is not repeated');

  await tick(DUE + 2 * MIN, sender);
  assert.equal(sent.length, 2);
  assert.equal(sent[1].payload.title, 'Chem stick due now');

  await tick(DUE + 4 * MIN, sender);
  assert.equal(sent.length, 2, 'due alert is not repeated');
});

test('re-syncing the same schedule does not repeat alerts that already went out', async () => {
  const { sent, sender } = recorder();
  const T = DUE + 60 * MIN;
  await schedule([item('ccu18-a', T, 'CCU 18')]);
  await tick(T - 10 * MIN, sender);
  assert.equal(sent.length, 1);
  await schedule([item('ccu18-a', T, 'CCU 18')]);
  await tick(T - 9 * MIN, sender);
  assert.equal(sent.length, 1);
});

test('a check moved to a new time is alerted again', async () => {
  const { sent, sender } = recorder();
  const T = DUE + 120 * MIN;
  await schedule([item('ccu19-a', T, 'CCU 19')]);
  await tick(T - 10 * MIN, sender);
  assert.equal(sent.length, 1);
  await schedule([item('ccu19-a', T + 30 * MIN, 'CCU 19')]);
  await tick(T + 20 * MIN, sender);
  assert.equal(sent.length, 2);
});

test('a check is forgotten a couple of hours after it is due', async () => {
  const { sent, sender } = recorder();
  const T = DUE + 240 * MIN;
  await schedule([item('ccu20-a', T, 'CCU 20')]);
  await tick(T + 3 * 60 * MIN, sender);
  assert.equal(sent.length, 0);
});

test('a phone that unsubscribed is forgotten and stops getting alerts', async () => {
  await call('POST', '/api/subscribe', OTHER, { subscription: sub });
  await call('POST', '/api/schedule', OTHER, { items: [item('gone-a', DUE, 'CCU 16')] });
  const gone = async () => { const e = new Error('gone'); e.statusCode = 410; throw e; };
  await tick(DUE - 10 * MIN, gone);
  const r = await call('POST', '/api/schedule', OTHER, { items: [] });
  assert.equal(r.status, 404);
});

test('unsubscribing removes the phone', async () => {
  await call('POST', '/api/subscribe', OTHER, { subscription: sub });
  assert.equal((await call('DELETE', '/api/subscribe', OTHER)).status, 200);
  assert.equal((await call('POST', '/api/schedule', OTHER, { items: [] })).status, 404);
});

test('a temporary push failure is retried on the next tick', async () => {
  const { sent, sender } = recorder();
  const T = DUE + 300 * MIN;
  await schedule([item('ccu21-a', T, 'CCU 21')]);
  let failures = 1;
  const flaky = async (...args) => { if (failures-- > 0) throw Object.assign(new Error('timeout'), { statusCode: 503 }); return sender(...args); };
  await tick(T - 10 * MIN, flaky);
  assert.equal(sent.length, 0);
  await tick(T - 9 * MIN, flaky);
  assert.equal(sent.length, 1);
});
