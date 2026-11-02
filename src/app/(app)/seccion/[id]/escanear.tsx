import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { metaNomina } from '@/db/asistencia';
import { cerrarEscaner, PantallaEscaner } from '@/escaner/PantallaEscaner';

/** 05 · Escáner QR en modo sección (botón "QR" del pase de lista). */
export default function EscanearSeccion() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const seccionId = Number(id);
  const [nombre, setNombre] = useState('Sección');

  useEffect(() => {
    void metaNomina().then((m) => {
      const s = m?.secciones.find((x) => x.id === seccionId);
      if (s) setNombre(s.nombre_corto);
    });
  }, [seccionId]);

  return <PantallaEscaner modo="SECCION" seccionId={seccionId} etiqueta={`${nombre} · Ingreso`} alCerrar={cerrarEscaner} />;
}
