/* Charge Nurse Checklist — all app logic.
 *
 * Everything lives in this device's localStorage. No network calls, no
 * accounts, no analytics. Nothing typed into this app leaves the phone. */

'use strict';

const STORE = 'cnc.v2';
const SHIFT_TYPE = 'night';           // 19:00–07:00
const Q2_MINUTES = 120;

/* ───────────────────────── icons (stroked, SF-ish) ───────────────────────── */

const I = {
  check: '<path d="M4 12.5l5 5L20 6.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
  plus: '<path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
  x: '<path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  chev: '<path d="M8 4l8 8-8 8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
  info: '<circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 10.6v6.2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><circle cx="12" cy="7.4" r="1.15" fill="currentColor"/>',
  gear: '<path d="M12 15.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M19.4 14.6a7.9 7.9 0 000-5.2l1.7-1.3-1.9-3.3-2 .8a7.9 7.9 0 00-4.5-2.6L12.4 1h-3.8l-.3 2a7.9 7.9 0 00-4.5 2.6l-2-.8L-.1 8.1l1.7 1.3a7.9 7.9 0 000 5.2L-.1 15.9l1.9 3.3 2-.8a7.9 7.9 0 004.5 2.6l.3 2h3.8l.3-2a7.9 7.9 0 004.5-2.6l2 .8 1.9-3.3z" fill="none" stroke="currentColor" stroke-width="1.6" transform="translate(1.5 1.2) scale(.9)"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="4" cy="6" r="1.5" fill="currentColor"/><circle cx="4" cy="12" r="1.5" fill="currentColor"/><circle cx="4" cy="18" r="1.5" fill="currentColor"/>',
  clock: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M12 7.2V12l3.4 2.2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
  print: '<path d="M7 9V3.8h10V9" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><rect x="3.2" y="9" width="17.6" height="7.6" rx="2" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M7 14h10v6.2H7z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/>',
  copy: '<rect x="8.6" y="8.6" width="11.4" height="11.4" rx="2.6" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M15.4 5.6a2.6 2.6 0 00-2.6-2.6H6.6A2.6 2.6 0 004 5.6v6.2a2.6 2.6 0 002.6 2.6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
  trash: '<path d="M4.6 7h14.8M9.4 7V4.6h5.2V7M6.6 7l.9 12.2a1.8 1.8 0 001.8 1.6h5.4a1.8 1.8 0 001.8-1.6L17.4 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  minus: '<path d="M5 12h14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
  flag: '<path d="M5.5 21V3.6h0c3.3 2 6.6-2 9.9 0s6.6-2 6.6-2v9.4s-3.3 2-6.6 0-6.6 2-9.9 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  play: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M10 8.4l6 3.6-6 3.6z" fill="currentColor"/>',
  stop: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.9"/><rect x="9" y="9" width="6" height="6" rx="1.2" fill="currentColor"/>',
};
const svg = (n, cls) => `<svg class="${cls || ''}" viewBox="0 0 24 24" aria-hidden="true">${I[n]}</svg>`;

/* ───────────────────────────── state ───────────────────────────── */

const blankShift = () => ({
  id: 'sh_' + Date.now().toString(36),
  type: SHIFT_TYPE,
  start: new Date().toISOString(),
  end: null,
  checks: {},   // path -> ISO timestamp
  values: {},   // path -> string | string[]
  entries: {},  // item path -> [{uid, name}]
  todos: [],    // {uid, text, room, done, at}
  open: {},     // section id -> bool
});

const defaults = () => ({
  v: 2,
  settings: { rooms: [], unit: '', flags: { noSecretary: false, noAide: false }, theme: 'auto' },
  shift: null,
  history: [],
});

let S = defaults();

function load() {
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) S = Object.assign(defaults(), JSON.parse(raw));
    if (!S.settings.flags) S.settings.flags = { noSecretary: false, noAide: false };
  } catch (e) {
    console.warn('could not read saved data', e);
  }
}

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(S));
    } catch (e) {
      toast('Storage full — export and clear old shifts');
    }
  }, 120);
}

/* ───────────────────────────── helpers ───────────────────────────── */

const $ = (s, r) => (r || document).querySelector(s);
const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9);
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const hhmm = (d) =>
  new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
const dayStamp = (d) =>
  new Date(d).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 1900);
}

function haptic() {
  if (navigator.vibrate) navigator.vibrate(8);
}

/* Which calendar days does this shift touch? A night shift spans two, so a
 * "Tuesday" task counts if either end of the shift lands on Tuesday. */
function shiftDays(sh) {
  const out = [];
  if (!sh) return [new Date()];
  out.push(new Date(sh.start));
  const end = sh.end ? new Date(sh.end) : new Date();
  if (end.toDateString() !== out[0].toDateString()) out.push(end);
  return out;
}

function appliesToday(node, sh) {
  if (!node.when) return true;
  return shiftDays(sh).some((d) => {
    if (d.getDay() !== node.when.dow) return false;
    if (node.when.firstOfMonth && d.getDate() > 7) return false;
    return true;
  });
}

function sectionVisible(sec) {
  if (!sec.flag) return true;
  return !!S.settings.flags[sec.flag];
}
function nodeVisible(node, sh) {
  if (node.flag && !S.settings.flags[node.flag]) return false;
  return true;
}

/* ───────────────────────── progress counting ───────────────────────── */

