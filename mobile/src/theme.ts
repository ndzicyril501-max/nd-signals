// ND Group brand palette + component tokens, matched to the Claude Design
// mockup ("ND Signals App.dc.html" — Nocturne dark ground, ND gold accent).
export const colors = {
  background: '#161826',
  headerBg: '#1a1d2e',
  surface: '#1e2133',
  surfaceMuted: '#1c1e2c',
  surfaceElevated: '#232742',
  border: '#2e3350',

  gold: '#c9a24a',
  goldBright: '#dcb865',
  goldMuted: '#8a7038',
  goldDim: '#4a3f26',

  textPrimary: '#e9e9ed',
  textSecondary: '#9397ab',
  textTertiary: '#75798c',
  textQuaternary: '#6b6f82',

  iconGray: '#c3cad2',
  neutralLine: '#595d6c',
  danger: '#b0473e',
  dangerMuted: '#8a5b55',
} as const;

// Tiered exactly as the mockup's "SCORE BADGE — 7 -> 10" component sheet.
export const scoreTier = (score: number): { fg: string; border: string; bg: string; glow: boolean } => {
  if (score >= 10) return { fg: colors.gold, border: colors.gold, bg: 'rgba(201,162,74,0.15)', glow: true };
  if (score >= 9) return { fg: colors.gold, border: colors.gold, bg: 'rgba(201,162,74,0.15)', glow: false };
  if (score >= 8) return { fg: colors.gold, border: colors.goldMuted, bg: 'rgba(138,112,56,0.12)', glow: false };
  return { fg: colors.textSecondary, border: colors.neutralLine, bg: 'transparent', glow: false };
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
