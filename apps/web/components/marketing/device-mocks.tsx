import type { CSSProperties, ReactNode } from "react";
import { CapsuleMark } from "./logo";

/**
 * Product illustrations built from tokens (no screenshots). Every mock is
 * aria-hidden; the <figure> around it carries a text description instead.
 */

type DoseRow = { name: string; detail: string; time: string; state: "taken" | "due" | "later" };

const MORNING: DoseRow[] = [
  { name: "Metformin 500 mg", detail: "1 tablet with breakfast", time: "8:00 AM", state: "taken" },
  { name: "Lisinopril 10 mg", detail: "1 tablet", time: "8:30 AM", state: "due" },
];
const EVENING: DoseRow[] = [
  { name: "Metformin 500 mg", detail: "1 tablet with dinner", time: "6:00 PM", state: "later" },
  { name: "Atorvastatin 20 mg", detail: "1 tablet at bedtime", time: "9:30 PM", state: "later" },
];

function StatePill({ row }: { row: DoseRow }) {
  if (row.state === "taken") {
    return <span className="rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">Taken 8:02</span>;
  }
  if (row.state === "due") {
    return <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-on-accent">Due now</span>;
  }
  return <span className="text-[11px] font-medium text-ink-2 tabular">{row.time}</span>;
}

function Row({ row }: { row: DoseRow }) {
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <span
        className={`size-2.5 shrink-0 rounded-full ${row.state === "taken" ? "bg-success" : row.state === "due" ? "bg-accent" : "bg-edge"}`}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold leading-5 text-ink">{row.name}</span>
        <span className="block truncate text-[11px] leading-4 text-ink-2">{row.detail}</span>
      </span>
      <StatePill row={row} />
    </li>
  );
}

