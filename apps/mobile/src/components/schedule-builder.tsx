import { localTime, zonedInstant, type Schedule } from '@dosely/shared';
import { View } from 'react-native';

import { deviceTimeZone, todayKey } from '@/data';
import { formatHhmm, weekdayShort, WEEKDAYS } from '@/constants/format';
import { icons } from '@/constants/icons';
import { spacing } from '@/theme';

import { AppText } from './app-text';
import { ChoiceChips, Field, Stepper, TimeField } from './form-fields';
import { IconButton } from './icon-button';
import { PrimaryButton } from './primary-button';

export type ScheduleKind = 'times' | 'interval' | 'weekdays' | 'as-needed';

export type ScheduleDraft = {
  kind: ScheduleKind;
  /** `HH:mm` for daily and weekday schedules. */
  times: string[];
  /** 0 = Sunday … 6 = Saturday. */
  days: number[];
  everyHours: number;
  /** First dose of an interval schedule, local `HH:mm`. */
  anchorTime: string;
  /** The stored anchor, kept when the first-dose time is unchanged. */
  anchorIso: string | null;
  /** 0 = no limit. */
  maxPerDay: number;
};

const MAX_TIMES = 12;

export function draftFromSchedule(schedule?: Schedule | null): ScheduleDraft {
  const base: ScheduleDraft = {
    kind: 'times',
    times: ['08:00'],
    days: [1, 3, 5],
    everyHours: 8,
    anchorTime: '08:00',
    anchorIso: null,
    maxPerDay: 0,
  };
  if (!schedule) return base;
  switch (schedule.kind) {
    case 'times':
      return schedule.days && schedule.days.length < 7
        ? { ...base, kind: 'weekdays', times: [...schedule.times].sort(), days: [...schedule.days].sort() }
        : { ...base, kind: 'times', times: [...schedule.times].sort() };
    case 'interval':
      return {
        ...base,
        kind: 'interval',
        everyHours: schedule.everyHours,
        anchorTime: localTime(schedule.anchor, deviceTimeZone()),
        anchorIso: schedule.anchor,
      };
    case 'as-needed':
      return { ...base, kind: 'as-needed', maxPerDay: schedule.maxPerDay ?? 0 };
  }
}

/** Draft → shared `Schedule` (validated later by `ScheduleSchema` in `addMedication`). */
export function scheduleFromDraft(draft: ScheduleDraft): Schedule {
  const times = [...new Set(draft.times)].sort();
  switch (draft.kind) {
    case 'times':
      return { kind: 'times', times };
    case 'weekdays':
      return { kind: 'times', times, days: [...new Set(draft.days)].sort() };
    case 'interval': {
      const tz = deviceTimeZone();
      const keep = draft.anchorIso && localTime(draft.anchorIso, tz) === draft.anchorTime;
      const anchor = keep ? draft.anchorIso! : new Date(zonedInstant(todayKey(tz), draft.anchorTime, tz)).toISOString();
      return { kind: 'interval', everyHours: draft.everyHours, anchor };
    }
    case 'as-needed':
      return draft.maxPerDay > 0 ? { kind: 'as-needed', maxPerDay: draft.maxPerDay } : { kind: 'as-needed' };
  }
}

/** Human check before saving; null when the draft is complete. */
export function scheduleProblem(draft: ScheduleDraft): string | null {
  if ((draft.kind === 'times' || draft.kind === 'weekdays') && draft.times.length === 0) return 'Add at least one time.';
  if (draft.kind === 'weekdays' && draft.days.length === 0) return 'Pick at least one day.';
  if ((draft.kind === 'times' || draft.kind === 'weekdays') && new Set(draft.times).size !== draft.times.length) {
    return 'Two reminders are set for the same time.';
  }
  return null;
}

const KINDS = [
  { value: 'times', label: 'Daily' },
  { value: 'interval', label: 'Interval' },
  { value: 'weekdays', label: 'Some days' },
  { value: 'as-needed', label: 'As needed' },
] as const;

