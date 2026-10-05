// Notification actions as status actions (used by every live-status platform file).
import { addNotificationResponseListener } from './notifications';
import type { StatusActionListener } from './live-status.types';

export function notificationStatusListener(listener: StatusActionListener): () => void {
  return addNotificationResponseListener((e) => {
    if (e.action === 'open') return;
    listener({ action: e.action, doseId: e.doseIds[0], doseIds: e.doseIds, source: 'notification' });
  });
}
