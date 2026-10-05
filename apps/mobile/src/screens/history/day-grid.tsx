import { weekdayOfKey, type DaySummary } from '@dosely/shared';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { formatDayShort, weekdayNarrow, weekdayShort, WEEKDAYS } from '@/constants/format';
import { CHROME_FONT_CAP, radius, spacing, useTheme, withAlpha, type ThemeColors } from '@/theme';

function fill(day: DaySummary, c: ThemeColors): string {
  if (day.total === 0) return c.track;
  if (day.rate === null) return withAlpha(c.accent, 0.12);
  if (day.rate >= 0.999) return c.accent;
  if (day.rate >= 0.75) return withAlpha(c.accent, 0.62);
  if (day.rate >= 0.5) return withAlpha(c.accent, 0.36);
  if (day.rate > 0) return c.warningSoft;
  return c.dangerSoft;
}

function label(day: DaySummary): string {
  const date = `${weekdayShort(weekdayOfKey(day.dayKey))} ${formatDayShort(day.dayKey)}`;
  if (day.total === 0) return `${date}: nothing scheduled`;
  const parts = [`${day.taken} of ${day.total} taken`];
  if (day.missed) parts.push(`${day.missed} missed`);
  if (day.skipped) parts.push(`${day.skipped} skipped`);
  if (day.pending) parts.push(`${day.pending} still to come`);
  return `${date}: ${parts.join(', ')}`;
}

/**
 * One square per day, coloured by that day's adherence, in week rows aligned to weekdays. Colour is
 * backed by a per-square accessibility label and the legend's words.
 */
export function DayGrid({ days, large }: { days: DaySummary[]; large?: boolean }) {
  const { colors } = useTheme();
  const first = days[0];
  const lead = first ? weekdayOfKey(first.dayKey) : 0;
  const cells: (DaySummary | null)[] = [...Array.from({ length: lead }, () => null), ...days];
  const rows: (DaySummary | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  const gap = large ? spacing.sm : 6;

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ gap }}>
        <View style={{ flexDirection: 'row', gap }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {WEEKDAYS.map((d) => (
            <AppText key={d} variant="caption" tone="secondary" align="center" maxFontSizeMultiplier={CHROME_FONT_CAP} style={{ flex: 1 }}>
              {weekdayNarrow(d)}
            </AppText>
          ))}
        </View>
        {rows.map((row, r) => (
          <View key={r} style={{ flexDirection: 'row', gap }}>
            {Array.from({ length: 7 }, (_, i) => {
              const day = row[i];
              if (!day) return <View key={i} style={{ flex: 1, aspectRatio: 1 }} />;
              return (
                <View
                  key={day.dayKey}
                  accessible
                  accessibilityLabel={label(day)}
                  style={{
                    flex: 1,
                    aspectRatio: 1,
                    borderRadius: large ? radius.sm : 6,
                    borderCurve: 'continuous',
                    backgroundColor: fill(day, colors),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {large ? (
                    <AppText
                      variant="caption"
                      weight="600"
                      maxFontSizeMultiplier={1.3}
                      style={{ color: day.rate !== null && day.rate >= 0.75 ? colors.onAccent : colors.text }}
                    >
                      {day.dayKey.slice(8).replace(/^0/, '')}
                    </AppText>
                  ) : null}
                </View>
              );
            })}
          </View>
        ))}
      </View>
      <View
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center' }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {[
          { c: colors.accent, t: 'All taken' },
          { c: withAlpha(colors.accent, 0.36), t: 'Some' },
          { c: colors.dangerSoft, t: 'Missed' },
          { c: colors.track, t: 'Nothing due' },
        ].map((l) => (
          <View key={l.t} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: l.c }} />
            <AppText variant="caption" tone="secondary" maxFontSizeMultiplier={CHROME_FONT_CAP}>
              {l.t}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}
