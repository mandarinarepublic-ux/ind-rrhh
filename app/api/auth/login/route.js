// POST /api/auth/login   { usuario, pin }   usuario = celular (o cedula)
// GET  /api/auth/login   -> { requiereSetup } para saber si hay que crear el
//                           primer administrador

import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { getSupabase, registrarBitacora } from '@/lib/supabase';
import { COOKIE, crearSesion, opcionesCookie } from '@/lib/session';
import { normalizarCelular } from '@/lib/fmt';

export const dynamic = 'force-dynamic';

// Freno simple a la fuerza bruta sobre un PIN de 6 digitos.
// Vive en memoria del proceso: en serverless no es infalible, pero sumado al
// costo de bcrypt hace inviable probar el millon de combinaciones.
const intentos = new Map();
const MAX_INTENTOS = 5;
const BLOQUEO_MS = 5 * 60 * 1000;

function bloqueado(cedula) {
  const reg = intentos.get(cedula);
  if (!reg) return false;
  if (Date.now() - reg.desde > BLOQUEO_MS) {
    intentos.delete(cedula);
    return false;
  }
  return reg.fallos >= MAX_INTENTOS;
}

function anotarFallo(cedula) {
  const reg = intentos.get(cedula);
  if (!reg || Date.now() - reg.desde > BLOQUEO_MS) {
    intentos.set(cedula, { fallos: 1, desde: Date.now() });
  } else {
    reg.fallos += 1;
  }
}

export async function GET() {
  try {
    const { count, error } = await getSupabase()
      .from('empleados')
      .select('id', { count: 'exact', head: true });

    if (error) throw error;
    return Response.json({ ok: true, requiereSetup: (count || 0) === 0 });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { usuario, pin } = await req.json();

    // Se entra con el celular. La cedula sigue valiendo para quien ya la
    // tenia cargada y aun no tiene celular en su ficha.
    const ced = String(usuario || '').replace(/\D/g, '');
    const cel = normalizarCelular(usuario);
    const clave = String(pin || '').trim();

    if (!ced || !clave) {
      return Response.json({ ok: false, error: 'Ingresa tu celular y tu PIN.' }, { status: 400 });
    }

    if (bloqueado(ced)) {
      return Response.json(
        { ok: false, error: 'Demasiados intentos fallidos. Espera 5 minutos.' },
        { status: 429 }
      );
    }

    const sb = getSupabase();
    const columnas = 'id, cedula, nombres, apellidos, rol, estado, pin_hash';

    // Primero por celular; si no hay nadie con ese numero, por cedula.
    let { data: emp, error } = await sb
      .from('empleados').select(columnas).eq('telefono', cel).maybeSingle();
    if (error) throw error;
    if (!emp) {
      ({ data: emp, error } = await sb
        .from('empleados').select(columnas).eq('cedula', ced).maybeSingle());
      if (error) throw error;
    }

    // Mismo mensaje para "no existe" y "PIN incorrecto": no revelamos que
    // numeros estan registrados.
    const generico = { ok: false, error: 'Celular o PIN incorrectos.' };

    if (!emp || !emp.pin_hash) {
      anotarFallo(ced);
      return Response.json(generico, { status: 401 });
    }

    if (emp.estado === 'INACTIVO') {
      return Response.json(
        { ok: false, error: 'Tu acceso está desactivado. Habla con Recursos Humanos.' },
        { status: 403 }
      );
    }

    const coincide = await bcrypt.compare(clave, emp.pin_hash);
    if (!coincide) {
      anotarFallo(ced);
      return Response.json(generico, { status: 401 });
    }

    intentos.delete(ced);

    const nombre = `${emp.nombres} ${emp.apellidos}`.trim();
    cookies().set(
      COOKIE,
      crearSesion({ id: emp.id, cedula: emp.cedula, nombre, rol: emp.rol }),
      opcionesCookie
    );

    await registrarBitacora({
      tabla: 'empleados',
      registroId: emp.id,
      accion: 'LOGIN',
      usuario: nombre,
    });

    return Response.json({ ok: true, rol: emp.rol, nombre });
  } catch (e) {
    console.error('[login]', e);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
