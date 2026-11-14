/* The five shift screens, one per tab: Timeline, Rooms, Checklist, Notes and
 * Shift.
 *
 * They read and write the same shift data as the checklist in app.js. Timed
 * tasks show on the Timeline, tasks grouped by patient room on Rooms, the full
 * checklist on Checklist, free notes on Notes, and the report, past shifts and
 * settings on Shift. Notes are not part of the checklist or the report. */
'use strict';

const VIEWS = [
  { id: 'timeline', label: 'Timeline', icon: 'clock' },
  { id: 'rooms', label: 'Rooms', icon: 'grid' },
  { id: 'everything', label: 'Checklist', icon: 'list' },
  { id: 'notes', label: 'Notes', icon: 'note' },
  { id: 'shift', label: 'Shift', icon: 'moon' },
];

const NOTE_COLORS = ['var(--soft)', 'var(--bg)'];   // shaded and outlined, alternating

let composer = null;        // { room, timed, text, time } while the add-task form is open
let focusSection = null;    // the one checklist section that is open

const pad2 = (n) => String(n).padStart(2, '0');
const naturalSort = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

function currentView() {
  const v = S.tab || 'timeline';
  return VIEWS.some((x) => x.id === v) ? v : 'timeline';
}

function renderTabs() {
  const el = $('#tabs');
  document.body.classList.toggle('has-tabs', !!S.shift);
  if (!S.shift) { el.innerHTML = ''; return; }
  const cur = currentView();
  el.innerHTML = VIEWS.map((v) => `<button data-act="view" data-view="${v.id}"
      ${v.id === cur ? 'aria-current="page"' : ''}>${svg(v.icon)}<span>${v.label}</span></button>`).join('');
}

function renderShift(sh) {
  ensureShiftFields(sh);
  const view = currentView();
  const prog = overallProgress(sh);
  const left = prog.total - prog.done;

  // Next timed item and anything past its time, from the same list the Timeline shows.
  const now = Date.now();
  const timed = timelineItems(sh).filter((i) => !i.done);
  const next = timed.find((i) => i.at.getTime() >= now);
  const late = timed.filter((i) => i.at.getTime() < now).length;
  const nextName = next ? (next.room ? next.room + ': ' + next.label : next.label) : '';
  const status = next
    ? `Next: ${nextName} at ${hhmm(next.at)}.${late ? ` ${late} past its time.` : ''}`
    : (late ? `${late} timed ${late === 1 ? 'check is' : 'checks are'} past its time.` : 'No timed checks left tonight.');

  // One line in the header carries the shift's state: how much is left and
  // what is next. The thin bar under it is overall progress.
  $('#status').innerHTML = `<b>${left}</b> left${next
      ? ` · next <b>${hhmm(next.at)}</b> <span class="status-what">${esc(nextName)}</span>` : ''}${
      late ? ` · <b class="late">${late} late</b>` : ''}`;
  $('#status').title = status;
  $('#meter').style.width = `${prog.total ? (prog.done / prog.total) * 100 : 0}%`;
  $('#hdr').innerHTML = '';
  $('#hdr').hidden = true;

  const body = {
    timeline: timelineHTML,
    rooms: roomsHTML,
    everything: everythingHTML,
    notes: notesHTML,
    shift: shiftHTML,
  }[view];
  $('#app').innerHTML = body(sh);
  renderTabs();
}

/* ───────────────────────────── task walking ─────────────────────────────
 * Visits every template node that applies tonight. Children of a room list get
 * that room's name; other lists keep the room of the place they sit in. */

function walkTree(sh, fn) {
  const visit = (node, path, room) => {
    if (!appliesToday(node, sh, path)) return;
    if (node.repeat) {
      const isRoom = !!(node.repeat.field && node.repeat.field.type === 'room');
      fn(node, path, room, true);
      (sh.entries[path] || []).forEach((e) => {
        (node.repeat.children || []).forEach((c) =>
          visit(c, path + '#' + e.uid + '.' + c.id, isRoom ? e.name : room));
      });
      return;
    }
    fn(node, path, room, false);
    (node.children || []).forEach((c) => visit(c, path + '.' + c.id, room));
  };
  TEMPLATE.forEach((sec) => (sec.items || []).forEach((it) => visit(it, sec.id + '.' + it.id, '')));
}

/* ───────────────────────────── timeline ───────────────────────────── */

