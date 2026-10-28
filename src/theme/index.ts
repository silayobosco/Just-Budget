export interface ThemeColors {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;

  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;

  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;

  background: string;
  onBackground: string;
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;

  outline: string;
  outlineVariant: string;

  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;

  success: string;
  onSuccess: string;
  successContainer: string;
  onSuccessContainer: string;

  cardBg: string;
  heroBg: string;
  pillBg: string;
  divider: string;
}

export const lightTheme: ThemeColors = {
  primary: '#5B4EB5', // Expressive Indigo / Purple
  onPrimary: '#FFFFFF',
  primaryContainer: '#E5DFFF',
  onPrimaryContainer: '#170065',

  secondary: '#735472',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#FED7F9',
  onSecondaryContainer: '#2B122C',

  tertiary: '#006A6A',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#6FF7F6',
  onTertiaryContainer: '#002020',

  background: '#FBF8FD',
  onBackground: '#1C1B1F',
  surface: '#FFFFFF',
  onSurface: '#1C1B1F',
  surfaceVariant: '#E7E0EB',
  onSurfaceVariant: '#49454E',

  outline: '#7A757F',
  outlineVariant: '#CAC4CF',

  error: '#BA1A1A',
  onError: '#FFFFFF',
  errorContainer: '#FFDAD6',
  onErrorContainer: '#410002',

  success: '#1A7A4C',
  onSuccess: '#FFFFFF',
  successContainer: '#CEF5DC',
  onSuccessContainer: '#002110',

  cardBg: '#FFFFFF',
  heroBg: '#F3EFFF',
  pillBg: '#EDE7F6',
  divider: '#E4DFE8',
};

export const darkTheme: ThemeColors = {
  primary: '#C9BFFF',
  onPrimary: '#2D1785',
  primaryContainer: '#44359C',
  onPrimaryContainer: '#E5DFFF',

  secondary: '#E1BBDD',
  onSecondary: '#412742',
  secondaryContainer: '#593D5A',
  onSecondaryContainer: '#FED7F9',

  tertiary: '#4DDAD9',
  onTertiary: '#003737',
  tertiaryContainer: '#004F4F',
  onTertiaryContainer: '#6FF7F6',

  background: '#131216',
  onBackground: '#E6E1E6',
  surface: '#1D1B20',
  onSurface: '#E6E1E6',
  surfaceVariant: '#48454D',
  onSurfaceVariant: '#CBC4CF',

  outline: '#948F99',
  outlineVariant: '#49454E',

  error: '#FFB4AB',
  onError: '#690005',
  errorContainer: '#93000A',
  onErrorContainer: '#FFDAD6',

  success: '#7ED8A0',
  onSuccess: '#00391E',
  successContainer: '#00522E',
  onSuccessContainer: '#CEF5DC',

  cardBg: '#211F26',
  heroBg: '#2A243D',
  pillBg: '#2C2836',
  divider: '#312E38',
};

export const M3Shape = {
  none: 0,
  extraSmall: 4,
  small: 8,
  medium: 14,
  large: 20,
  extraLarge: 28,
  full: 9999, // Pill shape
};

export const M3Elevation = {
  level0: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  level1: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  level2: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  level3: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
  },
};
