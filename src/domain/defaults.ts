import { ALL_DAYS, SCHOOL_DAYS, WEEKEND } from './time';
import type { AlarmSettings, CategoryId, Routine, Settings, TaskTemplate, Weekday } from './types';

export const ROUTINE_VERSION = 1;
export const HOME_PLACE_ID = 'home';
export const SCHOOL_PLACE_ID = 'school';

const t = (h: number, m: number) => h * 60 + m;

type Seed = {
  id: string;
  title: string;
  description?: string;
  category: CategoryId;
  start: number;
  duration: number;
  days: Weekday[];
  message?: string;
  reminder?: boolean;
  timer?: boolean;
  fixed?: boolean;
  isWakeUp?: boolean;
  trigger?: TaskTemplate['trigger'];
};

const SEEDS: Seed[] = [
  // Schultage
  { id: 'wake-school', title: 'Aufstehen', category: 'morning', start: t(6, 20), duration: 20, days: SCHOOL_DAYS, isWakeUp: true, reminder: false, message: 'Guten Morgen! Zeit aufzustehen.', description: 'Fenster auf, ein Glas Wasser trinken.' },
  { id: 'breakfast-school', title: 'Frühstück', category: 'nutrition', start: t(6, 40), duration: 20, days: SCHOOL_DAYS, message: 'Frühstückszeit!' },
  { id: 'getready', title: 'Fertigmachen', category: 'morning', start: t(7, 0), duration: 30, days: SCHOOL_DAYS, message: 'Zeit, dich fertig zu machen.', description: 'Tasche, Kleidung, Zähne putzen.' },
  { id: 'school', title: 'Schule', category: 'school', start: t(7, 30), duration: 480, days: SCHOOL_DAYS, fixed: true, message: 'Ab in die Schule. Hab einen guten Tag!', trigger: { placeId: HOME_PLACE_ID, event: 'exit' } },
  { id: 'home', title: 'Nach Hause kommen', category: 'leisure', start: t(16, 0), duration: 30, days: SCHOOL_DAYS, message: 'Willkommen zu Hause! Zeit für eine kurze Pause. Danach stehen deine Hausaufgaben an.', description: 'Kurze Pause, etwas trinken, ankommen.', trigger: { placeId: HOME_PLACE_ID, event: 'enter' } },
  { id: 'homework', title: 'Hausaufgaben', category: 'school', start: t(16, 30), duration: 60, days: SCHOOL_DAYS, timer: true, message: 'Zeit für deine Hausaufgaben.', description: 'Konzentriere dich auf deine schulischen Aufgaben.' },
  { id: 'walk', title: 'Spaziergang und Meditation', category: 'movement', start: t(17, 30), duration: 60, days: SCHOOL_DAYS, timer: true, message: 'Zeit für Bewegung und frische Luft.', description: '30 Minuten gehen, 10 Minuten bewusst atmen.' },
  { id: 'dinner', title: 'Abendessen', category: 'nutrition', start: t(18, 30), duration: 30, days: ALL_DAYS, message: 'Zeit fürs Abendessen.' },
  { id: 'study', title: 'Lernen', category: 'learning', start: t(19, 0), duration: 90, days: SCHOOL_DAYS, timer: true, message: 'Deine Lernzeit beginnt.', description: 'Stoff wiederholen, Vokabeln, Prüfungen vorbereiten.' },
  { id: 'business', title: 'Business / eigene Projekte', category: 'business', start: t(20, 30), duration: 30, days: SCHOOL_DAYS, timer: true, message: 'Zeit für deine eigenen Projekte.' },
  { id: 'prepare', title: 'Vorbereitung für morgen', category: 'evening', start: t(21, 0), duration: 30, days: [7, 1, 2, 3, 4], message: 'Bereite alles für morgen vor.', description: 'Tasche packen, Kleidung rauslegen, Plan ansehen.' },
  { id: 'evening', title: 'Abendroutine', category: 'evening', start: t(21, 30), duration: 30, days: ALL_DAYS, message: 'Zeit, zur Ruhe zu kommen.', description: 'Bildschirm weg, lesen, Zähne putzen.' },
  { id: 'sleep', title: 'Schlafenszeit', category: 'sleep', start: t(22, 0), duration: 0, days: ALL_DAYS, fixed: true, message: 'Schlafenszeit. Gute Nacht!' },
  // Wochenende
  { id: 'wake-weekend', title: 'Aufstehen', category: 'morning', start: t(8, 30), duration: 30, days: WEEKEND, isWakeUp: true, reminder: false, message: 'Guten Morgen! Zeit aufzustehen.' },
  { id: 'breakfast-weekend', title: 'Frühstück', category: 'nutrition', start: t(9, 0), duration: 30, days: WEEKEND, message: 'Frühstückszeit!' },
  { id: 'sport-weekend', title: 'Sport', category: 'movement', start: t(10, 30), duration: 60, days: WEEKEND, timer: true, message: 'Zeit für Bewegung.' },
  { id: 'lunch-weekend', title: 'Mittagessen', category: 'nutrition', start: t(12, 30), duration: 45, days: WEEKEND, message: 'Zeit fürs Mittagessen.' },
  { id: 'study-weekend', title: 'Lernen', category: 'learning', start: t(15, 0), duration: 60, days: WEEKEND, timer: true, message: 'Deine Lernzeit beginnt.' },
  { id: 'free-weekend', title: 'Freizeit', category: 'leisure', start: t(16, 0), duration: 120, days: WEEKEND, reminder: false, description: 'Freunde, Hobbys, nichts müssen.' },
];

export function defaultTasks(now = Date.now()): TaskTemplate[] {
  return SEEDS.map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description ?? '',
    category: s.category,
    start: s.start,
    duration: s.duration,
    days: s.days,
    reminder: { enabled: s.reminder ?? true, offset: 0, message: s.message },
    timer: s.timer ?? false,
    trigger: s.trigger,
    fixed: s.fixed ?? false,
    isWakeUp: s.isWakeUp,
    createdAt: now,
  }));
}

export function defaultSettings(): Settings {
  return {
    theme: 'system',
    notifications: {
      enabled: true,
      quiet: { enabled: true, start: t(22, 15), end: t(6, 0) },
      followUps: true,
      snoozeMinutes: 10,
    },
    location: { enabled: false },
    autoAdjust: true,
  };
}

export function defaultAlarm(): AlarmSettings {
  const routine = { enabled: true, mode: 'routine' as const, time: t(6, 20) };
  return {
    enabled: true,
    days: {
      1: { ...routine },
      2: { ...routine },
      3: { ...routine },
      4: { ...routine },
      5: { ...routine },
      6: { enabled: true, mode: 'routine', time: t(8, 30) },
      7: { enabled: true, mode: 'routine', time: t(8, 30) },
    },
    exceptions: {},
    sound: 'sanft',
    snoozeMinutes: 9,
    label: 'Guten Morgen',
  };
}

export function defaultRoutine(): Routine {
  return {
    version: ROUTINE_VERSION,
    onboarded: false,
    profile: { name: '' },
    tasks: defaultTasks(),
    places: [],
    settings: defaultSettings(),
    alarm: defaultAlarm(),
  };
}
