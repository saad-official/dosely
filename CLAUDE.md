# Dosely — agent notes

Free medication reminders with a caregiver circle, seasonal themes and matching app icons. Read `docs/spec.md` before changing anything.

## Layout
- `apps/mobile` — Expo SDK 57 (React Native 0.86, New Architecture, expo-router, React Compiler). Routes in `src/app/` only; screens in `src/screens/`, components in `src/components/`, theme in `src/theme/`, data layer in `src/data/`, native adapters in `src/native/`, widgets/Live Activities in `src/widgets/`.
- `apps/web` — Next.js 16 landing site + API (Better Auth with Expo plugin, Drizzle + Neon/PGlite, Expo Push, caregiver circle + escalation push). Deployed to Vercel as getdosely.vercel.app with root directory `apps/web`.
- `packages/shared` — pure TypeScript domain + zod schemas + design tokens. No React Native, no Node built-ins. Vitest.

## Commands (Windows host)
Node 24 lives at `C:	ools
ode24` (Git Bash: `export PATH="/c/tools/node24:$PATH"`); Gradle cache at `C:gradle-home` (`export GRADLE_USER_HOME=/c/gradle-home`; G: is nearly full). pnpm 12: linker and allowBuilds settings live in `pnpm-workspace.yaml` (pnpm 12 ignores pnpm keys in `.npmrc`).
- Install: `pnpm install` (root). Mobile native libs: `cd apps/mobile && npx expo install <pkg>` — never `pnpm add` for Expo packages.
- Checks: `pnpm lint`, `pnpm typecheck`, `pnpm test` (root runs every workspace); `cd apps/mobile && npx expo-doctor && npx expo prebuild --clean --platform android`.
- Web dev server: `pnpm web` (port 3700). Mobile dev build on a USB Android device: `cd apps/mobile && npx expo run:android --device`.

## Rules
- Expo APIs change every SDK: read `https://docs.expo.dev/versions/v57.0.0/...` (not `latest`) or `https://docs.expo.dev/llms.txt` before using an API. Load the `expo-*` skills (`expo-overview` first) for Expo work.
- Screens import components; components import tokens from `@/theme` (which re-exports `@dosely/shared/tokens`). No hardcoded colours, spacing or font sizes outside the theme.
- Native libraries are only touched inside `src/native/*` and `src/widgets/*`. Everything else calls the adapters.
- Domain logic (schedule expansion, DST, dose windows, adherence, inventory, seasons) lives in `packages/shared` with tests written first.
- Commit small and often with conventional prefixes. Never commit secrets; `.env.local`, `google-services.json` and keys are ignored.
- Dosely is free: no purchases, no subscription code, no ads. Health data stays on the device unless the user joins a caregiver circle.
- Seasonal themes: token overrides in `packages/shared/src/seasons.ts` + `themes.ts`; icon switching only through `src/native/app-icon.ts` (expo-alternate-app-icons). Manual selection always beats the auto-by-date resolver.
