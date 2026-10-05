# Dosely web

Next.js 16 app: the marketing site (`app/(marketing)`) and the API the Expo app talks to (`app/api`). Port 3700.

```bash
pnpm dev            # http://localhost:3700, embedded PGlite in .pglite/ when DATABASE_URL is unset
pnpm test           # Vitest, API tests run against in-memory PGlite
pnpm db:generate    # after editing lib/db/schema.ts (then make CREATE SCHEMA idempotent: IF NOT EXISTS)
pnpm db:migrate     # applies drizzle/ to DATABASE_URL (use the direct, non-pooled URL) or to .pglite/
```

## Auth

Better Auth (`lib/auth/server.ts`) with email + password and the `@better-auth/expo` plugin. Cookies are prefixed `dosely.` and trusted origins include `dosely://` (plus `exp://` and any localhost port outside production). The Expo client sends `Cookie: dosely.session_token=...`; every route below except health and cron answers **401** without a valid session. Account deletion (`POST /api/auth/delete-user`) cascades to circles, mirrored data, escalations and devices.

## Routes

All bodies are JSON (`content-type: application/json`, validated with zod: 400 on mismatch, 415 on another content type). Errors are `{ error, code? }`.

| Route | What it does |
| --- | --- |
| `GET /api/health` | Liveness, no database. |
| `/api/auth/*` | Better Auth (sign-up/in/out, session, delete-user). |
| `POST /api/circles` | `{ profileName? }`. Creates the caller's circle (they become its `member`), 201 `{ circle }` with the 8-character invite code; 200 with the existing circle on repeat. |
| `GET /api/circles` | `{ circles }`: circles the caller owns or cares for, with members. Only the owner sees the invite code. |
| `POST /api/circles/join` | `{ code, profileName? }`, code case- and dash-insensitive. Joins as `caregiver`. 404 `circle_not_found`, 409 `own_circle` / `circle_full` (10 caregivers). Idempotent. |
| `DELETE /api/circles/:id` | Owner stops sharing: deletes the circle, memberships and every mirrored profile, medication, dose and escalation. 403 for caregivers. |
| `DELETE /api/circles/:id/members/:userId` | Owner removes a caregiver, or a caregiver leaves. 403 otherwise; 409 `owner_cannot_leave`. |
| `GET /api/circles/:id/today?tz=&date=` | Read-only caregiver view: each member's live doses due in that local day, grouped by profile, with state `upcoming / due / late / missed / taken / skipped`. 404 for anyone outside the circle. |
| `POST /api/sync/push` | `{ deviceId?, tables: { profiles, medications, doses } }`, last write wins by `max(updatedAt, deletedAt)`, soft deletes, rows a day in the future refused. 403 `no_circle` unless the caller owns a circle (health data leaves the phone only for a circle). |
| `GET /api/sync/pull?since=` | The caller's own rows changed after the cursor, tombstones included; `serverTime` is the next cursor. |
| `POST /api/escalations` | `{ doseIds, profileName, medNames, dueAt }` from the member's device. One push per caregiver device (time-sensitive, Android channel `caregiver-alerts`, deep link `dosely://circle/:id`), idempotent per dose; 502 `push_failed` rolls the escalation back so a retry can alert. |
| `POST /api/devices` | `{ token: ExponentPushToken[...], platform }`, upsert by token. |
| `DELETE /api/devices/:token` | Removes the caller's token. |
| `GET /api/cron/daily` | `Authorization: Bearer $CRON_SECRET` (Vercel Cron, 06:00 UTC). Keeps Neon warm and sweeps doses from the last 24 h still unmarked 30 min after their window with no escalation, alerting once per member profile. |

Wire schemas: `lib/sync/contract.ts`. Dose state rules: `lib/domain/dose-state.ts`. Database: `lib/db/schema.ts` (Postgres schema `dosely`).

## Design tokens

`@dosely/shared/tokens` is rendered into a `<style>` tag by `app/layout.tsx` (`lib/tokens-css.ts`): `:root` light, `.dark` and the system preference for dark, and `[data-scheme]` to force a scheme on one element. `app/globals.css` maps Tailwind names (`bg-surface`, `text-ink-2`, `bg-accent`, `text-accent-ink`, `rounded-md`, `text-headline`, ...) onto those variables.
