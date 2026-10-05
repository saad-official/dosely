# Dosely

Free medication reminders you can act on, with a caregiver circle. Dosely schedules a time-sensitive notification for every dose with Taken / Snooze / Skip actions, keeps the dose window on the Lock Screen (Live Activity on iOS, Live Update on Android 16), shows the next dose in widgets, counts down refills, and, if you want, tells the people in your caregiver circle when a dose stays unmarked. Local-first: medication data stays in an encrypted SQLite database on the phone unless you create a circle. No subscription, no ads, no medication cap. Seasonal themes come with matching app icons.

**Why it exists.** Medisafe moved to a mandatory subscription on 1 January 2026, with the free tier capped at two medications.
Roughly half of people with chronic conditions do not take long-term medication as prescribed (WHO), and reminders should not be the paywalled part.

Landing site: [getdosely.vercel.app](https://getdosely.vercel.app). Product and technical spec: [`docs/spec.md`](docs/spec.md).

## Monorepo layout

```
apps/mobile       Expo SDK 57 app (expo-router, SQLCipher SQLite, notifications, Live Activity / Live Update, widgets, themes)
apps/web          Next.js 16: marketing site + API (Better Auth with Expo plugin, caregiver circles, sync, escalation push, cron)
packages/shared   Pure TypeScript: schedules, DST, dose windows, adherence, inventory, seasons, zod schemas, design tokens + themes
docs/             Spec and device testing guides
```

pnpm 12 workspace with a hoisted `node_modules` (Metro needs it; see `.npmrc`). Node 24 (`.nvmrc`).

## Run it

```bash
pnpm install                 # from the repo root

# Web: landing site + API on http://localhost:3700
pnpm web                     # same as: pnpm --filter web dev
```

The web app needs no setup locally: without `DATABASE_URL` it runs an embedded Postgres (PGlite) in `apps/web/.pglite/`, migrated on first use, with a public development auth secret. Copy `apps/web/.env.example` to `apps/web/.env.local` to use Neon or real secrets; `bash apps/web/scripts/setup-env.sh` (Git Bash) pushes production secrets to Vercel and runs migrations. API reference: [`apps/web/README.md`](apps/web/README.md).

```bash
# Mobile: development build (Expo Go cannot load the native modules)
cd apps/mobile
npx expo run:android --device   # Android phone over USB
npx expo start                  # Metro for an installed dev build
```

Install Expo libraries with `npx expo install <pkg>` inside `apps/mobile`, never `pnpm add`.

## Checks

```bash
pnpm lint                            # every workspace
pnpm --filter web exec next typegen  # route types for the web typecheck
pnpm typecheck
pnpm test                            # Vitest: shared domain, tokens/themes, web API against in-memory PGlite
pnpm build:web                       # next build
```

CI (`.github/workflows/ci.yml`) runs the same steps on every push to `main` and every pull request.

## Testing on a device

**Android over USB.** Turn on Developer options and USB debugging, plug the phone in, accept the RSA prompt and check that `adb devices` lists it. Then `cd apps/mobile && npx expo run:android --device`. Live Updates need Android 16; earlier versions still get actionable notifications and widgets. To reach the local API from the phone, run `adb reverse tcp:3700 tcp:3700` so `http://localhost:3700` on the phone resolves to your computer. Guides: [Expo: run on a device](https://docs.expo.dev/get-started/set-up-your-environment/?platform=android&device=physical&mode=development-build), [Android: run apps on a hardware device](https://developer.android.com/studio/run/device).

**iPhone (on a Mac).** Live Activities, the Dynamic Island, time-sensitive notifications, alternate app icons and iOS widgets need Xcode and a real device or simulator: see [`docs/testing-on-mac.md`](docs/testing-on-mac.md) and [Expo: iOS development build](https://docs.expo.dev/get-started/set-up-your-environment/?platform=ios&device=physical&mode=development-build).

## Status (v0.1)

| Area | State |
| --- | --- |
| Shared domain (`packages/shared`): schedules, DST, windows, adherence, inventory, seasons, schemas | In progress (separate workstream) |
| Design tokens and seasonal themes (`packages/shared/src/tokens.ts`, `themes.ts`) | Done; AA contrast checked for every theme in both schemes |
| Web API: auth (Better Auth + Expo plugin), circles, caregiver today view, sync push/pull, escalation push, devices, daily cron sweep | Done, tested on PGlite |
| Marketing site: home, themes gallery, privacy, terms, support | Done |
| Mobile app: screens, notifications, Live Activity / Live Update, widgets, app icons | In progress |
| TestFlight and Google Play betas | Not started |
| Production deploy (Vercel + Neon) | Not started: run `apps/web/scripts/setup-env.sh` once the Neon database exists |