/** A phone bezel. The bezel layer is forced dark; the screen follows the page scheme. */
export function PhoneFrame({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative w-[300px] p-[10px] ${className}`}>
      <div data-scheme="dark" className="absolute inset-0 rounded-[52px] bg-sunken shadow-lg ring-1 ring-edge" />
      <div className="relative h-[600px] overflow-hidden rounded-[42px] bg-surface">
        <div data-scheme="dark" className="absolute top-2.5 left-1/2 z-10 h-7 w-24 -translate-x-1/2 rounded-full bg-sunken" />
        {children}
      </div>
    </div>
  );
}

/** The Today screen: profile switcher, progress ring, morning and evening doses. */
export function TodayScreen() {
  const taken = 1;
  const total = 4;
  const ring = { "--p": `${(taken / total) * 100}%` } as CSSProperties;
  return (
    <div className="flex h-full flex-col px-4 pt-12 pb-4">
      <div className="flex items-center justify-between px-2 text-[12px] font-semibold text-ink">
        <time className="tabular">8:31</time>
        <span className="flex items-end gap-0.5" aria-hidden>
          {[4, 6, 8, 10].map((h) => (
            <span key={h} className="w-[3px] rounded-sm bg-ink" style={{ height: h }} />
          ))}
        </span>
      </div>
      <div className="mt-4 flex gap-1.5 px-1">
        <span className="rounded-full px-3 py-1 text-[12px] font-medium text-ink-2 ring-1 ring-edge">Me</span>
        <span className="rounded-full bg-ink px-3 py-1 text-[12px] font-semibold text-surface">Mum</span>
      </div>
      <div className="mt-3 px-1">
        <p className="text-[26px] leading-8 font-semibold tracking-tight text-ink">Today</p>
        <p className="text-[12px] text-ink-2">Monday, October 5</p>
      </div>
      <div className="mt-3 flex items-center gap-3 rounded-md bg-elevated p-3 shadow-sm ring-1 ring-line">
        <span
          className="grid size-12 shrink-0 place-items-center rounded-full"
          style={{ ...ring, background: "conic-gradient(var(--do-color-accent) var(--p), var(--do-color-surface-sunken) 0)" }}
        >
          <span className="grid size-9 place-items-center rounded-full bg-elevated text-[12px] font-semibold text-ink tabular">
            {taken}/{total}
          </span>
        </span>
        <span>
          <span className="block text-[13px] font-semibold text-ink">1 of 4 taken</span>
          <span className="block text-[11px] text-ink-2">Lisinopril is due now</span>
        </span>
      </div>
      <p className="mt-4 px-1 text-[11px] font-semibold text-ink-2">Morning</p>
      <ul className="mt-1 divide-y divide-line rounded-md bg-elevated ring-1 ring-line">
        {MORNING.map((row) => (
          <Row key={row.name + row.time} row={row} />
        ))}
      </ul>
      <p className="mt-4 px-1 text-[11px] font-semibold text-ink-2">Evening</p>
      <ul className="mt-1 divide-y divide-line rounded-md bg-elevated ring-1 ring-line">
        {EVENING.map((row) => (
          <Row key={row.name + row.time} row={row} />
        ))}
      </ul>
      <div className="mt-auto flex justify-around border-t border-line pt-3 text-[10px] font-medium text-ink-2">
        <span className="text-accent-ink">Today</span>
        <span>Meds</span>
        <span>History</span>
        <span>Circle</span>
        <span>Settings</span>
      </div>
    </div>
  );
}

/** The dose-window Live Activity as it sits on the Lock Screen: always dark, like iOS. */
export function LiveActivityStrip({ className = "" }: { className?: string }) {
  return (
    <div data-scheme="dark" className={`w-full max-w-[340px] rounded-lg bg-elevated/90 p-4 text-ink shadow-lg ring-1 ring-edge backdrop-blur ${className}`}>
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-on-accent">
          <CapsuleMark className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] text-ink-2">Mum, morning dose</span>
          <span className="block text-[17px] leading-6 font-semibold">Lisinopril 10 mg</span>
        </span>
        <span className="text-right">
          <span className="block text-[22px] leading-7 font-semibold tabular">59 min</span>
          <span className="block text-[11px] text-ink-2">left in window</span>
        </span>
      </div>
      <div className="window-bar mt-3 h-1.5 rounded-full" style={{ "--remaining": "98%" } as CSSProperties} />
      <div className="mt-3 grid grid-cols-2 gap-2 text-[15px] font-semibold">
        <span className="rounded-full bg-accent py-2 text-center text-on-accent">Taken</span>
        <span className="rounded-full bg-sunken py-2 text-center text-ink ring-1 ring-edge">Snooze 10 min</span>
      </div>
    </div>
  );
}

/** A notification banner with its action buttons expanded. */
export function NotificationMock() {
  return (
    <div className="w-full max-w-[320px] rounded-md bg-elevated p-3 shadow-md ring-1 ring-line">
      <div className="flex items-center gap-2 text-[11px] text-ink-2">
        <span className="grid size-5 place-items-center rounded-[6px] bg-accent text-on-accent">
          <CapsuleMark className="size-3.5" />
        </span>
        <span className="font-semibold">Dosely</span>
        <span className="ml-auto">now</span>
      </div>
      <p className="mt-1.5 text-[14px] font-semibold text-ink">Time for Metformin 500 mg</p>
      <p className="text-[13px] text-ink-2">1 tablet with breakfast</p>
      <div className="mt-2 grid grid-cols-3 divide-x divide-line overflow-hidden rounded-sm bg-sunken text-center text-[12px] font-semibold">
        <span className="py-2 text-accent-ink">Taken</span>
        <span className="py-2 text-ink">Snooze 10</span>
        <span className="py-2 text-ink-2">Skip</span>
      </div>
    </div>
  );
}

/** Dynamic Island, compact: the window countdown. */
export function IslandMock() {
  return (
    <div data-scheme="dark" className="flex h-9 w-[220px] items-center justify-between rounded-full bg-sunken px-3 text-ink ring-1 ring-edge">
      <span className="text-accent-ink">
        <CapsuleMark className="size-5" />
      </span>
      <span className="text-[13px] font-semibold tabular">
        42 min left
      </span>
    </div>
  );
}

/** Home Screen widget, small: next dose + today's progress. */
export function WidgetMock() {
  const ring = { "--p": "50%" } as CSSProperties;
  return (
    <div className="grid size-[152px] content-between rounded-[28px] bg-elevated p-4 shadow-md ring-1 ring-line">
      <span
        className="grid size-11 place-items-center rounded-full"
        style={{ ...ring, background: "conic-gradient(var(--do-color-accent) var(--p), var(--do-color-surface-sunken) 0)" }}
      >
        <span className="grid size-8 place-items-center rounded-full bg-elevated text-[11px] font-semibold text-ink tabular">2/4</span>
      </span>
      <span>
        <span className="block text-[11px] text-ink-2">Next</span>
        <span className="block text-[14px] leading-5 font-semibold text-ink">Metformin</span>
        <time className="block text-[12px] text-accent-ink">6:00 PM</time>
      </span>
    </div>
  );
}

/** Refill tracking: tablets left and the refill reminder. */
export function RefillMock() {
  return (
    <div className="w-full max-w-[300px] rounded-md bg-elevated p-4 shadow-md ring-1 ring-line">
      <p className="text-[14px] font-semibold text-ink">Atorvastatin 20 mg</p>
      <p className="mt-0.5 text-[12px] text-ink-2 tabular">6 tablets left</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-sunken">
        <div className="h-full w-[20%] rounded-full bg-warning" />
      </div>
      <p className="mt-3 rounded-sm bg-warning-soft px-3 py-2 text-[12px] font-semibold text-warning">Refill in 6 days</p>
    </div>
  );
}

/** What a caregiver's phone shows when a dose goes unmarked (same copy as the real push). */
export function CaregiverAlertMock() {
  return (
    <div data-scheme="dark" className="w-full max-w-[340px] rounded-lg bg-elevated/95 p-4 text-ink shadow-lg ring-1 ring-edge">
      <div className="flex items-center gap-2 text-[12px] text-ink-2">
        <span className="grid size-5 place-items-center rounded-[6px] bg-accent text-on-accent">
          <CapsuleMark className="size-3.5" />
        </span>
        <span className="font-semibold">Dosely</span>
        <span className="ml-auto">10:00 AM</span>
      </div>
      <p className="mt-2 text-[15px] font-semibold">Mum hasn&apos;t marked a dose</p>
      <p className="mt-0.5 text-[14px] text-ink-2">Lisinopril 10 mg was due 90 min ago. You may want to check in.</p>
    </div>
  );
}
