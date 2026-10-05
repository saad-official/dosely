# Testing Dosely on a Mac (iOS)

The iOS-only surfaces (dose-window Live Activity, Dynamic Island, home / Lock Screen widgets,
time-sensitive notification actions, alternate app icons) cannot be built on the Windows dev box.
This is the owner's checklist for a Mac with Xcode and an iPhone.

## What needs a paid Apple Developer account

| Feature | Free Apple ID (personal team) | Paid program ($99/yr) |
|---|---|---|
| App on your own iPhone via Xcode (7-day profile) | yes | yes |
| Local reminders with Taken / Snooze 10 min / Skip | yes | yes |
| Time-sensitive delivery (`com.apple.developer.usernotifications.time-sensitive`) | **no**: remove the entitlement from `app.json` `ios.entitlements` to build | yes |
| Live Activity / Dynamic Island (`DoseWindow`) | yes | yes |
| Home / Lock Screen widget (`ExpoWidgetsTarget`, App Group `group.com.saadofficial.dosely`) | **no**: App Groups need a paid team | yes |
| Alternate app icons (seasonal themes) | yes | yes |
| Caregiver push (Expo push token, `dosely://circle/:id`) | no | yes |
| `eas build -p ios` (any profile), TestFlight | no | yes |

With a free team, temporarily remove the `expo-widgets` plugin entry and the time-sensitive
entitlement from `apps/mobile/app.json` to try everything else (the Live Activity also lives in
the widget extension, so it goes with it).

## One-time setup

1. Xcode 26+ from the App Store, then `xcode-select --install` and open Xcode once to install
   components. iPhone on iOS 17+ (Live Activities need 16.2+), with **Developer Mode** on
   (Settings → Privacy & Security).
2. Node 24 and pnpm 12: `brew install node@24 && corepack enable && corepack prepare pnpm@12.8.1 --activate`.
3. CocoaPods: `brew install cocoapods`.
4. In Xcode → Settings → Accounts, sign in with the Apple ID / team you will sign with. Add your
   Team ID to `apps/mobile/app.json` as `"ios": { "appleTeamId": "XXXXXXXXXX", ... }` (the widget
   extension target is signed with it).

## Build and run on the device

```sh
git clone <dosely repo url> dosely
cd dosely
pnpm install
cd apps/mobile
echo "EXPO_PUBLIC_API_URL=https://getdosely.vercel.app" > .env.local   # or http://<mac-ip>:3700 for a local API
npx expo prebuild --platform ios                 # generates ios/ with ExpoWidgetsTarget, SQLCipher, alternate icons
npx expo run:ios --device                        # pick the iPhone; first build ~10 min
```

If signing fails, open `ios/Dosely.xcworkspace`, select both the `Dosely` and `ExpoWidgetsTarget`
targets → Signing & Capabilities → choose your team (keep "Automatically manage signing"), then
re-run `npx expo run:ios --device`. On first launch trust the developer profile on the phone
(Settings → General → VPN & Device Management).

After that, JS changes hot-reload from `npx expo start`; re-run `expo run:ios` only after native
changes (new native package or `app.json` plugin changes). Widget and Live Activity layouts are
sent from JS at runtime, so editing their TSX usually needs no rebuild.

### Alternative: EAS cloud build (paid account)

```sh
npx eas-cli@latest login
npx eas-cli@latest init                          # writes extra.eas.projectId (needed for push tokens)
npx eas-cli@latest device:create                 # register the iPhone (ad hoc)
npx eas-cli@latest build -p ios --profile development
```

Install from the QR code / link EAS prints, then `npx expo start`. EAS asks to create the App
Group and the widget extension's bundle id (`com.saadofficial.dosely.widgets`) on first build;
accept. `--profile preview` makes a standalone internal build.

## Test script

Seed data first: from a dev screen or the JS console call `seedDemoData()` (from `@/data`). It
creates "Sam" (self) and "Mom", four medications, six days of history, and a Vitamin D dose due
about 5 minutes later.

