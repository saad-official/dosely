// Semantic haptics (expo-haptics). Fire-and-forget; silently no-op where unsupported.
import * as Haptics from 'expo-haptics';

const run = (p: Promise<void>) => {
  p.catch(() => undefined);
};

export const haptics = {
  /** A dose marked taken. */
  taken: () => run(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Skip / snooze: acknowledged, not celebrated. */
  skipped: () => run(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  snoozed: () => run(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Undo of a mark. */
  undone: () => run(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft)),
  /** Picker / segmented / theme selection changes. */
  selection: () => run(Haptics.selectionAsync()),
  /** A validation or network error the user must notice. */
  warning: () => run(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => run(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
