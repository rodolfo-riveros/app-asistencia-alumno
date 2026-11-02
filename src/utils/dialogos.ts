// Alert de React Native no muestra botones en web: ahí usamos los diálogos del navegador.
import { Alert, Platform } from 'react-native';

export function avisar(titulo: string, mensaje?: string) {
  if (Platform.OS === 'web') {
    globalThis.alert?.(mensaje ? `${titulo}\n\n${mensaje}` : titulo);
    return;
  }
  Alert.alert(titulo, mensaje);
}

export function confirmar(titulo: string, mensaje: string, textoOk = 'Aceptar', destructivo = false): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(globalThis.confirm?.(`${titulo}\n\n${mensaje}`) ?? false);
  }
  return new Promise((resolver) => {
    Alert.alert(titulo, mensaje, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolver(false) },
      { text: textoOk, style: destructivo ? 'destructive' : 'default', onPress: () => resolver(true) },
    ], { cancelable: true, onDismiss: () => resolver(false) });
  });
}