function timelineItems(sh) {
  const items = [];
  walkTree(sh, (node, path, room, isRepeat) => {
    if (isRepeat) return;
    if (node.field && node.field.type === 'schedule') {
      schedList(sh, path).forEach((it) => {
        if (!it.time) return;
        items.push({ kind: 'sched', path, uid: it.uid, done: !!it.done, doneAt: it.done,
          at: nextOccurrence(it.time, sh), room, label: node.label });
      });
    } else if (!node.field && !node.repeat && ((sh.times || {})[path] || node.at)) {
      // a time set by hand wins over the fixed one in the template
      const t = (sh.times || {})[path] || node.at;
      items.push({ kind: 'check', path, done: !!sh.checks[path], doneAt: sh.checks[path],
        at: nextOccurrence(t, sh), room, label: node.label,
        tag: path.startsWith('restraints.') ? 'Restraints' : '' });
    }
  });
  sh.todos.forEach((t) => {
    if (!t.time) return;
    items.push({ kind: 'todo', uid: t.uid, done: !!t.done, doneAt: t.at,
      at: nextOccurrence(t.time, sh), room: t.room || '', label: t.text });
  });
  customList(sh).forEach((c) => {
    if (!c.time) return;
    items.push({ kind: 'custom', uid: c.uid, done: !!c.done, doneAt: c.done,
      at: nextOccurrence(c.time, sh), room: c.room, label: c.label });
  });
  return items.sort((a, b) => a.at - b.at);
}

function timedRowHTML(it, now, first, hourLabel) {
  const base = it.room ? `${it.room}: ${it.label}` : it.label;
  const title = it.tag ? `${it.tag}, ${base}` : base;
  const late = !it.done && it.at.getTime() < now;
  const soon = !it.done && !late && it.at.getTime() - now <= 20 * 60000;
  const time = it.done ? `done ${hhmm(it.doneAt)}` : hhmm(it.at);
  return `<div class="tl-row">
    <span class="tl-hour">${first ? hourLabel : ''}</span>
    <button class="tl-task ${it.done ? 'done' : ''}" data-act="tl-toggle" data-kind="${it.kind}"
      data-path="${esc(it.path || '')}" data-uid="${esc(it.uid || '')}" aria-pressed="${!!it.done}">
      <span class="tl-circle ${late ? 'late' : soon ? 'soon' : ''}" aria-hidden="true">${it.done ? svg('check') : ''}</span>
      <span class="tl-name">${esc(title)}</span>
      <span class="tl-time ${late ? 'late' : soon ? 'soon' : ''}">${time}</span>
    </button>
  </div>`;
}

function timelineHTML(sh) {
  const now = Date.now();
  const items = timelineItems(sh);
  const base = new Date(sh.start);
  base.setMinutes(0, 0, 0);
  const hourIndex = (d) => Math.floor((d - base) / 3600000);
  const hourLabel = (idx) => pad2((base.getHours() + idx) % 24);

  // Build one flat run of rows: timed items, gaps for quiet hours, and the "now" line.
  // "Now" takes up its own hour, so quiet hours are split around it instead of
  // one gap that runs past the present.
  const seq = [];
  let nowPlaced = false;
  items.forEach((it) => {
    if (!nowPlaced && it.at.getTime() >= now) { seq.push({ t: 'now', idx: hourIndex(now) }); nowPlaced = true; }
    seq.push({ t: 'item', it, idx: hourIndex(it.at) });
  });
  if (!nowPlaced) seq.push({ t: 'now', idx: hourIndex(now) });

  const tokens = [];
  let lastIdx = -1;        // last hour shown (items or now)
  let lastItemIdx = null;  // last hour that printed its label
  seq.forEach((s) => {
    if (s.idx > lastIdx + 1) tokens.push({ t: 'gap', from: lastIdx + 1, to: s.idx - 1 });
    if (s.t === 'now') tokens.push({ t: 'now' });
    else {
      tokens.push({ t: 'item', it: s.it, idx: s.idx, first: s.idx !== lastItemIdx });
      lastItemIdx = s.idx;
    }
    lastIdx = Math.max(lastIdx, s.idx);
  });

  const rows = tokens.map((tok) => {
    if (tok.t === 'now') {
      return `<div class="tl-now"><span class="tl-hour">Now</span>
        <span class="tl-now-line" aria-hidden="true"></span><span class="tl-now-time">${hhmm(now)}</span></div>`;
    }
    if (tok.t === 'gap') {
      const range = tok.from === tok.to ? hourLabel(tok.from) : hourLabel(tok.from) + '–' + hourLabel(tok.to);
      return `<div class="tl-gap"><span class="tl-hour">${range}</span><span>Nothing due</span></div>`;
    }
    return timedRowHTML(tok.it, now, tok.first, hourLabel(tok.idx));
  }).join('');

  const untimed = customList(sh).filter((c) => !c.time);
  const untimedHTML = untimed.length ? `<div class="tl-untimed">
      <h3>Untimed</h3>
      ${untimed.map((c) => `<button class="tl-task ${c.done ? 'done' : ''}" data-act="cust-toggle"
          data-uid="${esc(c.uid)}" aria-pressed="${!!c.done}">
          <span class="tl-circle" aria-hidden="true">${c.done ? svg('check') : ''}</span>
          <span class="tl-name">${esc(c.room ? c.room + ': ' + c.label : c.label)}</span>
          <span class="tl-time">${c.done ? 'done ' + hhmm(c.done) : ''}</span>
        </button>`).join('')}
    </div>` : '';

  return `${dueCardHTML(sh)}
    <div class="timeline">${rows || '<div class="empty">Nothing timed tonight yet. Add timed checks under Rooms.</div>'}</div>
    ${untimedHTML}`;
}

