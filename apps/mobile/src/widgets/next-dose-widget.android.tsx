'use no memo';
// Android home-screen widget (react-native-android-widget), 2×2: next dose + today's progress ring.
// These components are called as plain functions to build a RemoteViews tree, so the React
// Compiler must stay off (above) and no hooks may be used. Never pass `null`/`false` children:
// the tree builder cannot skip them.
import { type ColorProp, FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';

export const NEXT_DOSE_WIDGET_NAME = 'NextDoseWidget';

export type AndroidWidgetColors = {
  surface: ColorProp;
  text: ColorProp;
  textSecondary: ColorProp;
  accent: ColorProp;
  accentText: ColorProp;
  track: ColorProp;
};

export type NextDoseWidgetAndroidProps = {
  medName: string | null;
  profileName: string | null;
  dueLabel: string | null;
  todayTaken: number;
  todayTotal: number;
  colors: AndroidWidgetColors;
};

function ring(taken: number, total: number, c: AndroidWidgetColors): string {
  const r = 26;
  const circumference = 2 * Math.PI * r;
  const share = total > 0 ? Math.min(1, taken / total) : 0;
  const dash = (share * circumference).toFixed(2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="${r}" fill="none" stroke="${c.track}" stroke-width="7"/>
  <circle cx="32" cy="32" r="${r}" fill="none" stroke="${c.accent}" stroke-width="7" stroke-linecap="round"
    stroke-dasharray="${dash} ${circumference.toFixed(2)}" transform="rotate(-90 32 32)"/>
</svg>`;
}

export function NextDoseWidgetAndroid(props: NextDoseWidgetAndroidProps) {
  const c = props.colors;
  const progressLabel = props.todayTotal > 0 ? `${props.todayTaken}/${props.todayTotal}` : '–';
  const hasNext = props.medName != null;
  const subtitle = hasNext
    ? [props.dueLabel ?? '', props.profileName ?? ''].filter(Boolean).join(' · ')
    : 'Nothing else due today';

  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'dosely://today' }}
      accessibilityLabel={hasNext ? `Next dose ${props.medName} at ${props.dueLabel}` : 'All doses done today'}
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 14,
        borderRadius: 22,
        backgroundColor: c.surface,
      }}
    >
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent', justifyContent: 'space-between' }}>
        <TextWidget text="NEXT DOSE" style={{ fontSize: 11, fontWeight: '600', color: c.textSecondary, letterSpacing: 0.08 }} />
        <FlexWidget style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
          <SvgWidget svg={ring(props.todayTaken, props.todayTotal, c)} style={{ width: 40, height: 40 }} />
        </FlexWidget>
      </FlexWidget>
      <FlexWidget style={{ flexDirection: 'column', flexGap: 2, width: 'match_parent' }}>
        <TextWidget
          text={hasNext ? (props.medName ?? '') : 'All done'}
          maxLines={2}
          truncate="END"
          style={{ fontSize: 18, fontWeight: 'bold', color: c.text }}
        />
        <TextWidget text={subtitle} maxLines={1} truncate="END" style={{ fontSize: 13, color: c.accentText }} />
        <TextWidget text={`${progressLabel} today`} style={{ fontSize: 12, color: c.textSecondary }} />
      </FlexWidget>
    </FlexWidget>
  );
}
