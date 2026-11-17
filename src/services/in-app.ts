/**
 * In-app notices: a small banner at the top of the app. Used by the web version,
 * where reminders are shown while the app is open (browsers cannot schedule
 * notifications for later).
 */
export interface InAppNotice {
  id: number;
  title: string;
  body: string;
}

type Listener = (notice: InAppNotice) => void;

const listeners = new Set<Listener>();
let counter = 0;

export function showInAppNotice(title: string, body: string) {
  const notice = { id: ++counter, title, body };
  listeners.forEach((l) => l(notice));
}

export function subscribeInAppNotices(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
