// Tokens del diseño (sección 4 de la especificación). Mismos valores que el panel web.

export const colores = {
  ink: '#14213D',
  inkDeep: '#0B1427',
  bg: '#F4F3EE',
  surface: '#FFFFFF',
  textMuted: '#4B5565',
  textSubtle: '#5A6478',
  textOnBtn: '#3F4859',
  textOnInk: '#F4F3EE',
  textOnInkMuted: '#C9CEDA',
  borderOnInk: '#3A4766',
  border: '#E4E2DA',
  borderInput: '#D6D3C8',
  borderDashed: '#B9B5A8',
  neutralChip: '#ECEAE2',
  disabled: '#9AA1AE',
  overlay: 'rgba(11, 20, 39, 0.55)',
  scanBg: '#1A2336',
  scanGrid: '#232D42',
  scanOk: '#3FBF7F',
} as const;

export type Estado = 'P' | 'T' | 'F' | 'J';
export const ESTADOS: Estado[] = ['P', 'T', 'F', 'J'];

/** Siempre estos 4 y en este orden: P · T · F · J. */
export const estados: Record<
  Estado,
  { nombre: string; corto: string; solido: string; punto: string; chipBg: string; chipFg: string }
> = {
  P: { nombre: 'Presente', corto: 'Presente', solido: '#1E7A4C', punto: '#1E7A4C', chipBg: '#E3F1E8', chipFg: '#17603B' },
  T: { nombre: 'Tarde', corto: 'Tarde', solido: '#A35505', punto: '#B45F06', chipBg: '#FBEEDB', chipFg: '#8A4A05' },
  F: { nombre: 'Falta', corto: 'Falta', solido: '#B42318', punto: '#B42318', chipBg: '#FBE4E1', chipFg: '#9A1F15' },
  J: { nombre: 'Justificado', corto: 'Justif.', solido: '#2453A6', punto: '#2453A6', chipBg: '#E2EAF7', chipFg: '#1E4590' },
};

export const estadoSeccion = {
  COMPLETA: { texto: 'Completa', bg: '#E3F1E8', fg: '#17603B' },
  EN_CURSO: { texto: 'En curso', bg: '#FBEEDB', fg: '#8A4A05' },
  PENDIENTE: { texto: 'Pendiente', bg: '#ECEAE2', fg: '#4B5565' },
} as const;

export const radios = { input: 12, boton: 14, tarjeta: 18, estado: 10, pildora: 999 } as const;
export const alturas = { input: 52, boton: 54, estado: 44, redondo: 44 } as const;

export const fuentes = {
  titulo: 'BricolageGrotesque_700Bold',
  regular: 'Figtree_400Regular',
  medio: 'Figtree_500Medium',
  semi: 'Figtree_600SemiBold',
  negrita: 'Figtree_700Bold',
} as const;
