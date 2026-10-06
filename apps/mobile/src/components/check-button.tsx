import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { icons } from '@/constants/icons';
import { doseTarget, radius, springs, useTheme } from '@/theme';

import { Icon } from './icon';

export type CheckButtonProps = {
  checked: boolean;
  onPress: () => void;
  label: string;
  hint?: string;
  size?: number;
};

/**
 * The 56 pt Taken control. Checking fills the disc and springs the check in (`gentle`, no
 * overshoot-heavy bounce); the caller fires the success haptic in the same frame. Unchecking
 * reverses it. Reduced motion → a plain cross-fade.
 */
export function CheckButton({ checked, onPress, label, hint, size = doseTarget }: CheckButtonProps) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const progress = useSharedValue(checked ? 1 : 0);

  useEffect(() => {
    const target = checked ? 1 : 0;
    progress.set(reduced ? withTiming(target, { duration: 150 }) : withSpring(target, springs.gentle));
  }, [checked, progress, reduced]);

  const fillStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ scale: reduced ? 1 : interpolate(progress.get(), [0, 1], [0.55, 1]) }],
  }));
  const checkStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0.35, 1], [0, 1], 'clamp'),
    transform: [{ scale: reduced ? 1 : interpolate(progress.get(), [0, 1], [0.4, 1]) }, { rotate: `${reduced ? 0 : interpolate(progress.get(), [0, 1], [-20, 0])}deg` }],
  }));

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ checked }}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: radius.pill,
          borderWidth: 2.5,
          // The unchecked ring is the dose action's only outline: textTertiary keeps it >= 3:1 (border was ~1.5:1).
          borderColor: checked ? colors.accent : colors.textTertiary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Animated.View
          style={[
            { position: 'absolute', width: size - 5, height: size - 5, borderRadius: radius.pill, backgroundColor: colors.accent },
            fillStyle,
          ]}
        />
        <Animated.View style={checkStyle}>
          <Icon name={icons.check} size={Math.round(size * 0.46)} color={colors.onAccent} weight="bold" />
        </Animated.View>
      </View>
    </Pressable>
  );
}
