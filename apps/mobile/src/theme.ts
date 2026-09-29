import { useColorScheme } from 'react-native';

// Semantic tokens, resolved for light/dark. Components reference roles.
const light = {
  bg: '#f2f4f7',
  panel: '#ffffff',
  surfaceAlt: '#eef1f5',
  line: '#e7ebf0',
  chip: '#f0f3f7',
  fg: '#0b1420',
  muted: '#707a89',
  faint: '#9aa4b2',
  accent: '#0ca678', // emerald
  accentDark: '#0b8c67',
  accentSoft: '#e3f7ef',
  accentFg: '#ffffff',
  ok: '#12b76a',
  warn: '#f79009',
  danger: '#e5484d',
  shadow: '0 6px 20px rgba(16,32,28,0.08)',
  shadowStrong: '0 10px 28px rgba(0,0,0,0.22)',
};

const dark: typeof light = {
  bg: '#0a0e13',
  panel: '#151b22',
  surfaceAlt: '#1c242d',
  line: '#26303b',
  chip: '#1e2731',
  fg: '#e9eef4',
  muted: '#8b96a5',
  faint: '#69737f',
  accent: '#15b886',
  accentDark: '#0ea376',
  accentSoft: '#102b23',
  accentFg: '#04140d',
  ok: '#26c281',
  warn: '#f7a53b',
  danger: '#f2555a',
  shadow: '0 6px 20px rgba(0,0,0,0.35)',
  shadowStrong: '0 10px 28px rgba(0,0,0,0.5)',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'light' ? light : dark;
}

// Deterministic tile color for a product "image" placeholder (used only when
// a product has no photo).
const TILE = ['#0ca678', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#ef4444', '#06b6d4', '#14b8a6'];
export function tileColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return TILE[Math.abs(h) % TILE.length]!;
}
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}
