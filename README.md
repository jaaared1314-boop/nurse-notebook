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

**Times.** On chem sticks, **Log time** stamps the current time, as many times as
the shift needs.

**The 0600 restraint check.** Each restrained patient gets a *Q2 charting
verified* box that stays quiet most of the night and lights up as 0600
approaches, which is when you confirm the bedside nurse has finished their
documentation. The same cue sits on the 0700 CRRT charge.

**Situations.** On RRT handoffs and incident reports, **Add situation** gives you
another text box. Add as many as you need per room.

**(i) buttons** hold the detail that does not fit on one line — the Tele Tracker
menu path, what counts on the pull log, what to flag off the OR board.

**Day-aware.** The narc count only counts toward your progress on a Tuesday
night, and the I&O audit only on the first Tuesday night of the month. The rest
of the time they sit there greyed out and labelled, rather than vanishing.

A night shift spans two dates, so "Tuesday" means **the night that starts on
Tuesday and runs into Wednesday** — the shift keeps its Tuesday label after
midnight, and a Monday night that happens to end on Tuesday does not count.

**Coverage toggles.** In Settings, *No secretary* and *No aide* switch on the
extra work you absorb when you are short — the chart/sticker/consult/lab tasks,
and the chem stick, bath and restock section.

**Report.** The Report tab shows a plain-text version of the whole checklist with
timestamps, ticked and unticked alike. **Copy as text** puts it on the clipboard.
**Print / Save as PDF** opens the iOS print sheet — AirPrint it, or pinch out on
the preview to save a PDF you can attach. **End shift** files it under History and
clears the live checklist.

**History** keeps past shifts on the phone. Open one to read, copy, print, or
delete it.

## Privacy

Everything lives in this phone's local storage. There is no account, no server,
no analytics, and no network call of any kind after the page loads. Nothing you
type is visible to anyone else, including me.

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
| `sw.js` | Offline cache |
| `manifest.webmanifest` | Home-screen install metadata |

No build step, no dependencies, no framework.
