// iOS home-screen / Lock Screen widget: the next dose (name, time, countdown) and today's progress.
//
// The function marked 'widget' is stringified at build time and evaluated in the widget extension's
// isolated runtime: it may only use @expo/ui/swift-ui components/modifiers (keep the imported names
// unaliased), its props and the environment. No hooks, no app imports, no outer-scope constants.
// Props are JSON, so instants travel as epoch milliseconds.
import { AccessoryWidgetBackground, Gauge, HStack, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  gaugeStyle,
  lineLimit,
  minimumScaleFactor,
  monospacedDigit,
  padding,
  tint,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

export type NextDoseWidgetColors = {
  surface: string;
  text: string;
  textSecondary: string;
  accent: string;
  accentText: string;
  track: string;
};

export type NextDoseWidgetProps = {
  medName: string | null;
  /** Shown for dependents ("Mom"); empty for the user's own doses. */
  profileName: string | null;
  dueAtMs: number | null;
  /** Locale-formatted due time, e.g. "8:00 PM". */
  dueLabel: string | null;
  todayTaken: number;
  todayTotal: number;
  palette: { light: NextDoseWidgetColors; dark: NextDoseWidgetColors };
};

const NextDoseWidget = (props: NextDoseWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const c = environment.colorScheme === 'dark' ? props.palette.dark : props.palette.light;
  const family = environment.widgetFamily;
  const total = props.todayTotal;
  const progress = total > 0 ? props.todayTaken / total : 0;
  const progressLabel = total > 0 ? `${props.todayTaken}/${total}` : '–';
  const hasNext = props.medName != null && props.dueAtMs != null;
  const due = hasNext ? new Date(props.dueAtMs as number) : null;
  const dueSoon = due != null && due.getTime() > environment.date.getTime();

  if (family === 'accessoryInline') {
    return (
      <Text modifiers={[widgetURL('dosely://today')]}>
        {hasNext ? `${props.medName} · ${props.dueLabel ?? ''}` : 'Dosely · all done today'}
      </Text>
    );
  }

  if (family === 'accessoryCircular') {
    return (
      <ZStack modifiers={[widgetURL('dosely://today')]}>
        <AccessoryWidgetBackground />
        <Gauge
          value={progress}
          min={0}
          max={1}
          currentValueLabel={<Text modifiers={[font({ size: 14, weight: 'semibold' }), monospacedDigit()]}>{progressLabel}</Text>}
          modifiers={[gaugeStyle('circularCapacity')]}
        />
      </ZStack>
    );
  }

  const nextBlock = hasNext ? (
    <VStack alignment="leading" spacing={2}>
      <Text modifiers={[font({ size: 17, weight: 'semibold' }), lineLimit(2), minimumScaleFactor(0.7), foregroundStyle(c.text)]}>
        {props.medName ?? ''}
      </Text>
      {props.profileName ? (
        <Text modifiers={[font({ size: 12 }), lineLimit(1), foregroundStyle(c.textSecondary)]}>{props.profileName}</Text>
      ) : null}
      <HStack spacing={4}>
        <Text modifiers={[font({ size: 13, weight: 'medium' }), monospacedDigit(), foregroundStyle(c.accentText)]}>
          {props.dueLabel ?? ''}
        </Text>
        {dueSoon ? (
          <Text
            date={due as Date}
            dateStyle="relative"
            modifiers={[font({ size: 13 }), monospacedDigit(), lineLimit(1), foregroundStyle(c.textSecondary)]}
          />
        ) : (
          <Text modifiers={[font({ size: 13 }), foregroundStyle(c.textSecondary)]}>due now</Text>
        )}
      </HStack>
    </VStack>
  ) : (
    <VStack alignment="leading" spacing={2}>
      <Text modifiers={[font({ size: 17, weight: 'semibold' }), foregroundStyle(c.text)]}>All done</Text>
      <Text modifiers={[font({ size: 13 }), foregroundStyle(c.textSecondary)]}>Nothing else due today</Text>
    </VStack>
  );

  const ring = (
    <Gauge
      value={progress}
      min={0}
      max={1}
      currentValueLabel={<Text modifiers={[font({ size: 13, weight: 'semibold' }), monospacedDigit()]}>{progressLabel}</Text>}
      modifiers={[gaugeStyle('circularCapacity'), tint(c.accent)]}
    />
  );

  if (family === 'systemMedium') {
    return (
      <HStack spacing={16} modifiers={[padding({ all: 4 }), containerBackground(c.surface, 'widget'), widgetURL('dosely://today')]}>
        <VStack alignment="leading" spacing={6}>
          <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(c.textSecondary)]}>NEXT DOSE</Text>
          {nextBlock}
        </VStack>
        <Spacer />
        <VStack alignment="center" spacing={4}>
          {ring}
          <Text modifiers={[font({ size: 11 }), foregroundStyle(c.textSecondary)]}>today</Text>
        </VStack>
      </HStack>
    );
  }

  // systemSmall
  return (
    <VStack
      alignment="leading"
      spacing={6}
      modifiers={[padding({ all: 2 }), containerBackground(c.surface, 'widget'), widgetURL('dosely://today')]}
    >
      <HStack>
        <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(c.textSecondary)]}>NEXT DOSE</Text>
        <Spacer />
        <Text modifiers={[font({ size: 12, weight: 'semibold' }), monospacedDigit(), foregroundStyle(c.accentText)]}>
          {progressLabel}
        </Text>
      </HStack>
      {nextBlock}
      <Spacer />
    </VStack>
  );
};

export default createWidget<NextDoseWidgetProps>('NextDoseWidget', NextDoseWidget);
