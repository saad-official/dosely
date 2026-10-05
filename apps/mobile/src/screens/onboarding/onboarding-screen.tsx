import { router } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText } from '@/components/app-text';
import { PrimaryButton } from '@/components/primary-button';
import { haptics } from '@/native/haptics';
import { radius, spacing, touchTarget, useTheme } from '@/theme';

import { CircleArt, LiveActivityArt, NotificationArt } from './illustrations';

type Page = { title: string; body: string; art: ReactNode };

const PAGES: Page[] = [
  {
    title: 'Reminders you can act on',
    body: 'Mark a dose taken, snooze it or skip it straight from the notification. No unlocking, no hunting for the app.',
    art: <NotificationArt />,
  },
  {
    title: 'A dose window, on your Lock Screen',
    body: 'When a dose is due, a calm countdown shows how long is left, with Taken and Snooze one tap away.',
    art: <LiveActivityArt />,
  },
  {
    title: 'People who care get told',
    body: 'Invite a caregiver to your circle. If a dose stays unmarked, they get a gentle heads-up. Nothing else leaves your phone.',
    art: <CircleArt />,
  },
];

function PageView({ page, index, width, scrollX, parallax }: { page: Page; index: number; width: number; scrollX: SharedValue<number>; parallax: boolean }) {
  // Artwork drifts at 30% of the scroll speed; copy fades with distance from centre.
  const artStyle = useAnimatedStyle(() => {
    const offset = scrollX.get() - index * width;
    return {
      transform: [{ translateX: parallax ? offset * 0.3 : 0 }],
      opacity: interpolate(Math.abs(offset), [0, width * 0.8], [1, 0.2], Extrapolation.CLAMP),
    };
  });
  const copyStyle = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(scrollX.get() - index * width), [0, width * 0.6], [1, 0], Extrapolation.CLAMP),
  }));
  return (
    <View style={{ width, flex: 1, paddingHorizontal: spacing.lg, gap: spacing.xl, justifyContent: 'center' }}>
      <Animated.View style={[{ alignItems: 'center', minHeight: 240, justifyContent: 'center' }, artStyle]}>{page.art}</Animated.View>
      <Animated.View style={[{ gap: spacing.sm }, copyStyle]}>
        <AppText variant="title" align="center" accessibilityRole="header">
          {page.title}
        </AppText>
        <AppText variant="body" tone="secondary" align="center">
          {page.body}
        </AppText>
      </Animated.View>
    </View>
  );
}

function Dot({ index, width, scrollX }: { index: number; width: number; scrollX: SharedValue<number> }) {
  const { colors } = useTheme();
  const style = useAnimatedStyle(() => {
    const d = Math.abs(scrollX.get() / Math.max(1, width) - index);
    return {
      opacity: interpolate(d, [0, 1], [1, 0.35], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(d, [0, 1], [1.25, 0.85], Extrapolation.CLAMP) }],
    };
  });
  return <Animated.View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }, style]} />;
}

/** Three short pages (parallax art, page dots, a haptic tick per page), then notification priming. */
export function OnboardingScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollX = useSharedValue(0);
  const [page, setPage] = useState(0);
  const lastPage = useRef(0);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.set(e.contentOffset.x);
  });

  const onPageChange = (next: number) => {
    if (next === lastPage.current) return;
    lastPage.current = next;
    haptics.selection();
    setPage(next);
  };

  // Fires twice per swipe at most (when the rounded page index changes), never per frame.
  useAnimatedReaction(
    () => Math.round(scrollX.get() / Math.max(1, width)),
    (next, prev) => {
      if (prev !== null && next !== prev) scheduleOnRN(onPageChange, next);
    },
  );

  const isLast = page === PAGES.length - 1;
  const next = () => {
    if (isLast) {
      router.push('/notifications');
      return;
    }
    scrollRef.current?.scrollTo({ x: (page + 1) * width, animated: !reduced });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top, paddingBottom: insets.bottom + spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: spacing.md }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skip introduction"
          onPress={() => router.push('/notifications')}
          hitSlop={spacing.sm}
          style={({ pressed }) => ({ minHeight: touchTarget, justifyContent: 'center', paddingHorizontal: spacing.sm, opacity: pressed ? 0.6 : 1 })}
        >
          <AppText variant="body" tone="accent" weight="600">
            Skip
          </AppText>
        </Pressable>
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        {PAGES.map((p, i) => (
          <PageView key={p.title} page={p} index={i} width={width} scrollX={scrollX} parallax={!reduced} />
        ))}
      </Animated.ScrollView>

      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg }}>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={`Page ${page + 1} of ${PAGES.length}`}
          style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.pill }}
        >
          {PAGES.map((p, i) => (
            <Dot key={p.title} index={i} width={width} scrollX={scrollX} />
          ))}
        </View>
        <PrimaryButton title={isLast ? 'Set up reminders' : 'Continue'} size="lg" onPress={next} />
      </View>
    </View>
  );
}
