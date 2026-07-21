// POST /api/setup  ->  crea el PRIMER administrador.
// Solo funciona si la tabla de empleados esta completamente vacia; una vez
// que existe alguien, esta puerta queda cerrada para siempre.

import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { getSupabase, registrarBitacora } from '@/lib/supabase';
import { COOKIE, crearSesion, opcionesCookie } from '@/lib/session';
import { hoyISO } from '@/lib/fmt';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const sb = getSupabase();

    const { count, error: errCount } = await sb
      .from('empleados')
      .select('id', { count: 'exact', head: true });
    if (errCount) throw errCount;

    if ((count || 0) > 0) {
      return Response.json(
        { ok: false, error: 'El sistema ya esta configurado.' },
        { status: 409 }
      );
    }

    const body = await req.json();
    const cedula = String(body.cedula || '').trim();
    const nombres = String(body.nombres || '').trim();
    const apellidos = String(body.apellidos || '').trim();
    const pin = String(body.pin || '').trim();

    if (!cedula || !nombres || !apellidos) {
      return Response.json({ ok: false, error: 'Faltan datos.' }, { status: 400 });
    }
    if (!/^\d{6}$/.test(pin)) {
      return Response.json({ ok: false, error: 'El PIN debe ser de 6 digitos.' }, { status: 400 });
    }

    const { data: emp, error } = await sb
      .from('empleados')
      .insert({
        cedula,
        nombres,
        apellidos,
        cargo: body.cargo || 'Administracion',
        area: body.area || 'ADMINISTRACION',
        fecha_ingreso: body.fecha_ingreso || hoyISO(),
        rol: 'ADMIN',
        pin_hash: await bcrypt.hash(pin, 10),
      })
      .select('id, cedula, nombres, apellidos, rol')
      .single();

    if (error) throw error;

    const nombre = `${emp.nombres} ${emp.apellidos}`.trim();
    cookies().set(
      COOKIE,
      crearSesion({ id: emp.id, cedula: emp.cedula, nombre, rol: emp.rol }),
      opcionesCookie
    );

    await registrarBitacora({
      tabla: 'empleados',
      registroId: emp.id,
      accion: 'SETUP_ADMIN',
      usuario: nombre,
    });

    return Response.json({ ok: true });
  } catch (e) {
    console.error('[setup]', e);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