function nextTime(times: string[]): string {
  const last = [...times].sort().at(-1);
  if (!last) return '08:00';
  const [h] = last.split(':').map(Number);
  const next = Math.min(23, (h ?? 8) + 4);
  return `${String(next).padStart(2, '0')}:00`;
}

function TimesList({ draft, onChange }: { draft: ScheduleDraft; onChange: (d: ScheduleDraft) => void }) {
  const setTime = (i: number, value: string) => onChange({ ...draft, times: draft.times.map((t, j) => (j === i ? value : t)) });
  return (
    <Field label="Reminder times" hint={draft.times.length ? draft.times.map(formatHhmm).join(' · ') : undefined}>
      <View style={{ gap: spacing.sm }}>
        {draft.times.map((t, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <AppText variant="body" tone="secondary" style={{ width: 64 }}>
              {`Dose ${i + 1}`}
            </AppText>
            <View style={{ flex: 1, alignItems: 'flex-start' }}>
              <TimeField label={`Dose ${i + 1} time`} value={t} onChange={(v) => setTime(i, v)} />
            </View>
            {draft.times.length > 1 ? (
              <IconButton
                icon={icons.close}
                label={`Remove dose ${i + 1}`}
                onPress={() => onChange({ ...draft, times: draft.times.filter((_, j) => j !== i) })}
              />
            ) : null}
          </View>
        ))}
        {draft.times.length < MAX_TIMES ? (
          <PrimaryButton
            title="Add a time"
            icon={icons.add}
            variant="secondary"
            block={false}
            onPress={() => onChange({ ...draft, times: [...draft.times, nextTime(draft.times)] })}
          />
        ) : null}
      </View>
    </Field>
  );
}

/** Builds any supported schedule: times per day, every N hours, some weekdays, or as needed. */
export function ScheduleBuilder({ draft, onChange }: { draft: ScheduleDraft; onChange: (d: ScheduleDraft) => void }) {
  return (
    <View style={{ gap: spacing.lg }}>
      {/* Four labels wrap inside a segmented control on narrow phones, so the kind picker uses the
          same single-choice chips as the Form field above it. */}
      <Field label="How often">
        <ChoiceChips
          accessibilityLabel="How often"
          options={KINDS}
          isSelected={(kind) => draft.kind === kind}
          onToggle={(kind) => {
            if (kind !== draft.kind) onChange({ ...draft, kind });
          }}
        />
      </Field>

      {draft.kind === 'times' ? <TimesList draft={draft} onChange={onChange} /> : null}

      {draft.kind === 'weekdays' ? (
        <>
          <Field label="On these days">
            <ChoiceChips
              multi
              accessibilityLabel="Days of the week"
              options={WEEKDAYS.map((d) => ({ value: d, label: weekdayShort(d) }))}
              isSelected={(d) => draft.days.includes(d)}
              onToggle={(d) =>
                onChange({ ...draft, days: draft.days.includes(d) ? draft.days.filter((x) => x !== d) : [...draft.days, d] })
              }
            />
          </Field>
          <TimesList draft={draft} onChange={onChange} />
        </>
      ) : null}

      {draft.kind === 'interval' ? (
        <>
          <Field label="Every" hint="Counted in real hours, so it stays right across daylight-saving changes.">
            <Stepper
              label="Hours between doses"
              value={draft.everyHours}
              min={1}
              max={72}
              onChange={(everyHours) => onChange({ ...draft, everyHours })}
              format={(n) => `${n} h`}
            />
          </Field>
          <Field label="First dose today at">
            <TimeField label="First dose" value={draft.anchorTime} onChange={(anchorTime) => onChange({ ...draft, anchorTime })} />
          </Field>
        </>
      ) : null}

      {draft.kind === 'as-needed' ? (
        <Field label="Most in a day" hint="Dosely won't log more than this. No reminders are sent for as-needed medicines.">
          <Stepper
            label="Maximum doses per day"
            value={draft.maxPerDay}
            min={0}
            max={24}
            onChange={(maxPerDay) => onChange({ ...draft, maxPerDay })}
            format={(n) => (n === 0 ? 'No limit' : String(n))}
          />
        </Field>
      ) : null}
    </View>
  );
}
