import type { CategoryId } from './types';

export interface CategoryInfo {
  id: CategoryId;
  label: string;
  /** Muted tint used for dots and small accents. */
  color: string;
  /** SF Symbol (iOS). */
  sf: string;
  /** Material Symbol (Android). */
  md: string;
  /** Default reminder text when a task has none. */
  message: (title: string) => string;
}

export const CATEGORIES: CategoryInfo[] = [
  { id: 'morning', label: 'Morgenroutine', color: '#D9963A', sf: 'sunrise', md: 'wb_twilight', message: (t) => `Guten Morgen! ${t} steht an.` },
  { id: 'school', label: 'Schule', color: '#5767C9', sf: 'graduationcap', md: 'school', message: (t) => `Zeit für: ${t}.` },
  { id: 'nutrition', label: 'Ernährung', color: '#D7743A', sf: 'fork.knife', md: 'restaurant', message: (t) => `${t} – guten Appetit!` },
  { id: 'health', label: 'Gesundheit', color: '#CF5668', sf: 'heart', md: 'favorite', message: (t) => `Zeit für deine Gesundheit: ${t}.` },
  { id: 'movement', label: 'Sport und Bewegung', color: '#3A9A63', sf: 'figure.walk', md: 'directions_walk', message: () => 'Zeit für Bewegung und frische Luft.' },
  { id: 'learning', label: 'Lernen', color: '#3A7DBF', sf: 'book', md: 'menu_book', message: () => 'Deine Lernzeit beginnt.' },
  { id: 'business', label: 'Business und Projekte', color: '#8160C8', sf: 'briefcase', md: 'work', message: () => 'Zeit für deine eigenen Projekte.' },
  { id: 'leisure', label: 'Freizeit', color: '#2A9C9A', sf: 'leaf', md: 'spa', message: (t) => `Zeit für ${t}.` },
  { id: 'evening', label: 'Abendroutine', color: '#6B66A6', sf: 'sunset', md: 'nights_stay', message: () => 'Zeit, zur Ruhe zu kommen.' },
  { id: 'sleep', label: 'Schlaf', color: '#4A5677', sf: 'moon.zzz', md: 'bedtime', message: () => 'Schlafenszeit. Gute Nacht!' },
];

const BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<CategoryId, CategoryInfo>;

export function category(id: CategoryId): CategoryInfo {
  return BY_ID[id] ?? BY_ID.leisure;
}
