import { useColorScheme } from 'react-native';

import { useStore } from '@/data/store';

/**
 * Colour tokens. Light mode follows the iOS grouped style (light grey ground, white
 * cards); dark mode uses true black with raised grey cards. One calm green accent,
 * a dark blue for secondary emphasis.
 */
const light = {
  bg: '#F2F2F7',
  card: '#FFFFFF',
  cardPressed: '#EDEDF0',
  text: '#1C1C1E',
  text2: '#6C6C70',
  text3: '#A1A1A6',
  separator: 'rgba(60,60,67,0.13)',
  fill: 'rgba(120,120,128,0.12)',
  fillStrong: 'rgba(120,120,128,0.2)',
  accent: '#1F7A57',
  accentSoft: '#E4F1EA',
  onAccent: '#FFFFFF',
  blue: '#25467A',
  blueSoft: '#E7ECF4',
  warn: '#A8621A',
  warnSoft: '#FAEEDC',
  danger: '#C9372C',
  dangerSoft: '#FBE7E5',
  ring: 'rgba(120,120,128,0.16)',
};

const dark: typeof light = {
  bg: '#000000',
  card: '#1C1C1E',
  cardPressed: '#2C2C2E',
  text: '#F5F5F7',
  text2: '#9A9AA1',
  text3: '#636368',
  separator: 'rgba(84,84,88,0.55)',
  fill: 'rgba(120,120,128,0.24)',
  fillStrong: 'rgba(120,120,128,0.36)',
  accent: '#43C08D',
  accentSoft: 'rgba(67,192,141,0.16)',
  onAccent: '#03150D',
  blue: '#8FAEDF',
  blueSoft: 'rgba(143,174,223,0.16)',
  warn: '#E6A55C',
  warnSoft: 'rgba(230,165,92,0.16)',
  danger: '#FF6B5F',
  dangerSoft: 'rgba(255,107,95,0.16)',
  ring: 'rgba(120,120,128,0.28)',
};

export type Colors = typeof light;
export const palettes = { light, dark };

export const radius = { sm: 10, md: 14, lg: 20, xl: 26 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };

/** iOS text styles (size / line height / weight). */
export const type = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700' as const, letterSpacing: 0.37 },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const, letterSpacing: 0.36 },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const, letterSpacing: 0.35 },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: '600' as const, letterSpacing: 0.38 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' as const, letterSpacing: -0.41 },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400' as const, letterSpacing: -0.41 },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400' as const, letterSpacing: -0.32 },
  subhead: { fontSize: 15, lineHeight: 20, fontWeight: '400' as const, letterSpacing: -0.24 },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const, letterSpacing: -0.08 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' as const, letterSpacing: 0 },
  overline: { fontSize: 12, lineHeight: 16, fontWeight: '600' as const, letterSpacing: 0.6 },
};

export type TypeName = keyof typeof type;

export function useScheme(): 'light' | 'dark' {
  const system = useColorScheme();
  const pref = useStore((s) => s.routine.settings.theme);
  if (pref === 'light' || pref === 'dark') return pref;
  return system === 'dark' ? 'dark' : 'light';
}

export function useColors(): Colors {
  return palettes[useScheme()];
}
