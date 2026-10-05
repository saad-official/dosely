/** Caregiver escalation: which missed doses to report and the push text caregivers see. */
import type { Dose } from "./schemas";
import type { IsoString } from "./tz";
import { doseState, escalationDueAt } from "./window";

const MINUTE = 60_000;

/**
 * Scheduled, non-deleted doses that are `missed` at `now` and not yet in `alreadyNotified`, oldest
 * first. Doses that went missed more than `maxAgeMinutes` ago (default 24 h) are left out so an
 * offline device does not flood caregivers with stale alerts when it reconnects.
 */
export function missedDosesForEscalation(
  doses: readonly Dose[],
  now: IsoString,
  escalationMinutes: number,
  alreadyNotified: ReadonlySet<string>,
  maxAgeMinutes = 24 * 60,
): Dose[] {
  const t = Date.parse(now);
  return doses
    .filter(
      (d) =>
        d.source === "scheduled" &&
        !d.deletedAt &&
        !alreadyNotified.has(d.id) &&
        doseState(d, now, escalationMinutes) === "missed" &&
        t - Date.parse(escalationDueAt(d, escalationMinutes)) <= maxAgeMinutes * MINUTE,
    )
    .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
}

export interface EscalationGroup {
  profileId: string;
  dueAt: IsoString;
  doseIds: string[];
  medicationIds: string[];
}

/** One group (one push) per profile and due time, ordered by due time. */
export function groupEscalations(doses: readonly Dose[]): EscalationGroup[] {
  const groups = new Map<string, EscalationGroup>();
  const sorted = [...doses].sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
  for (const d of sorted) {
    const dueAt = new Date(Date.parse(d.dueAt)).toISOString();
    const key = `${d.profileId}|${dueAt}`;
    const g = groups.get(key) ?? { profileId: d.profileId, dueAt, doseIds: [], medicationIds: [] };
    g.doseIds.push(d.id);
    if (!g.medicationIds.includes(d.medicationId)) g.medicationIds.push(d.medicationId);
    groups.set(key, g);
  }
  return [...groups.values()];
}

const COPY = {
  en: {
    and: "and",
    more: (n: number) => `${n} more`,
    aDose: "a dose",
    line: (who: string, what: string, time: string) => `${who} hasn't marked ${what} as taken (due ${time}).`,
  },
  fr: {
    and: "et",
    more: (n: number) => `${n} autres`,
    aDose: "une dose",
    line: (who: string, what: string, time: string) => `${who} n'a pas indiqué avoir pris ${what} (prévu à ${time}).`,
  },
};

function joinList(items: string[], and: string): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} ${and} ${items[items.length - 1]}`;
}

/**
 * Short caregiver push text, e.g. "Mom hasn't marked Metformin and Lisinopril as taken (due 8:00 AM)."
 * English by default, French for `fr*` locales; the time is formatted for `locale` in `tz`.
 * More than three medications become "A, B and N more". Spaces are plain ASCII.
 */
export function caregiverMessage(
  profileName: string,
  medNames: readonly string[],
  dueAt: IsoString,
  tz = "UTC",
  locale = "en-US",
): string {
  const copy = locale.toLowerCase().startsWith("fr") ? COPY.fr : COPY.en;
  const names = medNames.length > 3 ? [...medNames.slice(0, 2), copy.more(medNames.length - 2)] : [...medNames];
  const what = names.length ? joinList(names, copy.and) : copy.aDose;
  const time = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone: tz })
    .format(new Date(Date.parse(dueAt)))
    .replace(/[  ]/g, " ");
  return copy.line(profileName, what, time);
}
