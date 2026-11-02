import { router } from 'expo-router';

import { PantallaEscaner } from '@/escaner/PantallaEscaner';

/** 05 · Escáner QR en modo puerta: registra a cualquier estudiante del turno que el usuario pueda marcar. */
export default function EscanearPuerta() {
  return (
    <PantallaEscaner
      modo="PUERTA"
      seccionId={null}
      etiqueta="Ingreso · Puerta principal"
      alCerrar={() => router.navigate('/')}
    />
  );
}
