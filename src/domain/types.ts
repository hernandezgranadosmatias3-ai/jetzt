/**
 * Domain model. Everything in `src/domain` is pure TypeScript without React Native
 * imports, so the planning rules can be unit-tested and reused from background tasks.
 *
 * Times of day are stored as wall-clock minutes after local midnight (0–1439).
 * They are only turned into absolute timestamps at the moment something is scheduled
 * with the operating system (see `time.ts#atMinutes`). This keeps the plan stable
 * across daylight-saving changes and time-zone changes.
 */

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Local calendar date, `YYYY-MM-DD`. */
export type DateKey = string;

export type CategoryId =
  | 'morning'
  | 'school'
  | 'nutrition'
  | 'health'
  | 'movement'
  | 'learning'
  | 'business'
  | 'leisure'
  | 'evening'
  | 'sleep';

export type PlaceEvent = 'enter' | 'exit';

export interface TaskReminder {
  enabled: boolean;
  /** Minutes before the start. 0 = at the start. */
  offset: number;
  /** Custom notification text. Falls back to a category default. */
  message?: string;
}

export interface TaskTrigger {
  placeId: string;
  event: PlaceEvent;
}

export interface TaskTemplate {
  id: string;
  title: string;
  description: string;
  category: CategoryId;
  /** Minutes after midnight. */
  start: number;
  /** Planned duration in minutes. 0 = a point in time (e.g. bedtime). */
  duration: number;
  /** Weekdays on which the task repeats. Ignored when `date` is set. */
  days: Weekday[];
  /** One-off task for a single date. */
  date?: DateKey;
  reminder: TaskReminder;
  /** Whether the task offers a countdown timer. */
  timer: boolean;
  /** Optional place-based trigger (e.g. arriving home starts this task). */
  trigger?: TaskTrigger;
  /** Fixed appointment (school, doctor…): never moved without asking. */
  fixed: boolean;
  /** The task that defines the wake-up time of its days. */
  isWakeUp?: boolean;
  /** Paused tasks are hidden from the plan up to and including this date. */
  pausedUntil?: DateKey;
  /** Soft delete: keeps statistics of past days intact. */
  deletedAt?: number;
  createdAt: number;
}

export type InstanceStatus = 'pending' | 'active' | 'done' | 'skipped';

/** What happened to one task on one specific day. */
export interface InstanceState {
  status: InstanceStatus;
  /** Start override for this day (minutes after midnight). */
  start?: number;
  /** Duration override for this day (minutes). */
  duration?: number;
  /** Total minutes this instance was moved later (for statistics). */
  shiftedBy?: number;
  /** Total minutes added via "Verlängern". */
  extendedBy?: number;
  startedAt?: number;
  completedAt?: number;
  /** Minutes actually spent, measured by the timer. */
  actualMinutes?: number;
  /** Carried over to another day (then status is 'skipped'). */
  movedTo?: DateKey;
}

export interface TimerState {
  taskId: string;
  /** Epoch ms when the current run started, or null while paused. */
  runningSince: number | null;
  /** Milliseconds accumulated in earlier runs (before pauses). */
  elapsedBeforeMs: number;
  /** Total planned milliseconds including extensions. */
  plannedMs: number;
}

export interface PlaceEventRecord {
  placeId: string;
  event: PlaceEvent;
  at: number;
  /** 'geofence' = detected automatically, 'manual' = confirmed by the user. */
  source: 'geofence' | 'manual';
}

/** A proposed change to today's plan that still needs the user's decision. */
export interface PendingAdjustment {
  id: string;
  reason: 'late-arrival' | 'extension' | 'conflict';
  title: string;
  message: string;
  changes: PlanChange[];
  /** Fixed appointments that would move if the proposal is applied. */
  fixedTitles: string[];
  createdAt: number;
}

export interface PlanChange {
  taskId: string;
  from: number;
  to: number;
}

export interface UndoEntry {
  label: string;
  at: number;
  /** Previous instance states of all touched tasks. */
  before: Record<string, InstanceState | undefined>;
}

export interface DayRecord {
  date: DateKey;
  instances: Record<string, InstanceState>;
  /** Task ids planned for this day, frozen once the day is over. */
  plannedIds?: string[];
  timer?: TimerState | null;
  events: PlaceEventRecord[];
  pending?: PendingAdjustment | null;
  undo?: UndoEntry | null;
  /** Conflicts the user chose to keep (`taskA|taskB`). */
  ignoredConflicts?: string[];
  reviewedAt?: number;
}

export interface Place {
  id: string;
  name: string;
  kind: 'home' | 'school' | 'other';
  latitude: number;
  longitude: number;
  /** Geofence radius in metres. */
  radius: number;
  notifyOnEnter: boolean;
  notifyOnExit: boolean;
  enabled: boolean;
  address?: string;
}

export type SoundId = 'default' | 'sanft' | 'glocke' | 'klar';

export interface AlarmDay {
  enabled: boolean;
  /** 'routine' = follow the wake-up task of that weekday, 'custom' = own time. */
  mode: 'routine' | 'custom';
  time: number;
}

export type AlarmException = { off: true } | { off?: false; time: number };

export interface AlarmSettings {
  enabled: boolean;
  days: Record<Weekday, AlarmDay>;
  /** One-off changes for single dates. */
  exceptions: Record<DateKey, AlarmException>;
  sound: SoundId;
  snoozeMinutes: number;
  label: string;
}

export interface QuietHours {
  enabled: boolean;
  start: number;
  end: number;
}

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  notifications: {
    enabled: boolean;
    quiet: QuietHours;
    /** Remind again when a task is still open after its end. */
    followUps: boolean;
    snoozeMinutes: number;
  };
  location: {
    enabled: boolean;
  };
  /** Shift following tasks automatically unless fixed appointments move. */
  autoAdjust: boolean;
}

export interface Profile {
  name: string;
}

export interface Routine {
  version: number;
  onboarded: boolean;
  profile: Profile;
  tasks: TaskTemplate[];
  places: Place[];
  settings: Settings;
  alarm: AlarmSettings;
}
