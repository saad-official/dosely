// Icon vocabulary: every icon is an SF Symbol on iOS and a Material Symbol on Android (one family per
// platform). Names are checked at compile time by expo-symbols' types.
import type { MedIcon } from '@dosely/shared';
import type { SymbolViewProps } from 'expo-symbols';

export type SfName = Extract<SymbolViewProps['name'], string>;
export type MdName = NonNullable<Exclude<SymbolViewProps['name'], string>['android']>;
export type IconName = { sf: SfName; md: MdName };

export const icons = {
  today: { sf: 'pills.fill', md: 'medication' },
  meds: { sf: 'list.bullet.rectangle', md: 'list_alt' },
  history: { sf: 'chart.line.uptrend.xyaxis', md: 'insights' },
  circle: { sf: 'person.2.fill', md: 'group' },
  settings: { sf: 'gearshape.fill', md: 'settings' },
  check: { sf: 'checkmark', md: 'check' },
  checkCircle: { sf: 'checkmark.circle.fill', md: 'check_circle' },
  clock: { sf: 'clock', md: 'schedule' },
  snooze: { sf: 'moon.zzz', md: 'snooze' },
  skip: { sf: 'forward.end', md: 'skip_next' },
  undo: { sf: 'arrow.uturn.backward', md: 'undo' },
  add: { sf: 'plus', md: 'add' },
  close: { sf: 'xmark', md: 'close' },
  chevronForward: { sf: 'chevron.right', md: 'chevron_right' },
  chevronBack: { sf: 'chevron.left', md: 'chevron_left' },
  bell: { sf: 'bell.badge', md: 'notifications_active' },
  bellOff: { sf: 'bell.slash', md: 'notifications_off' },
  share: { sf: 'square.and.arrow.up', md: 'share' },
  trash: { sf: 'trash', md: 'delete' },
  edit: { sf: 'pencil', md: 'edit' },
  archive: { sf: 'archivebox', md: 'archive' },
  unarchive: { sf: 'arrow.up.bin', md: 'unarchive' },
  account: { sf: 'person.crop.circle', md: 'account_circle' },
  personAdd: { sf: 'person.badge.plus', md: 'person_add' },
  warning: { sf: 'exclamationmark.triangle', md: 'warning' },
  info: { sf: 'info.circle', md: 'info' },
  heart: { sf: 'heart.fill', md: 'favorite' },
  shield: { sf: 'lock.shield', md: 'shield_lock' },
  calendar: { sf: 'calendar', md: 'calendar_month' },
  refresh: { sf: 'arrow.clockwise', md: 'refresh' },
  copy: { sf: 'doc.on.doc', md: 'content_copy' },
  streak: { sf: 'checkmark.seal', md: 'verified' },
  palette: { sf: 'paintpalette', md: 'palette' },
  phone: { sf: 'iphone', md: 'smartphone' },
  mail: { sf: 'envelope', md: 'mail' },
  key: { sf: 'key', md: 'key' },
  logout: { sf: 'rectangle.portrait.and.arrow.right', md: 'logout' },
  link: { sf: 'link', md: 'link' },
  refill: { sf: 'arrow.triangle.2.circlepath', md: 'autorenew' },
  database: { sf: 'externaldrive.badge.exclamationmark', md: 'database' },
  moon: { sf: 'moon', md: 'dark_mode' },
  sparkles: { sf: 'sparkles', md: 'auto_awesome' },
  doc: { sf: 'doc.text', md: 'description' },
  lifebuoy: { sf: 'lifepreserver', md: 'support' },
  medical: { sf: 'stethoscope', md: 'stethoscope' },
} as const satisfies Record<string, IconName>;

/** Medication icon choices (`MED_ICONS` in the shared schema). */
export const medIcons: Record<MedIcon, IconName> = {
  pill: { sf: 'pill.fill', md: 'pill' },
  capsule: { sf: 'capsule.fill', md: 'medication' },
  tablet: { sf: 'pills.circle.fill', md: 'circle' },
  bottle: { sf: 'cross.vial.fill', md: 'medication_liquid' },
  syringe: { sf: 'syringe.fill', md: 'vaccines' },
  inhaler: { sf: 'lungs.fill', md: 'pulmonology' },
  drops: { sf: 'drop.fill', md: 'water_drop' },
  patch: { sf: 'bandage.fill', md: 'healing' },
  spoon: { sf: 'fork.knife', md: 'restaurant' },
  heart: { sf: 'heart.fill', md: 'favorite' },
  sun: { sf: 'sun.max.fill', md: 'light_mode' },
  moon: { sf: 'moon.fill', md: 'bedtime' },
};
