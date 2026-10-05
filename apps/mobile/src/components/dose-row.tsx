import { MenuView } from '@expo/ui/community/menu';
import { useRef, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import type { DoseView } from '@/data';
import { formatClock } from '@/data';
import { formatMinutes } from '@/constants/format';
import { icons, type IconName } from '@/constants/icons';
import { CHROME_FONT_CAP, doseTarget, hairline, radius, spacing, useTheme } from '@/theme';

import { AppText } from './app-text';
import { CheckButton } from './check-button';
import { Icon } from './icon';
import { MedIcon } from './med-icon';
import { doseStateLabel, InfoPill, StatePill } from './state-pill';

export const SNOOZE_CHOICES = [5, 10, 15, 30, 60] as const;

export type DoseRowProps = {
  dose: DoseView;
  onTake: (dose: DoseView) => void;
  onSkip: (dose: DoseView) => void;
  onSnooze: (dose: DoseView, minutes: number) => void;
  onUndo: (dose: DoseView) => void;
  /** Show whose dose it is (the "Everyone" view). */
  showProfile?: boolean;
};

function SwipeAction({
  label,
  icon,
  bg,
  fg,
  onPress,
}: {
  label: string;
  icon: IconName;
  bg: string;
  fg: string;
  onPress?: () => void;
}) {
  const body = (
    <View
      style={{
        width: 84,
        height: '100%',
        minHeight: doseTarget,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
      }}
    >
      <Icon name={icon} size={22} color={fg} weight="semibold" />
      <AppText variant="caption" weight="700" maxFontSizeMultiplier={CHROME_FONT_CAP} style={{ color: fg }}>
        {label}
      </AppText>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
      {body}
    </Pressable>
  );
}

/**
 * One dose on the Today timeline. The 56 pt check marks it taken (or undoes a take); swiping right
 * reveals Taken, swiping left reveals Skip and Snooze (a native menu of durations). VoiceOver and
 * TalkBack get the same actions as named accessibility actions on the row.
 */
export function DoseRow({ dose, onTake, onSkip, onSnooze, onUndo, showProfile }: DoseRowProps) {
  const { colors } = useTheme();
  const swipe = useRef<SwipeableMethods>(null);
  const med = dose.medication;
  const name = med?.name ?? 'Medication';
  const time = formatClock(dose.dueAt);
  const taken = dose.state === 'taken';
  const settled = taken || dose.state === 'skipped';
  const asNeeded = dose.source === 'as-needed';
  const detail = [med?.strength, med?.instructions].filter(Boolean).join(' · ');
  const snoozeUntil = dose.state === 'snoozed' && dose.snoozedUntil ? formatClock(dose.snoozedUntil) : null;

  const close = () => swipe.current?.close();
  const take = () => {
    close();
    onTake(dose);
  };
  const skip = () => {
    close();
    onSkip(dose);
  };
  const snooze = (minutes: number) => {
    close();
    onSnooze(dose, minutes);
  };

  const a11yLabel = [
    name,
    med?.strength,
    showProfile && dose.profile ? `for ${dose.profile.name}` : null,
    asNeeded ? `logged at ${time}` : `due ${time}`,
    doseStateLabel(dose.state),
    snoozeUntil ? `until ${snoozeUntil}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  const row = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm + 4,
        backgroundColor: colors.surfaceElevated,
        minHeight: doseTarget + spacing.lg,
      }}
    >
      <MedIcon icon={med?.icon ?? 'pill'} color={med?.color ?? 'teal'} size={44} />
      <View
        style={{ flex: 1, gap: spacing.xs }}
        accessible
        accessibilityLabel={a11yLabel}
        accessibilityActions={
          asNeeded
            ? [{ name: 'undo', label: 'Remove this log' }]
            : settled
              ? [{ name: 'undo', label: 'Undo' }]
              : [
                  { name: 'take', label: 'Mark taken' },
                  { name: 'skip', label: 'Skip' },
                  { name: 'snooze', label: 'Snooze 10 minutes' },
                ]
        }
        onAccessibilityAction={(e) => {
          const action = e.nativeEvent.actionName;
          if (action === 'take') onTake(dose);
          else if (action === 'skip') onSkip(dose);
          else if (action === 'snooze') onSnooze(dose, 10);
          else if (action === 'undo') onUndo(dose);
        }}
      >
        <AppText
          variant="body"
          weight="600"
          style={settled && !taken ? { color: colors.textSecondary, textDecorationLine: 'line-through' } : null}
        >
          {name}
        </AppText>
        {detail || (showProfile && dose.profile) ? (
          <AppText variant="callout" tone="secondary" numberOfLines={2}>
            {[showProfile && dose.profile ? dose.profile.name : null, detail || null].filter(Boolean).join(' · ')}
          </AppText>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' }}>
          {asNeeded ? <InfoPill label="As needed" tone="accent" /> : <StatePill state={dose.state} label={snoozeUntil ? `Snoozed to ${snoozeUntil}` : undefined} />}
          {taken && dose.takenAt && !asNeeded ? (
            <AppText variant="caption" tone="secondary">
              {`at ${formatClock(dose.takenAt)}`}
            </AppText>
          ) : null}
        </View>
      </View>
      <CheckButton
        checked={taken}
        label={taken ? `Undo ${name} taken` : `Mark ${name} taken`}
        onPress={() => (taken ? onUndo(dose) : onTake(dose))}
      />
    </View>
  );

  if (asNeeded) return row;

  return (
    <ReanimatedSwipeable
      ref={swipe}
      friction={2}
      leftThreshold={64}
      rightThreshold={64}
      overshootLeft={false}
      overshootRight={false}
      containerStyle={{ backgroundColor: colors.surfaceSunken }}
      renderLeftActions={() =>
        taken ? (
          <SwipeAction label="Undo" icon={icons.undo} bg={colors.surfaceSunken} fg={colors.text} onPress={() => {
            close();
            onUndo(dose);
          }} />
        ) : (
          <SwipeAction label="Taken" icon={icons.check} bg={colors.accent} fg={colors.onAccent} onPress={take} />
        )
      }
      renderRightActions={() =>
        settled ? null : (
          <View style={{ flexDirection: 'row' }}>
            <SwipeAction label="Skip" icon={icons.skip} bg={colors.surfaceSunken} fg={colors.text} onPress={skip} />
            <MenuView
              title="Snooze for"
              actions={SNOOZE_CHOICES.map((m) => ({ id: String(m), title: formatMinutes(m) }))}
              onPressAction={({ nativeEvent }) => snooze(Number(nativeEvent.event))}
            >
              <SwipeAction label="Snooze" icon={icons.snooze} bg={colors.warningSoft} fg={colors.warning} />
            </MenuView>
          </View>
        )
      }
    >
      {row}
    </ReanimatedSwipeable>
  );
}

/** Rounded container for a group of dose rows with hairline separators. */
export function DoseGroup({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ borderRadius: radius.md, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.separator, gap: hairline }}>
      {children}
    </View>
  );
}
