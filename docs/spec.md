# Dosely — product and technical spec (draft for batch 4, app 11)

Date: 2026-10-05. Copied into the `dosely` repo as `docs/spec.md` when that repo is scaffolded.

## 1. Problem and users

People on recurring medication, and the family members who look after them, need reminders they can act on from the notification itself and a way for a trusted person to know when a dose is missed. Medisafe moved to a mandatory subscription on 1 Jan 2026 (free capped at 2 medications); reviews cite ads, crashes and paywalled basics. Roughly half of chronic patients do not adhere to long-term therapy.

**Dosely** is a free, local-first medication reminder with a caregiver circle: time-sensitive notifications with Taken / Snooze / Skip actions, a dose-window Live Activity (iOS) / Live Update (Android 16), widgets, refill tracking, and an escalation push to a caregiver when a dose stays unmarked.

## 2. Scope (v0.1)

- Profiles: self + dependents (name, colour, avatar initial).
- Medications: name, strength, form, instructions, colour/icon, schedule (fixed times per day; every N hours; specific weekdays; as-needed), dose window (default 60 min), inventory count + refill threshold.
- Notifications: local scheduled per dose, category `dose` with Taken / Snooze 10 / Skip; time-sensitive interruption on iOS; DST-safe (recomputed from local wall-clock each day); rolling 7-day window re-scheduled on launch, on change and by a daily background task.
- Dose window Live Activity / Live Update: starts at due time listing the meds due and the time left in the window with Taken / Snooze buttons; ends when all taken/skipped or the window closes.
- Widgets: next dose (name, time, countdown) + today's progress ring; iOS small/medium and Lock Screen circular/inline; Android 2×2.
- History: day/week adherence, per-med streak shown calmly (no confetti), weekly summary card; export CSV.
- Refills: inventory decremented per dose; "refill in N days" reminder.
- Caregiver circle: sign in (Better Auth) → create circle → share invite code → caregiver joins; backend pushes to caregivers when a dose is unmarked 30 min after its window; caregiver sees a read-only "today" view per member.
- Appearance: light/dark; **seasonal themes** (Default, New Year, Valentine's, St. Patrick's, Easter, Canada Day, Independence Day, Halloween, Thanksgiving CA/US, Holidays) selectable in Settings with an opt-in "switch automatically by date" toggle, each with a matching alternate app icon.
- Privacy: SQLite with SQLCipher (key in SecureStore); data leaves the device only for a circle; export/delete all data; privacy page on the site.
- No subscription, no ads.

Out of scope v0.1: pharmacy integrations, drug-interaction data, Apple Health, Watch, APNs push-to-update for Live Activities.

## 3. Architecture

Same monorepo shape as Punchcard: `apps/mobile` (Expo SDK 57), `apps/web` (Next.js 16 landing + API: Better Auth with Expo plugin, Drizzle + Neon, Expo Push, cron escalation), `packages/shared` (schedule expansion, DST handling, window logic, adherence stats, inventory maths, seasons resolver, zod schemas, tokens).

### Data (device SQLite, mirrored for circles)
`profiles`, `medications(profile_id, schedule_json, window_minutes, inventory_count, refill_threshold, …)`, `doses(id, medication_id, due_at, taken_at?, skipped_at?, snoozed_until?, source)`, `settings`, `circle_members` (remote only), `sync_state`.

### Domain (`packages/shared`)
- `schedule.ts`: `expandDoses(schedule, fromLocalDate, days, tz)` → due instants; handles every-N-hours anchors, weekday sets, DST transitions (wall-clock times stay fixed; every-N-hours uses elapsed time).
- `window.ts`: dose state machine (`upcoming → due → late → missed | taken | skipped`), snooze rules, escalation rule (missed = unmarked 30 min after window end).
- `adherence.ts`: daily/weekly rates, streaks, per-med summaries.
- `inventory.ts`: decrement, days-left, refill-date.
- `seasons.ts`: `resolveSeason(date, region: 'US'|'CA'|'both')` with fixed and computed dates (Easter via Meeus, Thanksgiving CA 2nd Monday Oct / US 4th Thursday Nov) and theme windows (e.g., Holidays 1–31 Dec, Halloween 15–31 Oct).

### Mobile
Tabs: Today · Meds · History · Circle · Settings. Onboarding: 3 screens + notification priming. Design identity: calm clinical-soft (ink `#1C2430`, teal accent `#1FA39A`, soft surfaces `#F7F9F9` / `#101417`), large Dynamic Type-friendly text, soft glass cards, gentle motion. Seasonal themes override accent/surface tokens and add a subtle motif layer on Today; icons via `expo-dynamic-app-icon` (iOS alternate icons + Android activity-alias).

### Native surfaces
Live Activity `DoseWindow` (expo-widgets; Taken/Snooze `Button`s mirrored via `addUserInteractionListener`); Android Live Update (expo-live-updates) with progress = window remaining; widgets `NextDose`; notifications with `dose` category actions handled in a background response listener; `expo-background-task` daily reschedule; SQLCipher via `expo-sqlite` config plugin.

### Backend
Routes: `auth/[...all]`, `circle` (create/join/leave), `sync/push|pull` (doses + meds for circle members only), `devices`, `cron/daily` (keep-alive) and `cron/escalate` (every 15 min via pg_cron-less approach: Vercel cron is daily on Hobby, so escalation is triggered by the member device posting "dose missed" events when it detects them, with the server fan-out to caregivers; the daily cron sweeps stragglers).

## 4. Testing
Vitest on schedule/DST/window/adherence/inventory/seasons (TDD); API tests for circle auth rules and escalation fan-out; `expo-doctor`, prebuild; Android 16 device pass; Mac/iPhone pass per `docs/testing-on-mac.md`.
