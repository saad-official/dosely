import { motion } from '@dosely/shared/tokens';
import { useLayoutEffect, useRef } from 'react';
import { interpolateColor, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { easing } from './motion';
import { useTheme } from './theme-context';

type ColorProp = 'backgroundColor' | 'borderColor';

/**
 * Cross-fades a colour style when the seasonal theme changes (Reanimated `interpolateColor` on the
 * UI thread). Starts from the colour currently on screen, so switching again mid-fade never jumps.
 * A light/dark flip is instant: text and every non-animated surface switch in the same frame, so
 * fading only the background would flash light text on a light page (or dark on dark).
 * Reduced motion → instant. Hex / rgba strings only (never PlatformColor).
 */
export function useAnimatedColor(color: string, prop: ColorProp = 'backgroundColor') {
  const reduced = useReducedMotion();
  const { scheme } = useTheme();
  const lastScheme = useRef(scheme);
  const from = useSharedValue(color);
  const to = useSharedValue(color);
  const progress = useSharedValue(1);

  // Layout effect: the new target is set before the frame paints.
  useLayoutEffect(() => {
    const schemeFlipped = lastScheme.current !== scheme;
    lastScheme.current = scheme;
    if (to.get() === color) return;
    if (reduced || schemeFlipped) {
      from.set(color);
      to.set(color);
      progress.set(1);
      return;
    }
    const current = interpolateColor(progress.get(), [0, 1], [from.get(), to.get()]) as string;
    from.set(current);
    to.set(color);
    progress.set(0);
    progress.set(withTiming(1, { duration: motion.duration.slow, easing: easing.standard }));
  }, [color, scheme, from, to, progress, reduced]);

  return useAnimatedStyle(() => {
    const value = interpolateColor(progress.get(), [0, 1], [from.get(), to.get()]);
    return prop === 'borderColor' ? { borderColor: value } : { backgroundColor: value };
  });
}
