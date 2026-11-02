import { ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { colores } from '@/theme/tokens';

/** Logo de la I.E. subido en el panel; si no hay (o no carga), el escudo del diseño. */
export function LogoInstitucion({ url, tam = 56 }: { url: string | null | undefined; tam?: number }) {
  const [fallo, setFallo] = useState(false);
  const radio = Math.round(tam * 0.29);
  if (url && !fallo) {
    return (
      <Image
        source={{ uri: url }}
        onError={() => setFallo(true)}
        style={[s.imagen, { width: tam, height: tam, borderRadius: radio }]}
        resizeMode="contain"
        accessibilityLabel="Logo de la institución"
      />
    );
  }
  return (
    <View style={[s.escudo, { width: tam, height: tam, borderRadius: radio }]} accessibilityElementsHidden>
      <ShieldCheck size={Math.round(tam / 2)} color={colores.textOnInk} />
    </View>
  );
}

const s = StyleSheet.create({
  imagen: { backgroundColor: colores.surface },
  escudo: { backgroundColor: colores.ink, alignItems: 'center', justifyContent: 'center' },
});
