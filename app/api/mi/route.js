// GET /api/mi  ->  el portal del empleado: solo sus datos, en una llamada.

import { getSupabase } from '@/lib/supabase';
import { exigirSesion, error } from '@/lib/guard';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { sesion, respuesta } = exigirSesion();
  if (respuesta) return respuesta;

  try {
    const sb = getSupabase();
    const yo = sesion.id;
    const anio = new Date().getFullYear();

    const [ficha, saldo, pagos, extras, vacaciones, ausencias, anticipos] = await Promise.all([
      sb.from('empleados')
        .select('id, cedula, nombres, apellidos, cargo, area, fecha_ingreso, estado, foto_url, telefono, email, rol')
        .eq('id', yo).maybeSingle(),
      sb.from('vw_vacaciones_saldo').select('*').eq('empleado_id', yo).maybeSingle(),
      sb.from('pagos').select('*').eq('empleado_id', yo).order('fecha_pago', { ascending: false }).limit(24),
      sb.from('horas_extra').select('*').eq('empleado_id', yo).gte('fecha', `${anio}-01-01`).order('fecha', { ascending: false }),
      sb.from('vacaciones').select('*').eq('empleado_id', yo).order('fecha_desde', { ascending: false }),
      sb.from('ausencias').select('*').eq('empleado_id', yo).gte('fecha_desde', `${anio}-01-01`).order('fecha_desde', { ascending: false }),
      sb.from('vw_anticipos_saldo').select('*').eq('empleado_id', yo).gt('saldo', 0),
    ]);

    for (const r of [ficha, saldo, pagos, extras, vacaciones, ausencias, anticipos]) {
      if (r.error) throw r.error;
    }

    return Response.json({
      ok: true,
      empleado: ficha.data,
      vacaciones: {
        saldo: saldo.data?.saldo ?? 0,
        ganados: saldo.data?.dias_ganados ?? 0,
        tomados: saldo.data?.dias_tomados ?? 0,
        enSolicitud: saldo.data?.dias_en_solicitud ?? 0,
        solicitudes: vacaciones.data || [],
      },
      pagos: pagos.data || [],
      extras: extras.data || [],
      ausencias: ausencias.data || [],
      anticipos: anticipos.data || [],
    });
  } catch (e) {
    console.error('[mi]', e);
    return error(e.message, 500);
  }
}
