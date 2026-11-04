# Charge Nurse Checklist

A shift checklist for charge nurses, built from the Notion note of the same name.
It installs to the iPhone home screen, runs offline, and keeps everything on the
device.

## Put it on your iPhone

1. **Turn on hosting** (once): in this repo on github.com, go to
   **Settings → Pages**. Under *Build and deployment*, set **Source** to
   *Deploy from a branch*, pick the branch this code is on, folder `/ (root)`,
   and press **Save**. Wait a minute or two.
2. **Open the link it gives you** in **Safari** on your iPhone
   (`https://<your-username>.github.io/nurse-notebook/`). It has to be Safari —
   Chrome on iOS cannot install home-screen apps.
3. Tap the **Share** button (the square with the arrow), scroll down, tap
   **Add to Home Screen**, then **Add**.

You now have a *Charge* icon. Opening it gives you a full-screen app with no
browser bar, and it works with no signal at all.

4. **Check your rooms.** CCU 16 through CCU 30 are already loaded, so there is
   nothing to do unless the unit changes. If it does, open **Settings** and type
   a range like `CCU 16 - CCU 30` or `3401-3420` and it expands to every room in
   between; commas separate rooms that are not in a run (`CCU 16, CCU 22`).

### When I push an update

Reopen the app while you have signal. It picks up the new version on the next
launch. Your rooms, your current shift, and your history are untouched.

## How it works

**Four screens, linked from the top bar:**

- **Timeline:** the night as hours, from the first check to the last. A *now* line
  marks where you are, and quiet hours collapse to one line. Timed checks are here,
  with a countdown in the last 20 minutes and *overdue* once they pass. Tasks with no
  time sit under *Untimed*.
- **Rooms:** one card per patient room, with that room's tasks and times, and an
  **Add task** button. Add a task with a time, or choose *No time* for an untimed one.
  Tap **Add a room** for rooms not on any list yet.
- **Everything else:** the full checklist, section by section, as it was before.
- **Notes:** sticky-note squares for anything you want to jot down. Notes aren't part
  of the checklist or the report.

Settings, the shift report and past shifts are in the top bar, next to the page links.

**Start a shift** from the home screen. The checklist resets clean, and a clock
starts. Everything you type is saved to the phone as you go, so you can close the
app mid-shift, get pulled into a code, and come back to exactly where you were.

**Every box you tick is timestamped** — the time appears next to it in green, and
it lands in the report at the end of the shift. Tick it again to undo.

**Rooms.** Anywhere the paper checklist had a blank "Room:" line, tap **Add
rooms** and you get a grid of your unit. Tap as many as you need and they are all
added at once, each with its own set of subtasks. Rooms already on the list are
dimmed so you do not double up. The trash icon removes a room and everything
logged under it.

**Chem sticks.** Add the rooms, then tap **Add time** under each one for every
check that room needs tonight. Tap the time to set it on the iPhone's time wheel.
Each one gets its own checkbox, and ticking it records when you actually did it.
The list sorts itself in shift order (2100 before 0100), shows *in 20m* as one
comes up, and *Overdue* once it has passed unticked.

**The 0600 restraint check.** Each restrained patient gets a *Q2 charting
verified* box that stays quiet most of the night and lights up as 0600
approaches, which is when you confirm the bedside nurse has finished their
documentation. The same cue sits on the 0700 CRRT charge.

**Situations.** On RRT handoffs and incident reports, **Add situation** gives you
another text box. Add as many as you need per room.

**RRTs anywhere in the hospital.** RRTs are not confined to the unit, so that
picker has a text box above the grid. Type any room — `4W 12`, `ED 3` — and press
return to stage it; it gets added alongside whatever you tapped on the grid. The
unit's own pickers stay restricted to the CCU list.

**(i) buttons** hold the detail that does not fit on one line — the Tele Tracker
menu path, what counts on the pull log, what to flag off the OR board.

**Day-aware.** The narc count only counts toward your progress on a Tuesday
night, the I&O audit only on the first Tuesday night of the month, and the code
cart expiration check only on the first Sunday night. The rest
of the time they sit there greyed out and labelled, rather than vanishing.

On the nights one of these is due, a **Due tonight** card sits at the top of the
Timeline, and on the start screen before you begin, so you don't have to
remember what night it is. Tap an item in the card to jump straight to it in
Everything else. Each
one ticks itself off in the card as you finish it, and the card turns green
once they're all done.

A night shift spans two dates, so "Tuesday" means **the night that starts on
Tuesday and runs into Wednesday** — the shift keeps its Tuesday label after
midnight, and a Monday night that happens to end on Tuesday does not count.