### Reminders and notification actions
1. Allow notifications at the priming prompt.
2. Lock the phone and wait for the Vitamin D reminder ("Time for Vitamin D"). It should break
   through a Focus that allows time-sensitive notifications (paid team).
3. Long-press it: **Taken**, **Snooze 10 min**, **Skip**. Taken marks the dose (Today shows it,
   inventory unchanged for untracked meds); Snooze re-delivers "Reminder: …" 10 minutes later;
   Skip marks it skipped. Repeat with the app killed: the action still applies (it is handled at
   JS entry, not by a screen).
4. Two meds at the same minute arrive as one notification ("2 medications due") and Taken marks both.
5. Tap the notification body: the app opens on `dosely://today`.

### Live Activity and Dynamic Island
1. Settings → Dosely → Live Activities must be on.
2. With the app in the foreground when a dose becomes due (or open it during the window), the
   `DoseWindow` activity starts: med names, "due 8:00 PM · 42:10 left" (native countdown), and
   **Taken all** / **Snooze 10 min** buttons. On a Dynamic Island phone, go home: compact view
   shows the pill icon + countdown; long-press for the expanded view.
3. Tap **Taken all** on the Lock Screen: every open dose in the window is marked and the activity
   ends. **Snooze** snoozes them all (the reminder comes back in 10 minutes).
4. Kill the app during a window and relaunch: the same activity is adopted (no duplicate).
5. Let a window run out unmarked: the activity turns stale at window end (stale date) and is ended
   the next time the app or the daily background task runs; if you share a circle, the caregiver
   is pushed once the dose is 30 minutes past its window (next foreground / background run).

### Widgets (paid team)
1. Long-press the home screen → + → Dosely → add **Next dose** small and medium; on the Lock Screen
   (Customize → Lock Screen → widgets) add the circular ring and the inline line.
2. They show the next dose name, due time and relative countdown, plus today's taken/total ring.
3. Mark a dose taken in the app: the widgets update within a few seconds. With the app closed, the
   widget moves to the following dose on its own when a window closes (timeline entries).
4. Tapping a widget opens `dosely://today`.

### Seasonal themes and alternate icons
1. Settings → Appearance: pick **Halloween**. iOS shows the "You have changed the icon" alert and
   the home-screen icon turns orange; widgets and the Live Activity recolour.
2. Pick **Dosely** (default): the primary icon returns.
3. Turn on "switch automatically by date" with the device date inside a season window (e.g.
   15–31 Oct): the icon follows the season; it changes at local midnight when the app runs.

### Caregiver circle (paid team for push)
1. Sign up on the phone, create a circle, note the invite code.
2. On a second device (or the Android app), sign up and join with the code as caregiver.
3. Leave a seeded dose unmarked past its window + 30 minutes on the first phone, then bring the app
   to the foreground: the caregiver receives "Sam hasn't marked … as taken" on channel
   `caregiver-alerts`; tapping opens `dosely://circle/<id>` with the read-only today view.

## Troubleshooting

- **Widget shows "Unable to load"**: open the app once (the first snapshot is pushed on launch);
  check the App Group exists on both targets.
- **No Live Activity**: Settings → Dosely → Live Activities; the activity can only *start* while the
  app is in the foreground (no push-to-start in v0.1); Low Power Mode delays updates.
- **Notification actions do nothing**: rebuild after adding `expo-notifications`; the `dose`
  category is registered at launch (`setupNotifications`).
- **App starts empty after restoring a backup**: the database key lives in the Keychain with
  `AFTER_FIRST_UNLOCK`; a backup restored to a different device without the key leaves the old
  database renamed `dosely.db.unreadable-<date>` next to a fresh one.
- **`pod install` errors after pulling**: `cd apps/mobile && npx expo prebuild --platform ios --clean`.
