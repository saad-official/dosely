// Android widget task handler (headless JS). Runs when a widget is added, resized, updated by the
// system or tapped — possibly with the app process cold — so it reads SQLite directly.
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { ensureDosesExpanded } from '@/data/expand';
import { ensureDatabaseReady } from '@/data/migrate';
import { renderNextDoseWidget } from '@/native/widgets.android';
import { buildWidgetSnapshot } from '@/native/widget-snapshot';

export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  const { widgetAction, renderWidget } = props;
  if (widgetAction === 'WIDGET_DELETED') return;
  try {
    await ensureDatabaseReady();
    if (widgetAction === 'WIDGET_ADDED' || widgetAction === 'WIDGET_UPDATE') ensureDosesExpanded();
    renderWidget(renderNextDoseWidget(buildWidgetSnapshot()));
  } catch (error) {
    console.warn('[widgets] task handler failed', error);
  }
}
