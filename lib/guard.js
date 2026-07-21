// lib/guard.js
// Quien puede ver y tocar que. Unico lugar donde vive esa decision.
//
//   ADMIN / RRHH  -> todo el equipo, lectura y escritura
//   JEFE          -> lee a su equipo (empleados con jefe_id = el) y aprueba
//                    vacaciones y horas extra de ese equipo
//   EMPLEADO      -> solo lo suyo, lectura; puede pedir vacaciones y
//                    cancelar su propia solicitud mientras siga PENDIENTE

import { cookies } from 'next/headers';
import { COOKIE, leerSesion } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';

export const ROLES_ADMIN = ['ADMIN', 'RRHH'];

/** Sesion actual o null. */
export function sesionActual() {
  return leerSesion(cookies().get(COOKIE)?.value);
}

export const esAdmin = (s) => Boolean(s && ROLES_ADMIN.includes(s.rol));
export const esJefe  = (s) => Boolean(s && s.rol === 'JEFE');

/** Respuesta JSON de error, para cortar temprano en las rutas. */
export function error(mensaje, status = 400) {
  return Response.json({ ok: false, error: mensaje }, { status });
}

/** Exige sesion. Devuelve { sesion } o { respuesta } lista para retornar. */
export function exigirSesion() {
  const sesion = sesionActual();
  if (!sesion) return { respuesta: error('Sesion no valida o expirada.', 401) };
  return { sesion };
}

/** Exige rol ADMIN o RRHH. */
export function exigirAdmin() {
  const { sesion, respuesta } = exigirSesion();
  if (respuesta) return { respuesta };
  if (!esAdmin(sesion)) return { respuesta: error('No tienes permiso para esta accion.', 403) };
  return { sesion };
}

/**
 * IDs de empleados que esta sesion puede ver.
 * null = todos (admin/rrhh). Array = lista cerrada.
 */
export async function alcanceEmpleados(sesion) {
  if (esAdmin(sesion)) return null;

  if (esJefe(sesion)) {
    const { data } = await getSupabase()
      .from('empleados')
      .select('id')
      .eq('jefe_id', sesion.id);
    return [sesion.id, ...(data || []).map((e) => e.id)];
  }

  return [sesion.id];
}

/** true si la sesion puede ver los datos de ese empleado. */
export async function puedeVer(sesion, empleadoId) {
  const alcance = await alcanceEmpleados(sesion);
  return alcance === null || alcance.includes(empleadoId);
}
