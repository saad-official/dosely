// Reanimated-ready motion values built from the shared tokens. Calm by design: no bouncy overshoot.
import { motion } from '@dosely/shared/tokens';
import { cubicBezier, Easing } from 'react-native-reanimated';

/** `withTiming` easings. */
export const easing = {
  standard: Easing.bezier(...motion.easing.standard),
  exit: Easing.bezier(...motion.easing.exit),
} as const;

/** Reanimated CSS-transition timing functions. */
export const cssEasing = {
  standard: cubicBezier(...motion.easing.standard),
  exit: cubicBezier(...motion.easing.exit),
} as const;

/** `withSpring` configs: `gentle` for buttons and the Taken check, `soft` for cards and the ring. */
export const springs = motion.spring;
