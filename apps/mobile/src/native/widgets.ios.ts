// iOS widgets via expo-widgets: `NextDoseWidget` (systemSmall/Medium, accessoryCircular/Inline).
import NextDoseWidget, { type NextDoseWidgetProps } from '@/widgets/next-dose-widget';

import { buildWidgetSnapshot, dueLabel, upcomingChangeInstants, widgetPalette, type WidgetSnapshot } from './widget-snapshot';

export type { WidgetSnapshot } from './widget-snapshot';

function toProps(s: WidgetSnapshot): NextDoseWidgetProps {
  const next = s.nextDose;
  return {
    medName: next?.medName ?? null,
    profileName: next?.profileName || null,
    dueAtMs: next ? Date.parse(next.dueAt) : null,
    dueLabel: next ? dueLabel(next.dueAt) : null,
    todayTaken: s.todayTaken,
    todayTotal: s.todayTotal,
    palette: widgetPalette(s.themeId),
  };
}

export async function refreshWidgets(snapshot: WidgetSnapshot): Promise<void> {
  try {
    NextDoseWidget.updateSnapshot(toProps(snapshot));
  } catch (error) {
    console.warn('[widgets] updateSnapshot failed', error);
  }
}

/**
 * Current snapshot plus timeline entries at each upcoming window open/close, so the widget moves on
 * to the next dose by itself while the app is not running.
 */
export async function refreshWidgetsFromDatabase(): Promise<void> {
  try {
    const now = Date.now();
    const entries = [now, ...upcomingChangeInstants()].map((at) => ({
      date: new Date(at),
      props: toProps(buildWidgetSnapshot(at + 1000)),
    }));
    NextDoseWidget.updateTimeline(entries);
  } catch (error) {
    console.warn('[widgets] updateTimeline failed', error);
    await refreshWidgets(buildWidgetSnapshot());
  }
}
