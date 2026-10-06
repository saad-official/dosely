import type { DoseState } from '@dosely/shared';
import { View } from 'react-native';

import { icons, type IconName } from '@/constants/icons';
import { CHROME_FONT_CAP, radius, spacing, useTheme, type ThemeColors } from '@/theme';

import { AppText } from './app-text';
import { Icon } from './icon';

type Meta = { label: string; fg: keyof ThemeColors; bg: keyof ThemeColors; icon?: IconName };

const META: Record<DoseState, Meta> = {
  upcoming: { label: 'Upcoming', fg: 'textSecondary', bg: 'track' },
  due: { label: 'Due now', fg: 'onAccent', bg: 'accent' },
  late: { label: 'Late', fg: 'warning', bg: 'warningSoft', icon: icons.clock },
  missed: { label: 'Missed', fg: 'danger', bg: 'dangerSoft', icon: icons.warning },
  taken: { label: 'Taken', fg: 'success', bg: 'successSoft', icon: icons.check },
  skipped: { label: 'Skipped', fg: 'textSecondary', bg: 'track', icon: icons.skip },
  snoozed: { label: 'Snoozed', fg: 'accentText', bg: 'accentSoft', icon: icons.snooze },
};

export function doseStateLabel(state: DoseState): string {
  return META[state].label;
}

/** Dose state as a small capsule. Colour is never the only signal: every state has a word. */
export function StatePill({ state, label }: { state: DoseState; label?: string }) {
  const { colors } = useTheme();
  const meta = META[state];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.sm + 2,
        paddingVertical: 3,
        borderRadius: radius.pill,
        backgroundColor: colors[meta.bg],
        alignSelf: 'flex-start',
      }}
    >
      {meta.icon ? <Icon name={meta.icon} size={12} color={colors[meta.fg]} weight="bold" /> : null}
      <AppText variant="caption" weight="600" maxFontSizeMultiplier={CHROME_FONT_CAP} style={{ color: colors[meta.fg] }}>
        {label ?? meta.label}
      </AppText>
    </View>
  );
}

/** A neutral capsule for non-state info (inventory, "As needed"). */
export function InfoPill({ label, tone = 'neutral', icon }: { label: string; tone?: 'neutral' | 'warning' | 'accent'; icon?: IconName }) {
  const { colors } = useTheme();
  const fg = tone === 'warning' ? colors.warning : tone === 'accent' ? colors.accentText : colors.textSecondary;
  const bg = tone === 'warning' ? colors.warningSoft : tone === 'accent' ? colors.accentSoft : colors.track;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.sm + 2,
        paddingVertical: 3,
        borderRadius: radius.pill,
        backgroundColor: bg,
        alignSelf: 'flex-start',
      }}
    >
      {icon ? <Icon name={icon} size={12} color={fg} weight="bold" /> : null}
      <AppText variant="caption" weight="600" maxFontSizeMultiplier={CHROME_FONT_CAP} style={{ color: fg }}>
        {label}
      </AppText>
    </View>
  );
}
