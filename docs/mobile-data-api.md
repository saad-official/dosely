# Mobile data layer and native adapters: API for screens

Everything a screen needs from storage, the account API or the OS. Screens and components import
only from `@/data`, `@/hooks/use-*` and `@/native/*`; never from `expo-sqlite`, `drizzle-orm`,
`expo-notifications`, `expo-widgets`, `expo-live-updates`, `expo-alternate-app-icons`, etc.

Domain types (`Profile`, `Medication`, `Dose`, `Schedule`, `Settings`, `Appearance`, `ThemeId`,
`DoseState`, …) and pure maths (`resolveThemeColors`, `THEMES`, `MED_PALETTE`, `caregiverMessage`,
`daysLeft`, `asNeededRemaining`, `initialFor`, `timeLeftLabel`, …) come straight from `@dosely/shared`.
Formatting helpers that several surfaces share live there too, e.g. `timeLeftLabel(endsAt, now?)`
(`packages/shared/src/window.ts`: "35 min left", "1 h 05 min left", "2 h left", "ends now"), used by
the Today "due now" card and the Android Live Update; `initialFor(name)` (`profile.ts`) for avatars.

**Hooks vs plain functions.** Everything named `use*` is a React hook (call it only while rendering,
from `@/hooks/use-*`; `useDatabaseMigrations`, `useToday`, `useClockTick` and `useStore` come from
`@/data`). Everything else exported from `@/data` and `@/native/*` is a plain function (sync reads
or `async` actions) that is safe in event handlers, background tasks and headless code.

Conventions: ids are UUIDv7 strings (scheduled dose ids are deterministic: `doseIdFor(medId, dueAt)`);
timestamps are ISO-8601 UTC strings; local days are `YYYY-MM-DD` `DayKey`s in the device zone;
medication / profile `color` is a palette name (`'teal'`, `'violet'`, …) rendered via `MED_PALETTE`;
deletes are soft (`deletedAt`). The database is SQLCipher-encrypted (32-byte key in SecureStore).

## 1. Root layout wiring (once)

```tsx
// src/app/_layout.tsx
import { useEffect } from 'react';
import { router } from 'expo-router';
import { useDatabaseMigrations } from '@/data';
import { startNativeServices } from '@/native/surface-sync';

export default function RootLayout() {
  const db = useDatabaseMigrations();                    // { success, error? }
  useEffect(
    () => (db.success ? startNativeServices({ onOpenUrl: (url) => router.push(url) }) : undefined),
    [db.success],
  );
  if (db.error) return <DatabaseErrorScreen error={db.error} />;
  if (!db.success) return null;                          // keep the splash screen up
  return <Tabs />;
}
```

- `apps/mobile/index.ts` is the JS entry (`package.json` `main`). It imports `src/native/entry.ts`
  before `expo-router/entry`: background task definitions (`DOSELY_DAILY`, Android notification
  actions), the Android widget task handler and the notification / Live Activity action listener
  all live at module scope so headless launches work without rendering the layout. Do not move them.
- `startNativeServices({ onOpenUrl? })` (`@/native/surface-sync`): migrate → notification channels +
  `dose` category → register background tasks → expand 7 days of doses, reschedule reminders, sync
  Live Activity / Live Update / widgets, report missed doses → set the app icon for today's theme →
  (signed in) refresh circles, register the push token, sync. While mounted it re-checks the dose
  window every 30 s in the foreground, re-runs maintenance on every foreground and at local midnight,
  and forwards notification taps to `onOpenUrl` (incl. the tap that cold-launched the app).
  Returns a cleanup function.
- Data hooks return empty fallbacks (`[]`, `null`, `DEFAULT_SETTINGS`) until migrations finish.
- Deep links the app must route: **`dosely://today`** (reminders, dose window, widgets, Live
  Activity / Live Update tap) and **`dosely://circle/:id`** (caregiver alert push, Android channel
  `caregiver-alerts`). Expo Router resolves them to `src/app/today…` / `src/app/circle/[id]…`
  routes, so name the routes accordingly (or redirect in `+native-intent.tsx`).

## 2. Hooks (reactive reads)

`useSyncExternalStore`-based: re-render only when a table they read is written (or the 30 s clock /
local day changes for time-dependent ones). Results are referentially stable between changes.