function timelineToggle(el) {
  const sh = S.shift;
  const { kind, path, uid } = el.dataset;
  if (kind === 'check') {
    toggleCheck(path);
    return;
  }
  if (kind === 'sched') {
    const it = schedList(sh, path).find((x) => x.uid === uid);
    if (it) it.done = it.done ? null : new Date().toISOString();
  } else if (kind === 'custom') {
    const c = customList(sh).find((x) => x.uid === uid);
    if (c) c.done = c.done ? null : new Date().toISOString();
  } else if (kind === 'todo') {
    const t = sh.todos.find((x) => x.uid === uid);
    if (t) {
      t.done = !t.done;
      t.at = t.done ? new Date().toISOString() : null;
    }
  }
  haptic();
  save();
  render();
}

/* ───────────────────────────── rooms ───────────────────────────── */

/* Rooms come from the room lists in the checklist, from rooms added by hand, and
 * from tasks added in a room. */
function roomNames(sh) {
  const set = new Set(sh.roomList);
  walkTree(sh, (node, path, room, isRepeat) => {
    if (!isRepeat || !(node.repeat.field && node.repeat.field.type === 'room')) return;
    (sh.entries[path] || []).forEach((e) => e.name && set.add(e.name));
  });
  customList(sh).forEach((c) => c.room && set.add(c.room));
  return [...set].sort(naturalSort);
}

function roomTasks(sh) {
  const byRoom = {};
  const add = (room, task) => { (byRoom[room] = byRoom[room] || []).push(task); };
  walkTree(sh, (node, path, room, isRepeat) => {
    if (isRepeat || !room) return;
    if (node.field && node.field.type === 'schedule') add(room, { kind: 'sched', node, path });
    else if (!node.field && !node.bare && !node.repeat) add(room, { kind: 'check', node, path });
    else if (node.field && node.field.type === 'select') add(room, { kind: 'field', node, path });
  });
  customList(sh).forEach((c) => { if (c.room) add(c.room, { kind: 'custom', c }); });
  return byRoom;
}

function roomCounts(sh, tasks) {
  const acc = { done: 0, total: 0 };
  tasks.forEach((t) => {
    if (t.kind === 'check') {
      acc.total++;
      if (sh.checks[t.path]) acc.done++;
    } else if (t.kind === 'sched') {
      const list = schedList(sh, t.path);
      acc.total += list.length;
      acc.done += list.filter((x) => x.done).length;
    } else if (t.kind === 'custom') {
      acc.total++;
      if (t.c.done) acc.done++;
    }
  });
  return acc;
}

