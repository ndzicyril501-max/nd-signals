export interface Colors {
  background: string;
  headerBg: string;
  surface: string;
  surfaceElevated: string;
  border: string;

  accent: string;
  accentBright: string;
  accentMuted: string;
  accentDim: string;

  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textQuaternary: string;

  iconGray: string;
  neutralLine: string;
  danger: string;
}

// Dark ("Nocturne") ground, recolored from gold to the ND Group EX purple.
export const darkColors: Colors = {
  background: '#161826',
  headerBg: '#1a1d2e',
  surface: '#1e2133',
  surfaceElevated: '#232742',
  border: '#2e3350',

  accent: '#a78bfa',
  accentBright: '#c4b5fd',
  accentMuted: '#7c3aed',
  accentDim: '#2e1065',

  textPrimary: '#e9e9ed',
  textSecondary: '#9397ab',
  textTertiary: '#75798c',
  textQuaternary: '#6b6f82',

  iconGray: '#c3cad2',
  neutralLine: '#595d6c',
  danger: '#b0473e',
};

// Light ground matching the ND Group EX exchange site: lavender-white
// background, near-black headings, deep vivid purple accent.
export const lightColors: Colors = {
  background: '#f7f5fb',
  headerBg: '#ffffff',
  surface: '#ffffff',
  surfaceElevated: '#f1edfb',
  border: '#e3ddf2',

  accent: '#6d28d9',
  accentBright: '#7c3aed',
  accentMuted: '#a78bfa',
  accentDim: '#ede9fe',

  textPrimary: '#161221',
  textSecondary: '#5b5770',
  textTertiary: '#7d7891',
  textQuaternary: '#9a95ac',

  // Inverted role from dark mode's `iconGray` -- this one has to stay dark
  // to be legible against a white surface.
  iconGray: '#514c66',
  neutralLine: '#c7c2d9',
  danger: '#c1443a',
};

export const fonts = {
  mono: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
  monoRegular: 'JetBrainsMono_400Regular',
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemiBold: 'Inter_600SemiBold',
  sansBold: 'Inter_700Bold',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
} as const;

export function scoreTier(score: number, colors: Colors): { fg: string; border: string; bg: string; glow: boolean } {
  if (score >= 10) return { fg: colors.accent, border: colors.accent, bg: withAlpha(colors.accent, 0.15), glow: true };
  if (score >= 9) return { fg: colors.accent, border: colors.accent, bg: withAlpha(colors.accent, 0.15), glow: false };
  if (score >= 8) return { fg: colors.accent, border: colors.accentMuted, bg: withAlpha(colors.accentMuted, 0.12), glow: false };
  return { fg: colors.textSecondary, border: colors.neutralLine, bg: 'transparent', glow: false };
}

// "#rrggbb" -> "rgba(r,g,b,alpha)". Used to keep baked-in translucency
// effects (borders, tinted backgrounds) theme-reactive instead of frozen
// to whatever hex the effect was first written against.
export function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
