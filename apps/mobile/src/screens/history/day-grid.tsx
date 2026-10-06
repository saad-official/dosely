import { weekdayOfKey, type DaySummary } from '@dosely/shared';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { formatDayShort, weekdayNarrow, weekdayShort, WEEKDAYS } from '@/constants/format';
import { CHROME_FONT_CAP, mix, radius, spacing, readableOn, useTheme, type ThemeColors } from '@/theme';

/** Day squares sit on the elevated card, so partial tints are blended into it (opaque, so the day
 * number's colour can be picked against the real fill). */
function fill(day: DaySummary, c: ThemeColors): string {
  if (day.total === 0) return c.track;
  if (day.rate === null) return mix(c.surfaceElevated, c.accent, 0.12);
  if (day.rate >= 0.999) return c.accent;
  if (day.rate >= 0.75) return mix(c.surfaceElevated, c.accent, 0.62);
  if (day.rate >= 0.5) return mix(c.surfaceElevated, c.accent, 0.36);
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
              const bg = fill(day, colors);
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
                    backgroundColor: bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {large ? (
                    <AppText
                      variant="caption"
                      weight="600"
                      maxFontSizeMultiplier={1.3}
                      // onAccent is white in several seasonal themes: on the 62% tint it fell to ~2.5:1.
                      style={{ color: readableOn(bg, [colors.text, colors.onAccent]) }}
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
          { c: mix(colors.surfaceElevated, colors.accent, 0.36), t: 'Some' },
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
