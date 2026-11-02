// Diseño adaptable: en teléfonos ocupa todo el ancho; en tablets y web se centra
// con un ancho máximo cómodo de leer.
import type { ReactNode } from 'react';
import { useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';

export const ANCHOS = { texto: 480, formulario: 640, contenido: 900, amplio: 1200 } as const;

export function useDisposicion() {
  const { width, height } = useWindowDimensions();
  return {
    ancho: width,
    alto: height,
    esTablet: width >= 768,
    columnasTarjetas: width >= 1100 ? 3 : width >= 720 ? 2 : 1,
  };
}

/** Estilo para `contentContainerStyle` de listas: centra y limita el ancho. */
export function centrado(maximo: number = ANCHOS.contenido): ViewStyle {
  return { width: '100%', maxWidth: maximo, alignSelf: 'center' };
}

export function Contenedor({
  children, maximo = ANCHOS.contenido, style,
}: { children: ReactNode; maximo?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[centrado(maximo), style]}>{children}</View>;
}