function taskRowHTML(sh, t) {
  if (t.kind === 'field') {
    return `<div class="room-sched"><div class="room-sched-label">${esc(t.node.label)}</div>
      ${fieldHTML(t.node, t.path, sh)}</div>`;
  }
  if (t.kind === 'sched') {
    return `<div class="room-sched"><div class="room-sched-label">${esc(t.node.label)}</div>
      ${fieldHTML(t.node, t.path, sh)}</div>`;
  }
  if (t.kind === 'check') {
    const done = !!sh.checks[t.path];
    const at = t.node.at ? `<span class="room-time">${hhmm(nextOccurrence(t.node.at, sh))}</span>` : '';
    return `<div class="room-task ${done ? 'done' : ''}">
      <button class="check" role="checkbox" aria-checked="${done}" data-act="check" data-path="${esc(t.path)}"
        aria-label="${esc(t.node.label)}">${svg('check')}</button>
      <span class="room-task-name" data-act="check" data-path="${esc(t.path)}">${esc(t.node.label)}</span>
      ${done ? `<span class="stamp">${hhmm(sh.checks[t.path])}</span>` : at}
    </div>`;
  }
  const c = t.c;
  return `<div class="room-task ${c.done ? 'done' : ''}">
    <button class="check" role="checkbox" aria-checked="${!!c.done}" data-act="cust-toggle" data-uid="${esc(c.uid)}"
      aria-label="${esc(c.label)}">${svg('check')}</button>
    <span class="room-task-name" data-act="cust-toggle" data-uid="${esc(c.uid)}">${esc(c.label)}</span>
    ${c.done ? `<span class="stamp">${hhmm(c.done)}</span>` : c.time ? `<span class="room-time">${esc(c.time)}</span>` : '<span class="room-time">No time</span>'}
    <button class="entry-del" data-act="cust-del" data-uid="${esc(c.uid)}" aria-label="Remove ${esc(c.label)}">${svg('trash')}</button>
  </div>`;
}

function composerHTML(room) {
  const c = composer;
  return `<div class="composer">
    <label class="field-label" for="cust-text">Task</label>
    <input id="cust-text" type="text" value="${esc(c.text)}" placeholder="e.g. Glucose recheck" autocomplete="off" enterkeyhint="done">
    <div class="seg" role="group" aria-label="Timing">
      <button data-act="cust-timing" data-timed="1" aria-pressed="${c.timed}">At a time</button>
      <button data-act="cust-timing" data-timed="0" aria-pressed="${!c.timed}">No time</button>
    </div>
    ${c.timed ? `<label class="field-label" for="cust-time">Time</label>
      <input id="cust-time" type="time" value="${esc(c.time)}">` : ''}
    <div class="composer-actions">
      <button class="btn-quiet" data-act="cust-cancel">Cancel</button>
      <button class="btn-solid" data-act="cust-add" data-room="${esc(room)}">Add task</button>
    </div>
  </div>`;
}

function roomCardHTML(sh, room, tasks) {
  const vacatedAt = sh.vacated[room];
  const occupied = sh.roomList.includes(room);
  // a vacated room starts folded; its open tasks are still there when you open it
  const open = sh.open['room:' + room] === undefined ? !vacatedAt : sh.open['room:' + room] !== false;
  const { done, total } = roomCounts(sh, tasks);
  const occBtn = occupied && !vacatedAt
    ? `<button class="add-task quiet" data-act="occ-vacate" data-room="${esc(room)}">Mark vacated</button>` : '';
  const body = open ? `<div class="room-body">
      ${tasks.map((t) => taskRowHTML(sh, t)).join('') || '<div class="room-empty">No tasks yet for this room.</div>'}
      ${composer && composer.room === room
        ? composerHTML(room)
        : `<div class="room-actions">
            <button class="add-task" data-act="cust-open" data-room="${esc(room)}">${svg('plus')} Add task</button>
            ${occBtn}
          </div>`}
    </div>` : '';
  const sub = vacatedAt ? `Vacated ${hhmm(vacatedAt)}${total - done ? ` · ${total - done} open` : ''}`
    : total ? `${done} of ${total} done` : 'No tasks yet';
  return `<section class="room-card${vacatedAt ? ' vacated' : ''}" data-room="${esc(room)}">
    <div class="room-headline">
      <button class="room-head" data-act="room-toggle" data-room="${esc(room)}" aria-expanded="${open}">
        <span class="room-name">${esc(room)}</span>
        <span class="room-sub">${sub}</span>
        ${svg('chev', 'chev')}
      </button>
      ${vacatedAt ? `<button class="add-task" data-act="occ-fill" data-room="${esc(room)}">New patient</button>` : ''}
    </div>
    ${body}
  </section>`;
}