**Possible admissions.** Under *OR board checked for the next day*, use **Add possible
admission** to list the OR cases that may come up (for example, a heart, a TCAR or a
fem/pop). Each one is kept in the report.

**No CRRT tonight.** On a night with no CRRT patients, tick **No CRRT tonight** in
Equipment & Supplies. The CRRT charge and supply checks then drop out of your count
and the Due tonight card, and show as *Not tonight*. Untick it if a patient comes in.

**Assignment at 0600.** Handoff & Staffing has **Assignment entered in the assignment
wizard**, due around 0600 before dayshift. Type the assignment in the box as you enter
it, so the report shows what went in.

**Times on checklist items.** Any tick-off item in Everything else has a small time box
on the right. Set a time and the item appears on the Timeline at that hour, where you can
tick it too. Clear the box to take it off the Timeline again. Items with a fixed time
(such as the 0600 restraint check) keep it unless you set your own.

**Patient status.** Under *Admit / Transfer / Discharge*, each patient has a **Status**
dropdown: Admitted, Transferred, Discharged, Hospice or Expired. It shows on the Rooms
screen too, and the report includes it once it's set. The sticker and hospice tick boxes
are still there, so you can keep using them.

**Working short.** There is no secretary on nights, so that work sits in Forms &
Logs as ordinary tasks. The chem stick, bath and restock list sits at the bottom
under *If No Aide on the Floor* — tick it on the nights it applies and skip it
otherwise.

**Report.** The Report tab shows a plain-text version of the whole checklist with
timestamps, ticked and unticked alike. **Copy as text** puts it on the clipboard.
**Print / Save as PDF** opens the iOS print sheet — AirPrint it, or pinch out on
the preview to save a PDF you can attach. **End shift** files it under History and
clears the live checklist.

**History** keeps past shifts on the phone. Open one to read, copy, print, or
delete it.

## Add timed checks to Calendar

On the **This shift** part of Settings, tap **Add timed checks to Calendar**. It downloads
a `.ics` file with one event per open timed check, titled *Room: Task* (for example
*CCU 17: Chem stick*). Each event alerts 15 minutes before and at the time, and Calendar
shows those alerts even with the phone locked. No server is involved.

Opening the file adds the events to your Calendar app. When you export again for the
same shift, each check keeps the same ID, so Calendar should update the existing event
rather than add a copy. Changing a time moves the event. Adding a task adds a new event.

Calendar can't be told by the app to remove events, so a few things need a hand:

- A check that's ticked off stays in Calendar. Delete it there.
- A check that's removed from the shift stays in Calendar. Delete it there.
- Events from a previous shift stay until you delete them. Search Calendar for a
  room name to find them.

How Calendar treats a repeat import on your phone is the one thing this app can't
test. Try it once: export, change a time, export again, and check whether you have one
event or two.

## Reminders (optional)

If you host the small reminder server in `server/`, the app can alert you 15 minutes
before each timed check and again when it is due, even with the phone locked. Turn it
on under Settings, then Timed checks. This needs a server, which is the one exception
to the offline design, so read `server/README.md` first. The server stores each phone's
check times and room names, and removes them about two hours after they are due.

Without a server, the app works fully offline and sends nothing.

## Privacy

Everything lives in this phone's local storage. There is no account and no analytics. The app makes no network calls at all, unless you turn on timed-check reminders, in which case only the reminder details described above go to your reminder server.

That also means there is **no backup**. Deleting the app from the home screen, or
clearing Safari's website data, erases every shift permanently. If a shift matters,
print or copy it before you end it.

Rooms plus clinical detail can amount to PHI. Keeping it on the device avoids
creating a record system your facility has not approved — but the app is a
personal work aid, not a medical record, and it is not a substitute for charting
in the EMR.

## Changing the checklist

`js/template.js` is the whole checklist and the only file you need to touch to
reword a task, add one, or drop one. The comment at the top of that file explains
every option. After editing, bump `CACHE` in `sw.js` so installed phones pick the
change up.

## Files

| File | What it is |
| --- | --- |
| `index.html` | Page shell |
| `js/template.js` | The checklist itself — edit this to change tasks |
| `js/app.js` | State, rendering, timestamps, report, history |
| `css/styles.css` | Styling, iOS design language, print layout |
| `sw.js` | Offline cache and reminder notifications |
| `js/push.js` | Reminder switch and sync (off unless configured) |
| `js/config.js` | Reminder server address (empty by default) |
| `server/` | Optional reminder server and its tests |
| `manifest.webmanifest` | Home-screen install metadata |

No build step, no dependencies, no framework.