/* Counts every checkbox the user can actually see, so the ring never promises
 * progress on tasks that are hidden or not due tonight. */
function countNode(node, path, sh, acc) {
  if (!nodeVisible(node, sh)) return;
  const due = appliesToday(node, sh);
  if (node.repeat) {
    const list = sh.entries[path] || [];
    if (!node.bare) {
      acc.total++;
      if (sh.checks[path]) acc.done++;
    }
    list.forEach((e) => {
      acc.total++;
      if (sh.checks[path + '#' + e.uid]) acc.done++;
      (node.repeat.children || []).forEach((c) =>
        countNode(c, path + '#' + e.uid + '.' + c.id, sh, acc));
    });
    return;
  }
  if (due) {
    acc.total++;
    if (sh.checks[path]) acc.done++;
  }
  (node.children || []).forEach((c) => countNode(c, path + '.' + c.id, sh, acc));
}

function sectionProgress(sec, sh) {
  const acc = { done: 0, total: 0 };
  if (sec.kind === 'todo') {
    sh.todos.forEach((t) => {
      acc.total++;
      if (t.done) acc.done++;
    });
    return acc;
  }
  (sec.items || []).forEach((it) => countNode(it, sec.id + '.' + it.id, sh, acc));
  return acc;
}

function overallProgress(sh) {
  const acc = { done: 0, total: 0 };
  TEMPLATE.filter(sectionVisible).forEach((sec) => {
    const p = sectionProgress(sec, sh);
    acc.done += p.done;
    acc.total += p.total;
  });
  return acc;
}

/* ───────────────────────────── rendering ───────────────────────────── */

function render() {
  const root = $('#app');
  if (!S.shift) {
    renderStart(root);
    return;
  }
  const sh = S.shift;
  const prog = overallProgress(sh);

  $('#hdr').innerHTML = `
    <div class="navbar">
      <span class="icon-btn"></span>
      <div class="nav-title">${esc(S.settings.unit || 'Charge Nurse')}
        <small>${dayStamp(sh.start)} · on since ${hhmm(sh.start)} · ${elapsed(sh.start)}</small>
      </div>
      <button class="icon-btn" data-act="collapse-all" aria-label="Collapse or expand all sections">
        ${svg('list')}</button>
    </div>
    <div class="large-title">Tonight
      <small>${prog.done} of ${prog.total} done${prog.total && prog.done === prog.total ? ' · all clear' : ''}</small>
    </div>
    <div class="track"><div class="fill" style="width:${prog.total ? (prog.done / prog.total) * 100 : 0}%"></div></div>`;

  root.innerHTML = TEMPLATE.filter(sectionVisible).map((sec) => groupHTML(sec, sh)).join('');
  renderTabs();
}

function renderTabs() {
  $('#tabs').innerHTML = [
    ['top', 'list', 'Checklist'],
    ['report', 'print', 'Report'],
    ['history', 'clock', 'History'],
    ['settings', 'gear', 'Settings'],
  ].map(([act, ic, label]) =>
    `<button data-act="${act}" aria-current="${act === 'top' && $('#scrim').hidden}">
       ${svg(ic)}<span>${label}</span></button>`).join('');
}

