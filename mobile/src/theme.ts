// ND Group brand palette, pulled from `ndgroup logo/*.svg` (the dark/navy
// lockup variant, since the app commits to a single dark brand theme rather
// than switching between light/dark).
export const colors = {
  background: '#161826',
  surface: '#1E2133',
  surfaceElevated: '#262A40',
  border: '#2E3350',

  gold: '#C9A24A',
  goldMuted: '#8A7038',
  goldDim: '#4A3F26',

  textPrimary: '#E9E9ED',
  textSecondary: '#9397AB',
  textTertiary: '#6B6F82',

  iconGray: '#C3CAD2',
  danger: '#B0473E',
} as const;

export const scoreColor = (score: number): string => {
  if (score >= 10) return colors.gold;
  if (score >= 9) return colors.gold;
  return colors.goldMuted;
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
} as const;
