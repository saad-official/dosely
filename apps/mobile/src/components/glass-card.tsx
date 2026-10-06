import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useReduceTransparency } from '@/hooks/use-accessibility';
import { radius as radii, spacing, useTheme, type RadiusToken } from '@/theme';

const CAN_GLASS = process.env.EXPO_OS === 'ios' && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

/** Whether the platform renders real Liquid Glass (used to avoid glass-on-glass). */
export const supportsLiquidGlass = CAN_GLASS;

export type GlassCardProps = {
  children: ReactNode;
  radius?: RadiusToken;
  padding?: number;
  /** Tints the glass with the theme accent (the floating "due now" card). */
  tinted?: boolean;
  /** Gap between children (applied to whichever view holds them). */
  gap?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * A floating surface, reserved for the "due now" card and sheet chrome: Liquid Glass on iOS 26, a
 * system material blur on older iOS, and a solid elevated surface on Android or with Reduce
 * Transparency. Only the solid surface casts a shadow: a shadow under a translucent material shows
 * through it as a grey smudge. Never nested, never opacity-animated (animate the content instead).
 */
export function GlassCard({ children, radius = 'lg', padding = spacing.md, tinted, gap, style }: GlassCardProps) {
  const { colors, shadow, isDark } = useTheme();
  const reduce = useReduceTransparency();
  const shape: ViewStyle = { borderRadius: radii[radius], borderCurve: 'continuous', padding, gap };

  if (CAN_GLASS && !reduce) {
    return (
      <GlassView glassEffectStyle="regular" tintColor={tinted ? colors.accentSoft : undefined} style={[shape, style]}>
        {children}
      </GlassView>
    );
  }
  if (process.env.EXPO_OS === 'ios' && !reduce) {
    return (
      <View style={[shape, { padding: 0 }, style]}>
        <BlurView
          tint={isDark ? 'systemThickMaterialDark' : 'systemThickMaterialLight'}
          intensity={90}
          style={[shape, { overflow: 'hidden' }]}
        >
          <View
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              start: 0,
              end: 0,
              backgroundColor: tinted ? colors.accentSoft : colors.surfaceElevated,
              opacity: 0.45,
            }}
          />
          {children}
        </BlurView>
      </View>
    );
  }
  return (
    <View
      style={[
        shape,
        { backgroundColor: tinted ? colors.accentSoft : colors.surfaceElevated, boxShadow: shadow('md') },
        style,
      ]}
    >
      {children}
    </View>
  );
}
