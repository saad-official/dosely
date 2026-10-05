// Android widget via react-native-android-widget (`NextDoseWidget`, 2×2).
import { createElement } from 'react';
import { requestWidgetUpdate } from 'react-native-android-widget';

import {
  type AndroidWidgetColors,
  NEXT_DOSE_WIDGET_NAME,
  NextDoseWidgetAndroid,
} from '@/widgets/next-dose-widget.android';

import { buildWidgetSnapshot, dueLabel, widgetPalette, type WidgetColors, type WidgetSnapshot } from './widget-snapshot';

export type { WidgetSnapshot } from './widget-snapshot';

const asColors = (c: WidgetColors) => c as unknown as AndroidWidgetColors;

/** Light + dark renderings; the launcher picks by system theme. */
export function renderNextDoseWidget(s: WidgetSnapshot) {
  const palette = widgetPalette(s.themeId);
  const props = {
    medName: s.nextDose?.medName ?? null,
    profileName: s.nextDose?.profileName || null,
    dueLabel: s.nextDose ? dueLabel(s.nextDose.dueAt) : null,
    todayTaken: s.todayTaken,
    todayTotal: s.todayTotal,
  };
  return {
    light: createElement(NextDoseWidgetAndroid, { ...props, colors: asColors(palette.light) }),
    dark: createElement(NextDoseWidgetAndroid, { ...props, colors: asColors(palette.dark) }),
  };
}

export async function refreshWidgets(snapshot: WidgetSnapshot): Promise<void> {
  try {
    await requestWidgetUpdate({ widgetName: NEXT_DOSE_WIDGET_NAME, renderWidget: () => renderNextDoseWidget(snapshot) });
  } catch (error) {
    console.warn('[widgets] requestWidgetUpdate failed', error);
  }
}

export async function refreshWidgetsFromDatabase(): Promise<void> {
  await refreshWidgets(buildWidgetSnapshot());
}
