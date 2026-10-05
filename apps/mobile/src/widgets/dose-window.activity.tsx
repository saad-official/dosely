// iOS Live Activity for an open dose window (Lock Screen banner + Dynamic Island).
//
// Same isolated-runtime rules as next-dose-widget.tsx: only @expo/ui/swift-ui globals, props and
// the environment inside the 'widget' function. The countdown is a native SwiftUI timer
// (`Text timerInterval`), so it keeps ticking while the app is suspended. Buttons fire
// `addUserInteractionListener` events with `target` 'taken-all' / 'snooze' (see live-status.ios.ts).
import { Button, HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  activityBackgroundTint,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  monospacedDigit,
  padding,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

export type DoseWindowColors = { surface: string; text: string; textSecondary: string; accent: string; accentText: string };

export type DoseWindowActivityProps = {
  /** "Metformin, Lisinopril" (or "Mom: Metformin"). */
  title: string;
  /** Locale-formatted due time, e.g. "8:00 PM". */
  dueLabel: string;
  dueAtMs: number;
  /** End of the window (countdown target). */
  endsAtMs: number;
  /** Unmarked doses in the window / all doses in the window. */
  remaining: number;
  total: number;
  snoozeMinutes: number;
  palette: { light: DoseWindowColors; dark: DoseWindowColors };
};

const DoseWindowActivity = (props: DoseWindowActivityProps, environment: LiveActivityEnvironment) => {
  'widget';
  const c = environment.colorScheme === 'dark' ? props.palette.dark : props.palette.light;
  const timer = { lower: new Date(props.dueAtMs), upper: new Date(props.endsAtMs) };
  const countdown = (size: number) => (
    <Text
      timerInterval={timer}
      countsDown
      modifiers={[font({ size, weight: 'semibold' }), monospacedDigit(), foregroundStyle(c.accentText)]}
    />
  );
  const count = props.total > 1 ? `${props.total - props.remaining} of ${props.total} taken` : '';

  const buttons = (
    <HStack spacing={10}>
      <Button
        target="taken-all"
        label={props.remaining > 1 ? 'Taken all' : 'Taken'}
        systemImage="checkmark.circle.fill"
        modifiers={[tint(c.accent)]}
      />
      <Button
        target="snooze"
        label={`Snooze ${props.snoozeMinutes} min`}
        systemImage="zzz"
        modifiers={[foregroundStyle(c.text)]}
      />
    </HStack>
  );

  return {
    banner: (
      <VStack alignment="leading" spacing={10} modifiers={[padding({ all: 16 }), activityBackgroundTint(c.surface)]}>
        <HStack spacing={10}>
          <Image systemName="pills.fill" color={c.accent} size={28} />
          <VStack alignment="leading" spacing={2}>
            <Text modifiers={[font({ size: 17, weight: 'semibold' }), lineLimit(1), foregroundStyle(c.text)]}>{props.title}</Text>
            <HStack spacing={4}>
              <Text modifiers={[font({ size: 13 }), foregroundStyle(c.textSecondary)]}>{`due ${props.dueLabel} ·`}</Text>
              {countdown(13)}
              <Text modifiers={[font({ size: 13 }), foregroundStyle(c.textSecondary)]}>left</Text>
            </HStack>
          </VStack>
          <Spacer />
          {count ? <Text modifiers={[font({ size: 12 }), foregroundStyle(c.textSecondary)]}>{count}</Text> : null}
        </HStack>
        {buttons}
      </VStack>
    ),
    compactLeading: <Image systemName="pills.fill" color={c.accent} />,
    compactTrailing: (
      <Text timerInterval={timer} countsDown modifiers={[monospacedDigit(), frame({ width: 52 }), foregroundStyle(c.accent)]} />
    ),
    minimal: <Image systemName="pills.fill" color={c.accent} />,
    expandedLeading: (
      <VStack alignment="leading" spacing={2} modifiers={[padding({ leading: 4 })]}>
        <Text modifiers={[font({ size: 15, weight: 'semibold' }), lineLimit(1)]}>{props.title}</Text>
        <Text modifiers={[font({ size: 12 }), foregroundStyle(c.accent)]}>{`due ${props.dueLabel}`}</Text>
      </VStack>
    ),
    expandedTrailing: (
      <VStack alignment="trailing" spacing={2} modifiers={[padding({ trailing: 4 })]}>
        {countdown(22)}
        <Text modifiers={[font({ size: 12 })]}>left</Text>
      </VStack>
    ),
    expandedBottom: buttons,
  };
};

export default createLiveActivity<DoseWindowActivityProps>('DoseWindow', DoseWindowActivity);
