import { router, useFocusEffect } from 'expo-router';
import { ChevronRight, Search } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ANCHOS, Contenedor, centrado } from '@/components/Contenedor';
import { Avatar } from '@/components/ui';
import { metaNomina, todosLosEstudiantes, type EstudianteNominaLocal } from '@/db/asistencia';
import { colores, fuentes, radios } from '@/theme/tokens';
import { coincide } from '@/utils/texto';

interface Fila extends EstudianteNominaLocal {
  seccion: string;
}

/** Buscador de estudiantes (solo los de mis secciones). Funciona sin internet: usa la nómina guardada. */
export default function Estudiantes() {
  const [todos, setTodos] = useState<Fila[]>([]);
  const [q, setQ] = useState('');

  useFocusEffect(
    useCallback(() => {
      let vigente = true;
      void (async () => {
        const [lista, meta] = await Promise.all([todosLosEstudiantes(), metaNomina()]);
        const nombres = new Map(meta?.secciones.map((s) => [s.id, s.nombre_corto]) ?? []);
        if (vigente) setTodos(lista.map((e) => ({ ...e, seccion: nombres.get(e.seccion_id) ?? '' })));
      })();
      return () => {
        vigente = false;
      };
    }, []),
  );

  const visibles = useMemo(
    () => todos.filter((e) => coincide(`${e.apellidos} ${e.nombres} ${e.codigo ?? ''} ${e.seccion}`, q)).slice(0, 100),
    [todos, q],
  );

  return (
    <SafeAreaView style={s.pantalla} edges={['top']}>
      <Contenedor maximo={ANCHOS.formulario} style={s.cabecera}>
        <Text style={s.titulo} accessibilityRole="header">Estudiantes</Text>
        <View style={s.buscador}>
          <Search size={18} color={colores.textMuted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Buscar por apellidos, nombres o sección"
            placeholderTextColor={colores.disabled}
            accessibilityLabel="Buscar estudiante"
            autoCorrect={false}
            style={s.input}
          />
        </View>
      </Contenedor>
      <FlatList
        data={visibles}
        keyExtractor={(e) => String(e.matricula_id)}
        contentContainerStyle={[s.lista, centrado(ANCHOS.formulario)]}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/estudiante/[id]', params: { id: item.estudiante_id } })}
            style={({ pressed }) => [s.fila, pressed && { backgroundColor: '#FAF9F5' }]}
            accessibilityRole="button"
            accessibilityLabel={`${item.apellidos}, ${item.nombres}, ${item.seccion}. Ver historial`}
          >
            <Avatar iniciales={item.iniciales} />
            <View style={{ flex: 1 }}>
              <Text style={s.nombre}>{item.apellidos}</Text>
              <Text style={s.sub}>{item.nombres}</Text>
            </View>
            <Text style={s.seccion}>{item.seccion}</Text>
            <ChevronRight size={18} color={colores.textMuted} />
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={s.vacio}>
            {todos.length === 0
              ? 'Aún no se descargó la lista de tus estudiantes. Conéctate a internet y vuelve a abrir esta pestaña.'
              : 'Ningún estudiante coincide con la búsqueda.'}
          </Text>
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.bg },
  cabecera: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 12, gap: 14 },
  titulo: { fontFamily: fuentes.titulo, fontSize: 28, letterSpacing: -0.56, color: colores.ink },
  buscador: {
    height: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12,
    backgroundColor: colores.surface, borderWidth: 1, borderColor: colores.borderInput, borderRadius: radios.input,
  },
  input: { flex: 1, minWidth: 0, fontFamily: fuentes.regular, fontSize: 15, color: colores.ink, paddingVertical: 0 },
  lista: { paddingHorizontal: 20, paddingBottom: 24 },
  fila: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colores.surface, borderWidth: 1,
    borderColor: colores.border, borderRadius: 16, padding: 12, minHeight: 60,
  },
  nombre: { fontFamily: fuentes.negrita, fontSize: 15, color: colores.ink },
  sub: { fontFamily: fuentes.regular, fontSize: 13, color: colores.textMuted },
  seccion: { fontFamily: fuentes.negrita, fontSize: 13, color: colores.textMuted },
  vacio: { fontFamily: fuentes.regular, fontSize: 15, color: colores.textMuted, textAlign: 'center', paddingVertical: 32 },
});