function elapsed(start) {
  const m = Math.max(0, Math.round((Date.now() - new Date(start)) / 60000));
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

function groupHTML(sec, sh) {
  const open = sh.open[sec.id] !== false;
  const p = sectionProgress(sec, sh);
  const complete = p.total > 0 && p.done === p.total;
  const body = sec.kind === 'todo'
    ? todoHTML(sh)
    : (sec.items || [])
        .filter((it) => nodeVisible(it, sh))
        .map((it) => nodeHTML(it, sec.id + '.' + it.id, sh, 0))
        .join('');

  return `<section class="group" data-open="${open}" data-sec="${sec.id}">
    <div class="card">
      <button class="section-head" data-act="toggle-sec" data-sec="${sec.id}">
        <h2>${esc(sec.title)}</h2>
        <span class="pill ${complete ? 'complete' : ''}">${
          p.total === 0 ? '' : complete ? 'Done' : p.done + '/' + p.total}</span>
        ${svg('chev', 'chev')}
      </button>
      <div class="section-body">${body}</div>
    </div>
    ${sec.blurb ? `<div class="group-footer">${esc(sec.blurb)}</div>` : ''}
  </section>`;
}

function badgeFor(node, path, sh) {
  const bits = [];
  if (node.when) {
    const name = DAYS[node.when.dow];
    const label = node.when.firstOfMonth ? '1st ' + name : name;
    bits.push(appliesToday(node, sh)
      ? `<span class="badge today">Due today</span>`
      : `<span class="badge">${esc(label)} only</span>`);
  }
  if (node.at && !sh.checks[path]) {
    const [h, m] = node.at.split(':').map(Number);
    const now = new Date();
    const target = new Date(now);
    target.setHours(h, m, 0, 0);
    const mins = (target - now) / 60000;
    if (mins <= 0) bits.push(`<span class="badge over">${esc(node.at.replace(':', ''))} passed</span>`);
    else if (mins <= 90) bits.push(`<span class="badge due">in ${Math.round(mins)}m</span>`);
  }
  return bits.join('');
}

function nodeHTML(node, path, sh, depth) {
  if (!nodeVisible(node, sh)) return '';

  // A "bare" node is only a container for its repeat list — drawing a checkbox
  // for it would just be a box you can never meaningfully tick.
  if (node.bare && node.repeat) return repeatHTML(node, path, sh);

  const checked = !!sh.checks[path];
  const due = appliesToday(node, sh);

  let html = `<div class="row ${checked ? 'done' : ''}" data-path="${esc(path)}">
    <div class="row-inner">
      <button class="check" role="checkbox" aria-checked="${checked}" data-act="check" data-path="${esc(path)}"
              aria-label="${esc(node.label)}">${svg('check')}</button>
      <div class="row-main">
        <div class="row-title">
          <span class="lbl" style="${due ? '' : 'opacity:.5'}">${esc(node.label)}</span>
          ${badgeFor(node, path, sh)}
          ${checked ? `<span class="stamp">${hhmm(sh.checks[path])}</span>` : ''}
        </div>
        ${node.note ? `<div class="row-note">${esc(node.note)}</div>` : ''}
      </div>
      ${node.help ? `<button class="info-btn" data-act="help" data-path="${esc(path)}"
                     aria-expanded="false" aria-label="More about this">${svg('info')}</button>` : ''}
    </div>
    ${node.help ? `<div class="help" data-help="${esc(path)}" hidden>${esc(node.help)}</div>` : ''}`;

  if (node.field) html += fieldHTML(node, path, sh);

  if (node.repeat) html += repeatHTML(node, path, sh);
  else if (node.children && node.children.length) {
    html += `<div class="children">${node.children
      .filter((c) => nodeVisible(c, sh))
      .map((c) => nodeHTML(c, path + '.' + c.id, sh, depth + 1))
      .join('')}</div>`;
  }

  return html + `</div>`;
}

function fieldHTML(node, path, sh) {
  const f = node.field;
  const v = sh.values[path];

  if (f.type === 'times') {
    const times = Array.isArray(v) ? v : [];
    return `<div class="chips">
      ${times.map((t, i) => `<span class="chip">${hhmm(t)}
        <button data-act="time-del" data-path="${esc(path)}" data-i="${i}" aria-label="Remove ${hhmm(t)}">${svg('x')}</button>
      </span>`).join('')}
      <button class="chip-add" data-act="time-add" data-path="${esc(path)}">${svg('plus')} Log time</button>
    </div>`;
  }

  if (f.type === 'textlist') {
    const items = Array.isArray(v) ? v : [];
    return `<div class="field">
      ${items.map((txt, i) => `<div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:6px">
          <textarea rows="2" data-act="tl-edit" data-path="${esc(path)}" data-i="${i}"
            placeholder="${esc(f.placeholder || '')}" style="min-height:52px">${esc(txt)}</textarea>
          <button class="entry-del" data-act="tl-del" data-path="${esc(path)}" data-i="${i}"
            aria-label="Delete">${svg('minus')}</button>
        </div>`).join('')}
      <button class="chip-add" data-act="tl-add" data-path="${esc(path)}">${svg('plus')} ${esc(f.addLabel || 'Add')}</button>
    </div>`;
  }

  if (f.type === 'longtext') {
    return `<div class="field"><textarea data-act="val" data-path="${esc(path)}"
      placeholder="${esc(f.placeholder || 'Type here…')}">${esc(v || '')}</textarea></div>`;
  }

  if (f.type === 'room') {
    return `<div class="field">${roomSelectHTML(path, v)}</div>`;
  }

  return `<div class="field"><input type="text" data-act="val" data-path="${esc(path)}"
    value="${esc(v || '')}" placeholder="${esc(f.placeholder || '')}"></div>`;
}

function roomSelectHTML(path, value) {
  const opts = ['<option value="">Room…</option>']
    .concat(S.settings.rooms.map((r) =>
      `<option value="${esc(r)}" ${r === value ? 'selected' : ''}>${esc(r)}</option>`));
  return `<select data-act="val" data-path="${esc(path)}">${opts.join('')}</select>`;
}

function repeatHTML(node, path, sh) {
  const list = sh.entries[path] || [];
  const isRoom = node.repeat.field && node.repeat.field.type === 'room';

  const entries = list.map((e) => {
    const epath = path + '#' + e.uid;
    const checked = !!sh.checks[epath];
    const name = isRoom
      ? `<span class="entry-name">${esc(e.name || 'Room —')}</span>`
      : `<input type="text" data-act="entry-name" data-path="${esc(epath)}" value="${esc(e.name || '')}"
           placeholder="${esc(node.repeat.field.placeholder || '')}">`;

    const kids = (node.repeat.children || [])
      .filter((c) => nodeVisible(c, sh))
      .map((c) => nodeHTML(c, epath + '.' + c.id, sh, 1))
      .join('');

    return `<div class="entry ${checked ? 'done' : ''}">
      <div class="entry-head">
        <button class="check" role="checkbox" aria-checked="${checked}" data-act="check" data-path="${esc(epath)}"
          aria-label="${esc(e.name || 'entry')} complete">${svg('check')}</button>
        ${name}
        ${checked ? `<span class="stamp">${hhmm(sh.checks[epath])}</span>` : ''}
        <button class="entry-del" data-act="entry-del" data-path="${esc(epath)}"
          aria-label="Remove ${esc(e.name || 'entry')}">${svg('trash')}</button>
      </div>
      ${node.repeat.q2 ? q2HTML(epath, sh) : ''}
      ${kids ? `<div class="children">${kids}</div>` : ''}
    </div>`;
  }).join('');

  const act = isRoom ? 'rooms-open' : 'entry-add';
  return `${entries}<div class="add-row">
    <button class="add-btn" data-act="${act}" data-path="${esc(path)}">
      <span class="plus">${svg('plus')}</span>${esc(node.repeat.addLabel || 'Add')}
    </button>
  </div>`;
}

/* Restraint Q2: next-due read off the last logged charting time. */
function q2HTML(epath, sh) {
  const times = sh.values[epath + '.q2'];
  if (!Array.isArray(times) || !times.length) {
    return `<div class="q2">${svg('clock', 'chev')} No Q2 charting logged yet</div>`;
  }
  const last = new Date(times[times.length - 1]);
  const due = new Date(last.getTime() + Q2_MINUTES * 60000);
  const mins = Math.round((due - Date.now()) / 60000);
  const cls = mins < 0 ? 'over' : mins <= 20 ? 'due' : '';
  const txt = mins < 0 ? `Q2 overdue by ${-mins}m` : `Q2 due ${hhmm(due)} · in ${mins}m`;
  return `<div class="q2">Last charted ${hhmm(last)}
    <span class="badge plain ${cls}">${esc(txt)}</span></div>`;
}

function todoHTML(sh) {
  const rows = sh.todos.map((t) => `<div class="row ${t.done ? 'done' : ''}">
    <div class="row-inner">
      <button class="check" role="checkbox" aria-checked="${t.done}" data-act="todo-check" data-uid="${t.uid}"
        aria-label="${esc(t.text)}">${svg('check')}</button>
      <div class="row-main"><div class="row-title">
        <span class="lbl">${esc(t.text)}</span>
        ${t.room ? `<span class="badge today">${esc(t.room)}</span>` : ''}
        ${t.done && t.at ? `<span class="stamp">${hhmm(t.at)}</span>` : ''}
      </div></div>
      <button class="entry-del" data-act="todo-del" data-uid="${t.uid}" aria-label="Delete">${svg('trash')}</button>
    </div>
  </div>`).join('');

  return `<div class="row"><div class="todo-add">
      <button class="plus" data-act="todo-add" aria-label="Add to-do">${svg('plus')}</button>
      <input type="text" id="todo-input" placeholder="Add a task…" enterkeyhint="done">
    </div></div>
    ${rows || '<div class="empty">Nothing outstanding.</div>'}`;
}

function renderStart(root) {
  $('#hdr').innerHTML = `
    <div class="navbar"><div class="nav-title">${esc(S.settings.unit || 'Charge Nurse')}</div></div>
    <div class="large-title">Charge Nurse<small>${dayStamp(new Date())} · nights</small></div>`;
  renderTabs();

  const needRooms = !S.settings.rooms.length;
  root.innerHTML = `<section class="group">
      <div class="card" style="padding:20px 16px">
        <p style="margin:0 0 18px;font-size:15px;letter-spacing:-.24px;color:var(--label-2);line-height:1.45">
          Start a shift and the checklist resets with a clean slate. Every box you tick is
          timestamped, and the whole thing is saved to this phone as you go — you can close
          the app mid-shift and pick up exactly where you left off.
        </p>
        <button class="btn primary" data-act="shift-start" style="width:100%;margin:0">
          ${svg('play')} Start tonight's shift
        </button>
      </div>
    </section>
    ${needRooms ? `<section class="group">
      <div class="group-header"><span class="gh-title">First time</span></div>
      <div class="card">
        <button class="section-head" data-act="settings">
          <h2 style="font-weight:400;color:var(--blue)">Add your unit's room numbers</h2>
          ${svg('chev', 'chev')}
        </button>
      </div>
      <div class="group-footer">Room dropdowns stay empty until you do. You can paste a range
        like 3401-3420 and the app will expand it.</div>
    </section>` : ''}
    ${S.history.length ? `<section class="group">
      <div class="group-header"><span class="gh-title">Recent</span></div>
      <div class="card">${S.history.slice(0, 3).map(histRowHTML).join('')}</div>
    </section>` : ''}`;
}

/* ───────────────────────────── actions ───────────────────────────── */

function toggleCheck(path) {
  const sh = S.shift;
  if (sh.checks[path]) delete sh.checks[path];
  else sh.checks[path] = new Date().toISOString();
  haptic();
  save();
  render();
}

function setValue(path, v) {
  if (v === '' || v == null) delete S.shift.values[path];
  else S.shift.values[path] = v;
  save();
}

function addEntries(path, names) {
  const sh = S.shift;
  if (!sh.entries[path]) sh.entries[path] = [];
  names.forEach((n) => sh.entries[path].push({ uid: uid(), name: n }));
  save();
  render();
}

function delEntry(epath) {
  const i = epath.lastIndexOf('#');
  const path = epath.slice(0, i);
  const u = epath.slice(i + 1);
  const sh = S.shift;
  sh.entries[path] = (sh.entries[path] || []).filter((e) => e.uid !== u);
  // drop every check and value that belonged to that entry
  Object.keys(sh.checks).forEach((k) => { if (k.startsWith(epath)) delete sh.checks[k]; });
  Object.keys(sh.values).forEach((k) => { if (k.startsWith(epath)) delete sh.values[k]; });
  save();
  render();
}

function listPush(path, val) {
  const cur = Array.isArray(S.shift.values[path]) ? S.shift.values[path] : [];
  cur.push(val);
  S.shift.values[path] = cur;
  save();
  render();
}

function listRemove(path, i) {
  const cur = Array.isArray(S.shift.values[path]) ? S.shift.values[path] : [];
  cur.splice(i, 1);
  if (cur.length) S.shift.values[path] = cur;
  else delete S.shift.values[path];
  save();
  render();
}

function addTodo() {
  const el = $('#todo-input');
  const text = el.value.trim();
  if (!text) return;
  S.shift.todos.push({ uid: uid(), text, room: '', done: false, at: null });
  el.value = '';
  save();
  render();
  setTimeout(() => { const i = $('#todo-input'); if (i) i.focus(); }, 0);
}

function startShift() {
  S.shift = blankShift();
  save();
  render();
  toast('Shift started');
}

function endShift() {
  const sh = S.shift;
  sh.end = new Date().toISOString();
  const p = overallProgress(sh);
  sh.summary = { done: p.done, total: p.total };
  S.history.unshift(sh);
  S.shift = null;
  save();
  closeSheet();
  render();
  toast('Shift saved to history');
}

/* ───────────────────────── sheets: rooms picker ───────────────────────── */

let pickerPath = null;
let picked = [];

function openRoomPicker(path) {
  if (!S.settings.rooms.length) {
    toast('Add room numbers in Settings first');
    openSettings();
    return;
  }
  pickerPath = path;
  picked = [];
  const used = new Set((S.shift.entries[path] || []).map((e) => e.name));
  sheet(`
    <div class="sheet-nav">
      <button class="txt-btn" data-act="sheet-close">Cancel</button>
      <h2>Select rooms</h2>
      <button class="txt-btn strong" data-act="rooms-confirm">Add</button>
    </div>
    <div class="sheet-body">
      <p>Tap as many as you need — they all get added at once. Rooms already on this list are dimmed.</p>
      <div class="room-grid">
        ${S.settings.rooms.map((r) => `<button class="room-opt" data-act="room-pick" data-room="${esc(r)}"
          aria-pressed="false" data-used="${used.has(r)}">${esc(r)}</button>`).join('')}
      </div>
    </div>`);
}

function confirmRooms() {
  if (!picked.length) { closeSheet(); return; }
  addEntries(pickerPath, picked.slice());
  const n = picked.length;
  closeSheet();
  toast(n === 1 ? `${picked[0]} added` : `${n} rooms added`);
}

/* ───────────────────────── sheets: settings ───────────────────────── */

function openSettings() {
  const f = S.settings.flags;
  sheet(`
    <div class="sheet-nav">
      <button class="txt-btn" data-act="sheet-close">Done</button>
      <h2>Settings</h2>
      <span class="txt-btn"></span>
    </div>
    <div class="sheet-body">
      <div class="group-header" style="padding-top:8px"><span class="gh-title">Unit</span></div>
      <div class="card" style="padding:10px 16px">
        <input type="text" id="unit-name" placeholder="Unit name (optional)" value="${esc(S.settings.unit)}">
      </div>

      <div class="group-header" style="padding-top:22px"><span class="gh-title">Rooms</span></div>
      <div class="card" style="padding:12px 16px 4px">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">
          <input type="text" id="room-input" placeholder="3401-3420, 3422, 3424" enterkeyhint="done">
          <button class="chip-add" data-act="rooms-add" style="flex:none">${svg('plus')} Add</button>
        </div>
      </div>
      ${S.settings.rooms.length
        ? `<div class="room-chips" style="padding-top:12px">${S.settings.rooms.map((r) =>
            `<span class="room-chip">${esc(r)}<button data-act="room-del" data-room="${esc(r)}"
              aria-label="Remove ${esc(r)}">${svg('x')}</button></span>`).join('')}</div>`
        : `<div class="group-footer">No rooms yet. Type a range like <b>3401-3420</b> or a
             comma-separated list and tap Add.</div>`}

      <div class="group-header" style="padding-top:14px"><span class="gh-title">Tonight's coverage</span></div>
      <div class="card">
        <div class="toggle">
          <div class="toggle-text">No secretary
            <small>Adds the chart, sticker, consult and lab tasks you have to absorb.</small></div>
          <button class="switch" role="switch" aria-checked="${f.noSecretary}" data-act="flag" data-flag="noSecretary"></button>
        </div>
        <div class="toggle">
          <div class="toggle-text">No aide
            <small>Shows the chem stick, bath and restock section.</small></div>
          <button class="switch" role="switch" aria-checked="${f.noAide}" data-act="flag" data-flag="noAide"></button>
        </div>
      </div>

      <div class="group-header" style="padding-top:22px"><span class="gh-title">Appearance</span></div>
      <div class="card">
        <div class="toggle">
          <div class="toggle-text">Always dark
            <small>Off follows your iPhone's own light/dark setting.</small></div>
          <button class="switch" role="switch" aria-checked="${S.settings.theme === 'dark'}"
            data-act="theme"></button>
        </div>
      </div>

      ${S.shift ? `<div class="group-header" style="padding-top:22px"><span class="gh-title">This shift</span></div>
        <button class="btn" data-act="copy-report">${svg('copy')} Copy report as text</button>
        <button class="btn" data-act="print">${svg('print')} Print / Save as PDF</button>
        <button class="btn destructive" data-act="shift-end">${svg('stop')} End shift and save to history</button>` : ''}

      <div class="group-header" style="padding-top:22px"><span class="gh-title">Data</span></div>
      <div class="group-footer" style="padding-bottom:12px">Everything is stored on this iPhone only.
        Nothing is uploaded, and no one else can see it. Deleting Safari's website data for this
        site, or deleting the app from your home screen, erases it permanently.</div>
      <button class="btn destructive" data-act="wipe">${svg('trash')} Erase all shifts and settings</button>
    </div>`);
}

/* "3401-3404, 3410" -> ['3401','3402','3403','3404','3410'] */
function expandRooms(raw) {
  const out = [];
  raw.split(/[,\s]+/).filter(Boolean).forEach((tok) => {
    const m = tok.match(/^(\D*)(\d+)\s*[-–—]\s*(\d+)(\D*)$/);
    if (m) {
      const [, pre, a, b, post] = m;
      let lo = parseInt(a, 10);
      let hi = parseInt(b, 10);
      if (hi < lo) [lo, hi] = [hi, lo];
      if (hi - lo > 200) hi = lo + 200;          // guard against a typo like 1-99999
      const width = a.length;
      for (let n = lo; n <= hi; n++) out.push(pre + String(n).padStart(width, '0') + post);
    } else {
      out.push(tok);
    }
  });
  return out;
}

function addRooms() {
  const el = $('#room-input');
  const added = expandRooms(el.value);
  if (!added.length) return;
  const set = new Set(S.settings.rooms);
  added.forEach((r) => set.add(r));
  S.settings.rooms = [...set].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  save();
  openSettings();
  toast(added.length === 1 ? 'Room added' : `${added.length} rooms added`);
}

/* ───────────────────────── sheets: report ───────────────────────── */

function openReport() {
  const sh = S.shift;
  if (!sh) { openHistory(); return; }
  const p = overallProgress(sh);
  const outstanding = [];
  TEMPLATE.filter(sectionVisible).forEach((sec) => {
    const q = sectionProgress(sec, sh);
    if (q.total - q.done > 0) outstanding.push(`${sec.title} — ${q.total - q.done} left`);
  });

  sheet(`
    <div class="sheet-nav">
      <button class="txt-btn" data-act="sheet-close">Done</button>
      <h2>Shift report</h2>
      <span class="txt-btn"></span>
    </div>
    <div class="sheet-body">
      <p>${hhmm(sh.start)} – now · <b>${p.done} of ${p.total}</b> complete.
        ${outstanding.length ? 'Still open: ' + esc(outstanding.join(' · ')) + '.' : 'Nothing outstanding.'}</p>
      <div class="report">${esc(reportText(sh))}</div>
      <button class="btn" data-act="copy-report">${svg('copy')} Copy as text</button>
      <button class="btn" data-act="print">${svg('print')} Print / Save as PDF</button>
      <button class="btn destructive" data-act="shift-end">${svg('stop')} End shift and save to history</button>
      <div class="group-footer">Ending the shift clears the live checklist and files this report
        under History. Nothing is sent anywhere.</div>
    </div>`);
}

/* ───────────────────────── sheets: history ───────────────────────── */

function histRowHTML(sh) {
  const p = sh.summary || { done: 0, total: 0 };
  return `<button class="hist" data-act="hist-open" data-id="${esc(sh.id)}">
    <div class="meta"><b>${dayStamp(sh.start)}</b>
      <small>${hhmm(sh.start)} – ${sh.end ? hhmm(sh.end) : 'open'}</small></div>
    <span class="pct">${p.total ? Math.round((p.done / p.total) * 100) + '%' : '—'}</span>
    ${svg('chev', 'chev')}
  </button>`;
}

function openHistory() {
  sheet(`
    <div class="sheet-nav">
      <button class="txt-btn" data-act="sheet-close">Done</button>
      <h2>Past shifts</h2>
      <span class="txt-btn"></span>
    </div>
    <div class="sheet-body">
      ${S.history.length
        ? `<div class="card">${S.history.map(histRowHTML).join('')}</div>
           <div class="group-footer" style="padding-bottom:16px">Kept on this phone only.
             Tap a shift to read it, print it, or save it as a PDF.</div>`
        : `<p>No finished shifts yet. End a shift and it lands here.</p>`}
    </div>`);
}

function openHistShift(id) {
  const sh = S.history.find((h) => h.id === id);
  if (!sh) return;
  sheet(`
    <div class="sheet-nav">
      <button class="txt-btn" data-act="history">Back</button>
      <h2>${dayStamp(sh.start)}</h2>
      <span class="txt-btn"></span>
    </div>
    <div class="sheet-body">
      <div class="report">${esc(reportText(sh))}</div>
      <button class="btn" data-act="copy-report" data-id="${esc(sh.id)}">${svg('copy')} Copy as text</button>
      <button class="btn" data-act="print" data-id="${esc(sh.id)}">${svg('print')} Print / Save as PDF</button>
      <button class="btn destructive" data-act="hist-del" data-id="${esc(sh.id)}">${svg('trash')} Delete this shift</button>
    </div>`);
}

/* ───────────────────────── report + print ───────────────────────── */

/* Walks the template against a saved shift and yields a tidy tree.
 * Used for both the plain-text report and the print layout. */
function walk(sh) {
  const out = [];
  TEMPLATE.forEach((sec) => {
    if (sec.flag && !S.settings.flags[sec.flag]) return;
    const lines = [];

    if (sec.kind === 'todo') {
      sh.todos.forEach((t) => lines.push({
        done: t.done, at: t.at, label: t.text, kids: [],
      }));
    } else {
      (sec.items || []).forEach((it) => {
        const n = nodeReport(it, sec.id + '.' + it.id, sh);
        if (!n) return;
        // a bare host contributes its entries directly, not an empty parent line
        if (n.bare) lines.push(...n.kids);
        else lines.push(n);
      });
    }
    if (lines.length) out.push({ title: sec.title, lines });
  });
  return out;
}

function nodeReport(node, path, sh) {
  if (node.flag && !S.settings.flags[node.flag]) return null;
  if (!appliesToday(node, sh)) return null;   // a Tuesday task on a Thursday is noise

  const done = !!sh.checks[path];
  const at = sh.checks[path] || null;
  const kids = [];

  if (node.repeat) {
    (sh.entries[path] || []).forEach((e) => {
      const epath = path + '#' + e.uid;
      const ekids = (node.repeat.children || [])
        .map((c) => nodeReport(c, epath + '.' + c.id, sh))
        .filter(Boolean);
      kids.push({
        done: !!sh.checks[epath], at: sh.checks[epath] || null,
        label: e.name || '(unnamed)', kids: ekids,
      });
    });
    // a repeat with no rooms added has nothing to say
    if (!kids.length) return null;
    if (node.bare) return { bare: true, kids };
  } else {
    (node.children || []).forEach((c) => {
      const n = nodeReport(c, path + '.' + c.id, sh);
      if (n) kids.push(n);
    });
  }

  const v = sh.values[path];
  let value = '';
  if (Array.isArray(v)) {
    value = node.field && node.field.type === 'times'
      ? v.map(hhmm).join(', ')
      : v.filter(Boolean).join(' · ');
  } else if (v) {
    value = String(v);
  }

  // Everything else prints whether or not it was ticked — an unticked box on the
  // handoff sheet is information, not an omission.
  return { done, at, label: node.label, value, kids };
}

function reportText(sh) {
  const L = [];
  const p = sh.summary || overallProgress(sh);
  L.push(`CHARGE NURSE CHECKLIST — ${dayStamp(sh.start)}`);
  if (S.settings.unit) L.push(S.settings.unit);
  L.push(`${hhmm(sh.start)} – ${sh.end ? hhmm(sh.end) : 'in progress'}  ·  ${p.done}/${p.total} complete`);
  L.push('');

  const line = (n, d) => {
    const pad = '  '.repeat(d);
    const box = n.done ? '[x]' : '[ ]';
    const t = n.at ? `  (${hhmm(n.at)})` : '';
    const v = n.value ? `: ${n.value}` : '';
    L.push(`${pad}${box} ${n.label}${v}${t}`);
    n.kids.forEach((k) => line(k, d + 1));
  };

  walk(sh).forEach((sec) => {
    L.push(sec.title.toUpperCase());
    sec.lines.forEach((n) => line(n, 1));
    L.push('');
  });
  return L.join('\n');
}

function printShift(sh) {
  const li = (n) => `<li>
      <span class="${n.done ? 'x' : 'o'}">${n.done ? '☒' : '☐'}</span>
      ${esc(n.label)}${n.value ? ': <b>' + esc(n.value) + '</b>' : ''}
      ${n.at ? `<span class="t"> — ${hhmm(n.at)}</span>` : ''}
      ${n.kids.length ? `<ul>${n.kids.map(li).join('')}</ul>` : ''}
    </li>`;

  const p = sh.summary || overallProgress(sh);
  $('#printout').innerHTML = `
    <h1>Charge Nurse Checklist</h1>
    <div class="sub">${esc(S.settings.unit ? S.settings.unit + ' · ' : '')}${dayStamp(sh.start)} ·
      ${hhmm(sh.start)}–${sh.end ? hhmm(sh.end) : 'in progress'} · ${p.done}/${p.total} complete</div>
    ${walk(sh).map((sec) =>
      `<h2>${esc(sec.title)}</h2><ul>${sec.lines.map(li).join('')}</ul>`).join('')}`;
  setTimeout(() => window.print(), 60);
}

async function copyReport(sh) {
  const txt = reportText(sh);
  try {
    await navigator.clipboard.writeText(txt);
    toast('Report copied');
  } catch (e) {
    // Safari blocks the async clipboard outside a gesture chain; fall back.
    const ta = document.createElement('textarea');
    ta.value = txt;
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    toast('Report copied');
  }
}

/* ───────────────────────────── sheet plumbing ───────────────────────────── */

function sheet(html) {
  const s = $('#scrim');
  $('#sheet').innerHTML = `<div class="grabber"></div>${html}`;
  s.hidden = false;
  $('#sheet').scrollTop = 0;
}
function closeSheet() {
  $('#scrim').hidden = true;
  $('#sheet').innerHTML = '';
  render();
}

function applyTheme() {
  const t = S.settings.theme;
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}

/* ───────────────────────────── event wiring ───────────────────────────── */

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  const path = el.dataset.path;

  switch (act) {
    case 'check': toggleCheck(path); break;

    case 'toggle-sec': {
      const id = el.dataset.sec;
      S.shift.open[id] = S.shift.open[id] === false;
      save();
      render();
      break;
    }

    case 'help': {
      const box = document.querySelector(`[data-help="${CSS.escape(path)}"]`);
      const open = box.hidden;
      box.hidden = !open;
      el.setAttribute('aria-expanded', String(open));
      break;
    }

    case 'rooms-open': openRoomPicker(path); break;
    case 'room-pick': {
      const r = el.dataset.room;
      const on = el.getAttribute('aria-pressed') === 'true';
      el.setAttribute('aria-pressed', String(!on));
      if (on) picked = picked.filter((x) => x !== r);
      else picked.push(r);
      haptic();
      break;
    }
    case 'rooms-confirm': confirmRooms(); break;

    case 'entry-add': addEntries(path, ['']); break;
    case 'entry-del': delEntry(path); break;

    case 'time-add': listPush(path, new Date().toISOString()); haptic(); break;
    case 'time-del': listRemove(path, +el.dataset.i); break;
    case 'tl-add': listPush(path, ''); break;
    case 'tl-del': listRemove(path, +el.dataset.i); break;

    case 'todo-add': addTodo(); break;
    case 'todo-check': {
      const t = S.shift.todos.find((x) => x.uid === el.dataset.uid);
      t.done = !t.done;
      t.at = t.done ? new Date().toISOString() : null;
      haptic();
      save();
      render();
      break;
    }
    case 'todo-del':
      S.shift.todos = S.shift.todos.filter((x) => x.uid !== el.dataset.uid);
      save();
      render();
      break;

    case 'shift-start': startShift(); break;
    case 'shift-end':
      if (confirm('End the shift and move it to history? The live checklist will be cleared.')) endShift();
      break;

    case 'settings': openSettings(); break;
    case 'report': openReport(); break;
    case 'top':
      closeSheet();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      break;
    case 'collapse-all': {
      const ids = TEMPLATE.filter(sectionVisible).map((x) => x.id);
      const anyOpen = ids.some((id) => S.shift.open[id] !== false);
      ids.forEach((id) => { S.shift.open[id] = !anyOpen; });
      save();
      render();
      break;
    }
    case 'history': openHistory(); break;
    case 'hist-open': openHistShift(el.dataset.id); break;
    case 'hist-del':
      if (confirm('Delete this shift permanently?')) {
        S.history = S.history.filter((h) => h.id !== el.dataset.id);
        save();
        openHistory();
      }
      break;

    case 'rooms-add': addRooms(); break;
    case 'room-del':
      S.settings.rooms = S.settings.rooms.filter((r) => r !== el.dataset.room);
      save();
      openSettings();
      break;

    case 'flag': {
      const k = el.dataset.flag;
      S.settings.flags[k] = !S.settings.flags[k];
      el.setAttribute('aria-checked', String(S.settings.flags[k]));
      save();
      break;
    }
    case 'theme': {
      S.settings.theme = S.settings.theme === 'dark' ? 'auto' : 'dark';
      el.setAttribute('aria-checked', String(S.settings.theme === 'dark'));
      applyTheme();
      save();
      break;
    }

    case 'copy-report': {
      const sh = el.dataset.id ? S.history.find((h) => h.id === el.dataset.id) : S.shift;
      if (sh) copyReport(sh);
      break;
    }
    case 'print': {
      const sh = el.dataset.id ? S.history.find((h) => h.id === el.dataset.id) : S.shift;
      if (sh) printShift(sh);
      break;
    }

    case 'wipe':
      if (confirm('Erase every shift, past and present, plus your room list? This cannot be undone.')) {
        localStorage.removeItem(STORE);
        S = defaults();
        applyTheme();
        closeSheet();
        toast('Everything erased');
      }
      break;

    case 'sheet-close': closeSheet(); break;
  }
});

