import type { ReactNode } from 'react';
import { View } from 'react-native';

import type { IconName } from '@/constants/icons';
import { CHROME_FONT_CAP, radius, spacing, useTheme } from '@/theme';

import { AppText } from './app-text';
import { Icon } from './icon';

/** A single figure with its label (adherence, on-time rate, streak). Tiles sit in a wrapping row. */
export function StatTile({ label, value, caption, icon }: { label: string; value: string; caption?: string; icon?: IconName }) {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={[label, value, caption].filter(Boolean).join(', ')}
      style={{
        flexGrow: 1,
        flexBasis: 140,
        backgroundColor: colors.surfaceElevated,
        borderRadius: radius.md,
        borderCurve: 'continuous',
        padding: spacing.md,
        gap: spacing.xs,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        {icon ? <Icon name={icon} size={14} color={colors.accentText} weight="semibold" /> : null}
        <AppText variant="caption" tone="secondary" weight="600" maxFontSizeMultiplier={CHROME_FONT_CAP}>
          {label}
        </AppText>
      </View>
      <AppText variant="title" tabular>
        {value}
      </AppText>
      {caption ? (
        <AppText variant="caption" tone="secondary">
          {caption}
        </AppText>
      ) : null}
    </View>
  );
}

/** Wrapping row for StatTiles. */
export function StatRow({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>{children}</View>;
}