| Hook | Returns | Example |
|---|---|---|
| `useProfiles()` (`@/hooks/use-profiles`) | `Profile[]`, self first | `const profiles = useProfiles();` |
| `useProfile(id)` / `useSelfProfile()` | `Profile \| null` | `const me = useSelfProfile();` |
| `useMedications(profileId?, { includeArchived? })` (`@/hooks/use-medications`) | `MedicationView[]` = `Medication & { perDay, daysLeft, refillDate, needsRefill, asNeededToday, asNeededRemaining }`; `asNeededToday` = as-needed doses logged today (0 for scheduled), `asNeededRemaining` = shared `asNeededRemaining` under `maxPerDay` (null when uncapped or scheduled); re-reads on dose writes | `const meds = useMedications(profile?.id); const atLimit = med.asNeededRemaining === 0;` |
| `useMedication(id)` | `MedicationView \| null` (archived/deleted included) | `const med = useMedication(params.id);` |
| `useTodayDoses(profileId?)` (`@/hooks/use-doses`) | `DoseView[]` = `Dose & { state, medication, profile }` for today, by due time; states tick every 30 s, rolls at midnight | `const doses = useTodayDoses();` |
| `useDosesForDay(dayKey, profileId?)` | `DoseView[]` for any local day | `const day = useDosesForDay('2026-10-04');` |
| `useDose(id)` | `DoseView \| null` | `const dose = useDose(params.id);` |
| `useActiveWindow()` (`@/hooks/use-active-window`) | `ActiveDoseWindow \| null` = shared `ActiveWindow` (`doseIds, earliestDueAt, latestWindowEndsAt, remaining, total`) + `doses: DoseView[]`; 30 s | `const win = useActiveWindow(); if (win) takeDoses(win.doseIds)` |
| `useSettings()` (`@/hooks/use-settings`) | `Settings` (`onboarded, theme, autoSeasonal, region, escalationMinutes, quietHours?, appearance`); `appearance` is `'system' \| 'light' \| 'dark'` (default `'system'`), applied by `AppThemeProvider` | `const { theme, appearance } = useSettings();` |
| `useEffectiveTheme()` (`@/hooks/use-effective-theme`) | `ThemeId` to render (shared `effectiveTheme`, re-evaluated at local midnight) | `const colors = resolveThemeColors(useEffectiveTheme(), scheme);` |
| `useAdherence(range, profileId?)` (`@/hooks/use-adherence`) | `AdherenceReport \| null`: `taken/skipped/missed/pending/total/rate`, `days: DaySummary[]`, `perMed: (MedSummary & { streak })[]`, `onTimeRate`, `bestDay`, `worstDay` | `const week = useAdherence(lastDays(7));` |
| `useSession()` (`@/hooks/use-session`) | Better Auth `{ data, isPending, error, refetch }` (`data` null when signed out) | `const { data: session } = useSession();` |
| `useCircle({ refreshOnMount? })` (`@/hooks/use-circle`) | `{ circles, own, loading, error, updatedAt, refresh(): Promise<void> }` (cached offline; `own` = circle the user shares with). Each `CircleView` has `ownerName` (the owner's account name) and `createdAt` | `const { own, circles } = useCircle(); circles[0]?.ownerName` |
| `useCircleToday(circleId)` | `{ data: CircleTodayView \| null, loading, refreshing, error, refresh(): Promise<void> }`, polled every 60 s. `loading` = no answer yet for this circle; `refreshing` = a `refresh()` is in flight; `refresh()` resolves when the request settles (never rejects; failures land in `error`, `data` keeps the last answer). `data` has `ownerName` and `createdAt` | `<RefreshControl refreshing={today.refreshing} onRefresh={() => void today.refresh()} />` |
| `useSyncStatus()` (`@/hooks/use-sync-status`) | `{ running, lastSyncAt, error }` | `const sync = useSyncStatus();` |
| `useNotificationPermission()` (`@/hooks/use-notification-permission`) | `{ status: 'granted'\|'denied'\|'undetermined', canAskAgain } \| null`, re-read on foreground | `const perm = useNotificationPermission();` |
| `useDatabaseMigrations()` (`@/data`) | `{ success, error? }` | see section 1 |
| `useToday()` / `useClockTick()` (`@/data`) | local `DayKey` (flips at midnight) / epoch ms floored to 30 s | `const today = useToday();` |

`lastDays(n)` (`@/hooks/use-adherence` or `@/data`) builds `{ from, to }` for the last `n` local days
ending today; any inclusive `{ from, to }` range up to 400 days works.

## 3. Actions (`@/data`, from `src/data/actions.ts`)

Each applies the shared state machine (`markTaken`, `markSkipped`, `snooze`, `undo`) and inventory
maths (`decrement` / `increment`), persists synchronously (hooks update at once), then refreshes
reminders, the Live Activity / Live Update and widgets, and schedules a circle sync. Await them in
headless code; in UI you can fire and forget.

| Action | Notes / example |
|---|---|
| `takeDose(id)` / `takeDoses(ids)` | taken (early/late/after skip ok), −1 inventory. `await takeDose(dose.id); haptics.taken();` |
| `skipDose(id)` / `skipDoses(ids)` | skipped; a previous take goes back to inventory. |
| `snoozeDose(id, minutes = 10)` / `snoozeDoses(ids, minutes)` | capped at window end + `escalationMinutes`; reminder re-fires at `snoozedUntil`. |
| `undoDose(id)` | clears taken/skipped/snooze (+1 inventory if it was taken); removes an as-needed log. |
| `logAsNeeded(medId)` | `{ ok: true, dose } \| { ok: false, reason: 'not-found' \| 'not-as-needed' \| 'daily-limit' }` (respects `maxPerDay`). |
| `addMedication(input: MedicationInput)` | validates (schedule via `ScheduleSchema`), expands doses, reschedules. `await addMedication({ profileId, name: 'Metformin', schedule: { kind: 'times', times: ['08:00', '20:00'] } })` |
| `updateMedication(id, patch)` | re-plans future unmarked doses (past and marked doses never change). |
| `setInventory(id, count \| null)` | refill / stop tracking. |
| `archiveMedication(id, archived = true)` / `deleteMedication(id)` | future unmarked doses removed; history kept. |
| `addProfile({ name, color?, initial?, isSelf? })` / `renameProfile(id, { name?, color?, initial? })` / `deleteProfile(id)` | `initial` defaults to shared `initialFor(name)` (a rename re-derives it), so callers pass only the name. Delete cascades to the dependent's medications. `ensureSelfProfile(name)` creates "self" at onboarding. |
| `updateSettings(patch)` | validated; theme / autoSeasonal / region changes switch the app icon and recolour widgets + Live Activity; `appearance` re-renders the theme provider (which calls `Appearance.setColorScheme`). `await updateSettings({ theme: 'halloween' })`, `updateSettings({ appearance: 'dark' })` |
| `syncAppIconWithTheme()` | re-apply today's effective icon (done for you at launch and midnight). |
| `deleteAllLocalData()` | cancels reminders, wipes every table, clears surfaces (the encryption key is kept). |
| `seedDemoData()` | **dev only** (throws outside `__DEV__`): self + "Mom", 4 meds (one due in ~5 min), 6 days of history. |

Reads without hooks (headless or one-off): `listProfiles`, `getProfile`, `getSelfProfile`,
`listMedications`, `getMedication`, `getDose`, `listDosesBetween`, `getSettings`, `dosesForDay`,
`doseView`, `medicationViews`, `activeDoseWindow`, `adherenceFor`, `ensureDosesExpanded(days = 7)`.

## 4. Account, circle and sync (`@/data`)

| Function | Notes |
|---|---|
| `signInAndSync({ email, password })` / `signUpAndSync({ name, email, password })` | Better Auth (`expoClient`, cookie in SecureStore, scheme `dosely`), then refresh circles + register push token + sync. Returns an error message or `null`. |
| `signOutAndForget()` | drops the push token, cached circles and sync cursors; local health data stays. |
| `deleteAccountEverywhere(password)` | server deletes account, circle, mirrored rows; then signs out locally. |
| `createCircle(profileName?)` | `POST /api/circles` → `CircleView` with `inviteCode` (owner only). Sharing starts syncing. |
| `joinCircle(code, profileName?)` | caregiver join; `ApiError` codes `circle_not_found` (404), `own_circle` / `circle_full` (409). |
| `refreshCircles()` / `getCircleToday(circleId)` | list (cached) / read-only caregiver today view. Both carry `ownerName` (Better Auth `user.name` of the owner, never guessed from `members`) and `createdAt`; circles cached by older builds may lack `ownerName`, so fall back to a generic label. |
| `deleteCircle(circleId)` / `leaveCircle(circleId, myUserId)` / `removeCircleMember(circleId, userId)` | owner stops sharing / caregiver leaves / owner removes. |
| `syncNow()` / `scheduleSync()` | push dirty rows then pull (only when signed in **and** owning a circle). Never throws; see `useSyncStatus()`. |
| `pushDirty()` / `pullSince()` | low level: shared `diffDirty` / `applyPull` against the per-table `sync_state` cursors. |
| `registerPushDevice({ prompt? })` | Expo push token → `POST /api/devices` (needs `extra.eas.projectId`, else `{ ok: false, reason: 'missing-project-id' }`). |

API base URL: `EXPO_PUBLIC_API_URL` (e.g. `http://192.168.1.20:3700` for a LAN dev server), default
`https://getdosely.vercel.app`. Errors are `ApiError { status, message, code? }` (status 0 = network).

## 5. Native adapters (`@/native/*`)

| Module | API | Example |
|---|---|---|
| `notifications` | `requestNotificationPermission()` (after the priming screen), `getNotificationPermission()`, `openNotificationSettings()`, `rescheduleAll()`, `reschedule(medId)`, `cancelAllDoseNotifications()`, `addNotificationOpenListener(url => …)`, `getPushRegistration()`; constants `CATEGORY_DOSE = 'dose'`, actions **`taken` / `snooze` / `skip`**, channels **`doses`** (high), **`caregiver-alerts`**, `doses-live` (silent dose-window status), `SNOOZE_MINUTES = 10` | `const p = await requestNotificationPermission(); if (p.status !== 'granted' && !p.canAskAgain) openNotificationSettings();` |
| `live-status` (`.ios` / `.android` / default) | `syncDoseWindow(window \| null)`, `addStatusActionListener(e => …)` where `e = { action: 'taken' \| 'snooze' \| 'skip' \| 'taken-all', doseIds?, source }`. iOS Live Activity `DoseWindow` buttons **`taken-all`** / **`snooze`**; Android 16 Live Update with window progress and `deepLinkUrl: 'dosely://today'`; ongoing notification below Android 16. Actions are already applied by `native/entry.ts`; listen only for UI feedback. | `useEffect(() => addStatusActionListener(() => haptics.taken()), []);` |
| `widgets` | `refreshWidgets(snapshot)`, `refreshWidgetsFromDatabase()`; iOS `NextDoseWidget` (systemSmall, systemMedium, accessoryCircular, accessoryInline, timeline entries at each window open/close), Android `NextDoseWidget` 2×2 | called by actions; manual: `await refreshWidgetsFromDatabase();` |
| `app-icon` | `applyAppIcon(themeId)` → `{ changed }`, `supportsAlternateIcons()`, `currentAppIcon()`, `alternateIconName(themeId)` (`icon-new-year` → `IconNewYear`; `default` = primary icon) | `if (supportsAlternateIcons()) await applyAppIcon('holidays');` (prefer `updateSettings`) |
| `haptics` | `haptics.taken() / skipped() / snoozed() / undone() / selection() / warning() / error()` | `haptics.selection();` |
| `exports` | `shareHistoryCsv({ profileId? })` → `{ ok, uri, rows } \| { ok: false, reason }`, `buildHistoryCsv()` (shared `exportRows` + `toCsv`) | `const r = await shareHistoryCsv();` |
| `escalation` | `reportMissedDoses()` → `{ reported, skipped?, error? }` (shared `missedDosesForEscalation` + `escalations_sent`, `POST /api/escalations` when signed in and sharing) | automatic (background, foreground, 30 s) |
| `background` | `DAILY_TASK = 'DOSELY_DAILY'` (expand + reschedule + widgets + escalation report), `triggerDailyTaskForTesting()` (debug builds) | `await triggerDailyTaskForTesting();` |
| `surface-sync` | `startNativeServices(opts)`, `initializeNativeServices()`, `syncNativeSurfaces()`, `runMaintenance()` | section 1 |

## 6. Storage notes (for reviewers)

- Tables: `profiles`, `medications` (`schedule_json` validated by `ScheduleSchema`), `doses`,
  `settings` (JSON values: one row per shared `Settings` key, incl. `appearance`; `app.*` keys are
  device-local and cleared on sign-out: circle cache, push token, device id, last sync. The old
  `app.appearance` key is no longer read), `sync_state(table_name, pushed_up_to, pulled_at, updated_at)`,
  `escalations_sent(dose_id, notified_at)`. Schema: `src/data/schema.ts`; migrations in
  `apps/mobile/drizzle/` (`pnpm --filter mobile db:generate` after a schema edit; `.sql` files are
  inlined by babel-plugin-inline-import).
- `ensureDosesExpanded(days = 7)` inserts scheduled doses with insert-or-ignore by deterministic id,
  so re-running never loses a mark; future unmarked doses a schedule no longer produces are
  soft-deleted (the deletion syncs).
- An unreadable database (backup restored without its key) is renamed aside, never deleted.
- Alternate icons: `pnpm --filter mobile icons` regenerates the placeholder PNGs in
  `assets/icons/` from the shared theme accents; app.json registers them with
  `expo-alternate-app-icons`.

## 7. Known gaps

- **Quiet hours.** `Settings.quietHours` exists in the schema and Settings shows it, but nothing
  writes it and reminders ignore it; the screen points people to Focus / Do Not Disturb for now.
- **Clipboard.** There is no `expo-clipboard` dependency: the invite code is `selectable` text plus
  the share sheet, with no one-tap "Copy" button.
- **Binary export.** History export is CSV text only (`shareHistoryCsv`); there is no PDF report or
  full backup / restore file.
- **APNs push-to-update.** The iOS Live Activity is started and updated only by the app (foreground,
  notification actions, background task); the server never sends ActivityKit push updates, so a
  Live Activity can lag until the app next runs (out of scope for v0.1 per `docs/spec.md`).