function roomsHTML(sh) {
  const byRoom = roomTasks(sh);
  const all = roomNames(sh);
  const active = all.filter((r) => !sh.vacated[r]);
  const gone = Object.keys(sh.vacated).sort(naturalSort);
  const n = sh.roomList.length;
  const cards = active.map((r) => roomCardHTML(sh, r, byRoom[r] || [])).join('');
  return `<div class="occ-bar">
      <span class="occ-count">${n ? `${n} occupied` : 'No rooms marked occupied'}</span>
      <button class="add-task" data-act="occ-open">${n ? 'Change rooms' : 'Choose occupied rooms'}</button>
    </div>
    <div class="room-list">
      ${cards || '<div class="empty">Tap Choose occupied rooms to list tonight\'s patients.</div>'}
    </div>
    ${gone.length ? `<h3 class="room-group-title">Vacated tonight</h3>
      <div class="room-list">${gone.map((r) => roomCardHTML(sh, r, byRoom[r] || [])).join('')}</div>` : ''}`;
}

/* ── occupied rooms: tap the unit's rooms on or off ──
 * Turning a room off during the shift marks it vacated (with the time), so it
 * can be filled again when a new patient arrives. While first setting up the
 * shift, or right after a mistaken tap, turning it off just un-picks it. */
let occSetup = false;          // the start-of-shift pass
let occFresh = new Set();      // rooms turned on in this sitting

function setOccupied(room, on) {
  const sh = S.shift;
  if (on) {
    if (!sh.roomList.includes(room)) sh.roomList.push(room);
    delete sh.vacated[room];
    occFresh.add(room);
  } else {
    sh.roomList = sh.roomList.filter((r) => r !== room);
    if (!occSetup && !occFresh.has(room)) sh.vacated[room] = new Date().toISOString();
    occFresh.delete(room);
  }
  sh.roomList.sort(naturalSort);
  save();
}

function openOccupancySheet(setup) {
  occSetup = !!setup;
  occFresh = new Set();
  renderOccupancySheet();
}

function renderOccupancySheet() {
  const sh = S.shift;
  const unit = S.settings.rooms;
  const last = S.history.find((h) => (h.roomList || []).some((r) => unit.includes(r)));
  const n = sh.roomList.length;
  sheet(`
    <div class="sheet-nav">
      <span class="txt-btn"></span>
      <h2>Occupied rooms</h2>
      <button class="txt-btn strong" data-act="occ-done">Done</button>
    </div>
    <div class="sheet-body">
      <p>${occSetup ? 'Which rooms have a patient tonight? ' : ''}Tap a room to mark it occupied.
        ${occSetup ? '' : 'Tap an occupied room to mark it vacated. A vacated room can be filled again.'}</p>
      ${unit.length ? `<div class="occ-tools">
          <span class="occ-count">${n} occupied</span>
          <button class="add-task" data-act="occ-all">All</button>
          <button class="add-task" data-act="occ-none">None</button>
          ${occSetup && last && !n ? `<button class="add-task" data-act="occ-last">Same as last shift</button>` : ''}
        </div>
        <div class="room-grid">
          ${unit.map((r) => {
            const on = sh.roomList.includes(r);
            const gone = sh.vacated[r];
            return `<button class="room-opt occ-opt${gone ? ' gone' : ''}" data-act="occ-toggle" data-room="${esc(r)}"
              aria-pressed="${on}">${esc(r)}${gone ? `<small>Vacated ${hhmm(gone)}</small>` : ''}</button>`;
          }).join('')}
        </div>
        <div class="group-footer">Rooms come from Settings.</div>`
        : `<div class="empty" style="padding:0 var(--gutter)">No rooms set yet.</div>
           <button class="btn" data-act="settings">Add room numbers in Settings</button>`}
    </div>`);
}

function defaultTimeText() {
  const d = new Date(Date.now() + 60 * 60000);
  return `${pad2(d.getHours())}:${pad2(Math.round(d.getMinutes() / 5) * 5 % 60)}`;
}

function addCustom(room) {
  const sh = S.shift;
  const text = (($('#cust-text') || {}).value || composer.text || '').trim();
  if (!text) { toast('Type the task first'); return; }
  const timed = composer.timed;
  const time = timed ? (($('#cust-time') || {}).value || composer.time) : null;
  if (timed && !time) { toast('Set a time, or choose No time'); return; }
  customList(sh).push({ uid: uid(), room: room || '', label: text, time: time || null, done: null });
  composer = null;
  save();
  render();
  toast('Task added');
}

