import { motion } from '@dosely/shared/tokens';
import { useEffect } from 'react';
import { interpolateColor, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { easing } from './motion';

type ColorProp = 'backgroundColor' | 'borderColor';

/**
 * Cross-fades a colour style when the theme changes (Reanimated `interpolateColor` on the UI
 * thread). Starts from the colour currently on screen, so switching again mid-fade never jumps.
 * Reduced motion → instant. Hex / rgba strings only (never PlatformColor).
 */
export function useAnimatedColor(color: string, prop: ColorProp = 'backgroundColor') {
  const reduced = useReducedMotion();
  const from = useSharedValue(color);
  const to = useSharedValue(color);
  const progress = useSharedValue(1);

  useEffect(() => {
    if (to.get() === color) return;
    const current = interpolateColor(progress.get(), [0, 1], [from.get(), to.get()]) as string;
    from.set(current);
    to.set(color);
    progress.set(0);
    progress.set(withTiming(1, { duration: reduced ? 0 : motion.duration.slow, easing: easing.standard }));
  }, [color, from, to, progress, reduced]);

  return useAnimatedStyle(() => {
    const value = interpolateColor(progress.get(), [0, 1], [from.get(), to.get()]);
    return prop === 'borderColor' ? { borderColor: value } : { backgroundColor: value };
  });
}
