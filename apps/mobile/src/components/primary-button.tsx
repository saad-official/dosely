import { useState } from 'react';
import { ActivityIndicator, Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import type { IconName } from '@/constants/icons';
import { CHROME_FONT_CAP, cssEasing, doseTarget, radius, spacing, touchTarget, useTheme, withAlpha } from '@/theme';

import { AppText } from './app-text';
import { Icon } from './icon';

/** `tonal`: a secondary action on a tinted surface (the Due-now card), where `secondary` would vanish. */
export type ButtonVariant = 'primary' | 'secondary' | 'tonal' | 'ghost' | 'destructive';
export type ButtonSize = 'md' | 'lg';

export type PrimaryButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  /** `lg` = 56 pt dose actions; `md` = 48 pt everything else. */
  size?: ButtonSize;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  /** Stretch to the container width (default true). */
  block?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

/** The app's button: pressed feedback is a 3% scale in 120 ms (feedback on press-in). */
export function PrimaryButton({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading,
  disabled,
  block = true,
  accessibilityHint,
  style,
}: PrimaryButtonProps) {
  const { colors, isDark } = useTheme();
  const [pressed, setPressed] = useState(false);
  const inactive = !!disabled || !!loading;

  const fill = {
    primary: { bg: colors.accent, fg: colors.onAccent },
    secondary: { bg: colors.accentSoft, fg: colors.accentText },
    tonal: { bg: isDark ? withAlpha(colors.text, 0.12) : colors.surfaceElevated, fg: colors.accentText },
    ghost: { bg: 'transparent', fg: colors.accentText },
    destructive: { bg: colors.dangerSoft, fg: colors.danger },
  }[variant];
  // Disabled: a neutral fill + tertiary label instead of 45% opacity (a faded accent reads as a
  // washed-out but live button, and translucency lets the page show through on cards).
  const face = disabled ? { bg: variant === 'ghost' ? 'transparent' : colors.track, fg: colors.textTertiary } : fill;

  const height = size === 'lg' ? doseTarget : Math.max(touchTarget, 48);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      pressRetentionOffset={16}
      style={[block ? { alignSelf: 'stretch' } : { alignSelf: 'flex-start' }, style]}
    >
      <Animated.View
        style={{
          minHeight: height,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          borderRadius: radius.md,
          borderCurve: 'continuous',
          backgroundColor: face.bg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          transform: [{ scale: pressed && !inactive ? 0.97 : 1 }],
          transitionProperty: 'transform',
          transitionDuration: 120,
          transitionTimingFunction: cssEasing.standard,
        }}
      >
        {loading ? (
          <ActivityIndicator color={face.fg} />
        ) : (
          <>
            {icon ? <Icon name={icon} size={size === 'lg' ? 22 : 18} color={face.fg} weight="semibold" /> : null}
            <AppText
              variant={size === 'lg' ? 'body' : 'callout'}
              weight="600"
              maxFontSizeMultiplier={CHROME_FONT_CAP}
              style={{ color: face.fg, flexShrink: 1 }}
              numberOfLines={2}
              align="center"
            >
              {title}
            </AppText>
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}