/* ───────────────────────────── everything else ───────────────────────────── */

function everythingHTML(sh) {
  return `<div class="sections">${TEMPLATE.map((sec) => groupHTML(sec, sh)).join('')}</div>`;
}

/* ───────────────────────────── shift ─────────────────────────────
 * Everything about the shift as a whole: what's left, the report, past shifts
 * and settings. */

function shiftHTML(sh) {
  const p = overallProgress(sh);
  const open = TEMPLATE.map((sec) => {
    const q = sectionProgress(sec, sh);
    return q.total - q.done > 0 ? `<button class="list-row" data-act="report-jump" data-sec="${esc(sec.id)}">
        <span class="list-main">${esc(sec.title)}</span><span class="list-meta">${q.total - q.done} left</span>${svg('chev', 'chev')}</button>` : '';
  }).join('');
  return `<section class="block">
      <h2 class="block-title">Tonight</h2>
      <p class="block-lede">${dayStamp(sh.start)} · on since ${hhmm(sh.start)} · ${elapsed(sh.start)}.
        <b>${p.done} of ${p.total}</b> done.</p>
      ${open ? `<div class="list">${open}</div>` : '<p class="muted">Nothing outstanding.</p>'}
    </section>
    <section class="block">
      <h2 class="block-title">Report</h2>
      <div class="actions">
        <button class="btn" data-act="copy-report">${svg('copy')} Copy</button>
        <button class="btn" data-act="print">${svg('print')} Print or PDF</button>
        <button class="btn" data-act="cal-export">${svg('cal')} Calendar</button>
      </div>
      <details class="preview"><summary>Preview the report</summary>
        <div class="report">${esc(reportText(sh))}</div></details>
    </section>
    <section class="block">
      <div class="list">
        <button class="list-row" data-act="history"><span class="list-main">Past shifts</span>
          <span class="list-meta">${S.history.length || ''}</span>${svg('chev', 'chev')}</button>
        <button class="list-row" data-act="settings"><span class="list-main">Settings</span>${svg('chev', 'chev')}</button>
      </div>
    </section>
    <section class="block">
      <button class="btn danger" data-act="shift-end">${svg('stop')} End shift and save</button>
      <p class="muted">Everything is saved on this phone as you go. Ending the shift files this report
        under Past shifts and starts the next one clean.</p>
    </section>`;
}

/* ───────────────────────────── notes ───────────────────────────── */

function notesHTML(sh) {
  const squares = sh.notes.map((n) => `<button class="note" data-act="note-open" data-uid="${esc(n.uid)}"
      style="background:${esc(n.color)}">
      <span class="note-text">${n.text ? esc(n.text) : '<span class="note-empty">Empty note</span>'}</span>
      <span class="note-time">${hhmm(n.at)}</span>
    </button>`).join('');
  return `<div class="notes-grid">
      ${squares}
      <button class="note note-new" data-act="note-new" aria-label="New note">
        <span aria-hidden="true">+</span>New note
      </button>
    </div>
    <p class="notes-foot">Notes are for you. They aren't part of the checklist or the report.</p>`;
}

function openNoteSheet(noteUid) {
  const n = S.shift.notes.find((x) => x.uid === noteUid);
  if (!n) return;
  sheet(`
    <div class="sheet-nav">
      <span class="txt-btn"></span>
      <h2>Note</h2>
      <button class="txt-btn strong" data-act="sheet-close">Done</button>
    </div>
    <div class="sheet-body">
      <textarea id="note-text" data-uid="${esc(n.uid)}" rows="8" placeholder="Type a note"
        style="margin:0 var(--gutter) 14px;width:calc(100% - 2 * var(--gutter));min-height:180px">${esc(n.text)}</textarea>
      <button class="btn destructive" data-act="note-del" data-uid="${esc(n.uid)}">${svg('trash')} Delete note</button>
    </div>`);
  const ta = $('#note-text');
  if (ta) setTimeout(() => ta.focus({ preventScroll: true }), 50);
}

/* ───────────────────────────── actions ───────────────────────────── */

