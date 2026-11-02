import { CloudUpload, WifiOff } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { useSync } from '@/store/sync';
import { estados, fuentes } from '@/theme/tokens';
import { plural } from '@/utils/texto';

/** "Sin conexión · 12 marcas por enviar" (se oculta si todo está enviado). */
export function BannerConexion() {
  const online = useSync((s) => s.online);
  const pendientes = useSync((s) => s.pendientes);
  if (online && pendientes === 0) return null;
  const texto = online
    ? `Enviando · ${plural(pendientes, 'marca')} por enviar`
    : `Sin conexión${pendientes ? ` · ${plural(pendientes, 'marca')} por enviar` : ' · tus marcas se guardan en el teléfono'}`;
  return (
    <View
      style={[s.banda, online ? s.enviando : s.offline]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      {online ? <CloudUpload size={18} color={estados.J.chipFg} /> : <WifiOff size={18} color={estados.T.chipFg} />}
      <Text style={[s.texto, { color: online ? estados.J.chipFg : estados.T.chipFg }]}>{texto}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  banda: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  offline: { backgroundColor: estados.T.chipBg },
  enviando: { backgroundColor: estados.J.chipBg },
  texto: { flex: 1, fontFamily: fuentes.semi, fontSize: 14 },
});