/* close the sheet by tapping the dimmed area behind it */
document.addEventListener('click', (ev) => {
  if (ev.target.id === 'scrim') closeSheet();
});

/* field edits — input for text, change for select */
document.addEventListener('input', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  if (el.dataset.act === 'val') setValue(el.dataset.path, el.value);
  else if (el.dataset.act === 'entry-name') {
    const epath = el.dataset.path;
    const i = epath.lastIndexOf('#');
    const list = S.shift.entries[epath.slice(0, i)] || [];
    const e = list.find((x) => x.uid === epath.slice(i + 1));
    if (e) { e.name = el.value; save(); }
  } else if (el.dataset.act === 'tl-edit') {
    const arr = S.shift.values[el.dataset.path];
    if (Array.isArray(arr)) { arr[+el.dataset.i] = el.value; save(); }
  } else if (el.id === 'unit-name') {
    S.settings.unit = el.value;
    save();
  }
});
document.addEventListener('change', (ev) => {
  const el = ev.target.closest('[data-act="val"]');
  if (el && el.tagName === 'SELECT') { setValue(el.dataset.path, el.value); render(); }
});

/* Enter submits the quick-add fields */
document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Enter') return;
  if (ev.target.id === 'todo-input') { ev.preventDefault(); addTodo(); }
  if (ev.target.id === 'room-input') { ev.preventDefault(); addRooms(); }
});

/* keep the elapsed clock and the Q2 / 0700 cues honest */
setInterval(() => { if (S.shift && $('#scrim').hidden) render(); }, 60000);

/* ───────────────────────────── boot ───────────────────────────── */

load();
applyTheme();
render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () =>
    navigator.serviceWorker.register('sw.js').catch(() => {}));
}
