// MarketFlow Demo — Rustic Black & Gold Design System
export const Colors = {
  // Brand Gold
  primary: '#C9A84C',
  primaryLight: '#E8C96A',
  primaryDark: '#A8882E',
  primarySurface: 'rgba(201,168,76,0.12)',

  // Accent Red (from logo ribbon)
  secondary: '#B03030',
  secondaryLight: '#D04040',
  secondarySurface: 'rgba(176,48,48,0.12)',

  // Base — Dark rustic palette
  background: '#0D0D0D',
  surface: '#1A1A1A',
  surfaceElevated: '#222222',
  border: '#2E2A22',
  borderLight: '#252017',

  // Text
  textPrimary: '#F5F0E8',
  textSecondary: '#B8A882',
  textMuted: '#6B6050',
  textInverse: '#0D0D0D',
  textOnPrimary: '#0D0D0D',

  // Semantic
  success: '#6BA368',
  successSurface: 'rgba(107,163,104,0.15)',
  warning: '#C9943C',
  warningSurface: 'rgba(201,148,60,0.15)',
  error: '#CF6679',
  errorSurface: 'rgba(207,102,121,0.15)',
  info: '#5B8DD9',
  infoSurface: 'rgba(91,141,217,0.15)',

  // Status Orders
  statusPending: '#C9943C',
  statusConfirmed: '#5B8DD9',
  statusPreparing: '#9B72CF',
  statusOutForDelivery: '#4AABB8',
  statusDelivered: '#6BA368',
  statusCancelled: '#CF6679',

  // Admin — slightly lighter dark
  adminBackground: '#111111',
  adminSurface: '#1C1C1C',
  adminBorder: '#2A2620',
  adminText: '#F0EBE0',
  adminTextMuted: '#7A6F5A',

  // Gold gradient helpers
  gold: '#C9A84C',
  goldLight: '#E8C96A',
  goldDark: '#8A6E28',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 999,
};

export const FontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  display: 28,
};

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 12,
  },
  gold: {
    shadowColor: '#C9A84C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
};