/* Returns true if the click belongs to a shift view. */
function viewAction(act, el) {
  const sh = S.shift;
  if (!sh) return false;
  switch (act) {
    case 'view':
      S.tab = el.dataset.view;
      save();
      render();
      window.scrollTo(0, 0);
      return true;
    case 'tl-toggle':
      timelineToggle(el);
      return true;
    case 'room-toggle': {
      const key = 'room:' + el.dataset.room;
      sh.open[key] = el.getAttribute('aria-expanded') !== 'true';   // flip what's on screen
      save();
      render();
      return true;
    }
    case 'cust-open':
      composer = { room: el.dataset.room, timed: false, text: '', time: defaultTimeText() };
      render();
      setTimeout(() => { const i = $('#cust-text'); if (i) i.focus({ preventScroll: true }); }, 50);
      return true;
    case 'cust-timing':
      composer.text = ($('#cust-text') || {}).value ?? composer.text;
      composer.time = ($('#cust-time') || {}).value || composer.time;
      composer.timed = el.dataset.timed === '1';
      render();
      return true;
    case 'cust-cancel':
      composer = null;
      render();
      return true;
    case 'cust-add':
      addCustom(el.dataset.room);
      return true;
    case 'cust-toggle': {
      const c = customList(sh).find((x) => x.uid === el.dataset.uid);
      if (c) c.done = c.done ? null : new Date().toISOString();
      haptic();
      save();
      render();
      return true;
    }
    case 'cust-del':
      sh.custom = customList(sh).filter((x) => x.uid !== el.dataset.uid);
      save();
      render();
      return true;
    case 'occ-open':
      openOccupancySheet(false);
      return true;
    case 'occ-toggle': {
      const r = el.dataset.room;
      setOccupied(r, !sh.roomList.includes(r));
      renderOccupancySheet();
      return true;
    }
    case 'occ-all':
      S.settings.rooms.forEach((r) => { if (!sh.roomList.includes(r)) setOccupied(r, true); });
      renderOccupancySheet();
      return true;
    case 'occ-none':
      sh.roomList.slice().forEach((r) => { if (S.settings.rooms.includes(r)) setOccupied(r, false); });
      renderOccupancySheet();
      return true;
    case 'occ-last': {
      const last = S.history.find((h) => (h.roomList || []).some((r) => S.settings.rooms.includes(r)));
      if (last) last.roomList.filter((r) => S.settings.rooms.includes(r)).forEach((r) => setOccupied(r, true));
      renderOccupancySheet();
      return true;
    }
    case 'occ-done':
      occSetup = false;
      closeSheet();
      return true;
    case 'occ-vacate':
      occFresh = new Set();
      occSetup = false;
      setOccupied(el.dataset.room, false);
      delete sh.open['room:' + el.dataset.room];
      render();
      toast(`${el.dataset.room} vacated`);
      return true;
    case 'occ-fill':
      setOccupied(el.dataset.room, true);
      delete sh.open['room:' + el.dataset.room];
      save();
      render();
      toast(`${el.dataset.room} occupied`);
      return true;
    case 'sec-open':      // open one section, close the rest, and bring it into view
    case 'toggle-sec': {
      const id = el.dataset.sec;
      focusSection = act === 'toggle-sec' && focusSection === id ? null : id;
      render();
      if (focusSection) showSection(focusSection);
      return true;
    }
    case 'quick-room':    // one tap adds an occupied room to a checklist list
      addEntries(el.dataset.path, [el.dataset.room]);
      toast(`${el.dataset.room} added`);
      return true;
    case 'note-new': {
      const note = { uid: uid(), text: '', color: NOTE_COLORS[sh.notes.length % NOTE_COLORS.length], at: new Date().toISOString() };
      sh.notes.push(note);
      save();
      openNoteSheet(note.uid);
      return true;
    }
    case 'note-open':
      openNoteSheet(el.dataset.uid);
      return true;
    case 'note-del':
      if (confirm('Delete this note?')) {
        sh.notes = sh.notes.filter((n) => n.uid !== el.dataset.uid);
        save();
        closeSheet();
      }
      return true;
    default:
      return false;
  }
}

/* Typing in the add-task form and the note editor. */
document.addEventListener('input', (ev) => {
  if (ev.target.id === 'note-text' && S.shift) {
    const n = S.shift.notes.find((x) => x.uid === ev.target.dataset.uid);
    if (n) { n.text = ev.target.value; save(); }
  }
});

document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Enter') return;
  if (ev.target.id === 'cust-text' && composer) {
    ev.preventDefault();
    addCustom(composer.room);
  }
});
