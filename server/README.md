# Reminder server

This small server sends a notification to your iPhone 15 minutes before each timed
check (for example, a chem stick at 21:00) and again when it is due, even with the
phone locked. It is optional. The app works fully offline without it.

## What it stores

- One push subscription per phone, created when you switch reminders on.
- That phone's open timed checks for tonight: the time, the room, and the check's name.
- Nothing else. No notes, no shift history, no patient names.

A check is removed about two hours after it is due. Switching reminders off, or
deleting the app, removes the phone entirely.

**Privacy.** Room numbers and check names pass through this server and through
Apple's push service to your phone. Confirm that your facility's policy allows
that before you turn reminders on. The rest of the checklist never leaves the phone.

## 1. Make keys (once)

On any computer with Node 18 or later, from this folder:

    npx web-push generate-vapid-keys

Keep the **private** key secret. The **public** key goes in the app and is not secret.

## 2. Host it

Any host that runs Node and gives you an HTTPS address will work (Render, Railway,
Fly.io, and similar). Point it at this `server/` folder:

- Build command: `npm install`
- Start command: `npm start`

Set these environment variables:

| Name | Value |
| --- | --- |
| `VAPID_PUBLIC` | the public key |
| `VAPID_PRIVATE` | the private key |
| `VAPID_SUBJECT` | `mailto:` plus an address you check |
| `ALLOWED_ORIGIN` | `https://jaaared1314-boop.github.io` |
| `DATA_FILE` | a path on persistent storage, if your host offers it, such as `/data/store.json` |

If the host has no persistent storage, leave `DATA_FILE` unset. A restart then clears
the stored checks, and the app puts them back the next time you change anything in the
shift.

## 3. Connect the app

In `js/config.js` in the main folder, fill in:

    window.CNC_PUSH = {
      server: 'https://your-host-address',
      vapidPublicKey: 'the public key',
    };

Commit and push. The app's Home Screen copy updates the next time you open it with signal.

## 4. Turn it on (iPhone)

Requires iOS 16.4 or later. Reminders only work for the app opened from the Home
Screen, not from Safari. If you added the app before this update, delete the Home Screen
icon and add it again.

1. Open **Charge** from the Home Screen, then go to Settings.
2. Under Reminders, turn on **Timed checks**.
3. Tap Allow when iOS asks.

## Testing

    npm test

These tests run the server against fake timings and a fake push sender. They cover
when alerts go out, that none repeat, that moved checks are re-alerted, and that a
phone that unsubscribes stops receiving them. They do not reach Apple's push service,
so the first real test is to turn reminders on and wait for a chem stick.
