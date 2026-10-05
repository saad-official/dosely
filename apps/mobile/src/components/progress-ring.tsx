import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { springs, useAnimatedColor, useTheme } from '@/theme';

export type ProgressRingProps = {
  /** 0..1 */
  progress: number;
  size?: number;
  stroke?: number;
  /** Centre content (count, label). */
  children?: ReactNode;
  accessibilityLabel?: string;
};

/**
 * A progress ring without SVG: two clipped half-rings rotate on the UI thread (Reanimated). The right
 * clip shows 0–180°, the left clip 180–360°. The arc springs (`soft`) to new values and its colour
 * cross-fades with the theme.
 */
export function ProgressRing({ progress, size = 132, stroke = 12, children, accessibilityLabel }: ProgressRingProps) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const value = useSharedValue(0);
  const arcColor = useAnimatedColor(colors.accent, 'borderColor');
  const clamped = Math.max(0, Math.min(1, progress));

  useEffect(() => {
    value.set(reduced ? withTiming(clamped, { duration: 0 }) : withSpring(clamped, springs.soft));
  }, [clamped, reduced, value]);

  const half = size / 2;

  // Right clip: a left-half ring rotated clockwise by min(angle, 180).
  const rightStyle = useAnimatedStyle(() => {
    const angle = Math.min(1, Math.max(0, value.get())) * 360;
    return { transform: [{ rotate: `${Math.min(angle, 180)}deg` }] };
  });
  // Left clip: a right-half ring rotated by max(angle - 180, 0).
  const leftStyle = useAnimatedStyle(() => {
    const angle = Math.min(1, Math.max(0, value.get())) * 360;
    return { transform: [{ rotate: `${Math.max(angle - 180, 0)}deg` }], opacity: angle > 180 ? 1 : 0 };
  });

  const ring = { width: size, height: size, borderRadius: half, borderWidth: stroke };

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={{ width: size, height: size, direction: 'ltr' }}
    >
      <View style={[ring, { position: 'absolute', borderColor: colors.track }]} />

      {/* Right half (0–180°) */}
      <View style={{ position: 'absolute', left: half, top: 0, width: half, height: size, overflow: 'hidden' }}>
        <Animated.View style={[{ position: 'absolute', left: -half, top: 0, width: size, height: size }, rightStyle]}>
          <View style={{ position: 'absolute', left: 0, top: 0, width: half, height: size, overflow: 'hidden' }}>
            <Animated.View style={[ring, arcColor]} />
          </View>
        </Animated.View>
      </View>

      {/* Left half (180–360°) */}
      <View style={{ position: 'absolute', left: 0, top: 0, width: half, height: size, overflow: 'hidden' }}>
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: size, height: size }, leftStyle]}>
          <View style={{ position: 'absolute', left: half, top: 0, width: half, height: size, overflow: 'hidden' }}>
            <Animated.View style={[ring, { marginLeft: -half }, arcColor]} />
          </View>
        </Animated.View>
      </View>

      <View
        style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', padding: stroke + 4 }}
      >
        {children}
      </View>
    </View>
  );
}
