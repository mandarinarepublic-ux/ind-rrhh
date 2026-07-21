// GET /api/dashboard  ->  todo lo que el panel necesita, en una sola llamada.

import { getSupabase } from '@/lib/supabase';
import { exigirSesion, esAdmin, error, alcanceEmpleados } from '@/lib/guard';
import { periodoActual, hoyISO } from '@/lib/fmt';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { sesion, respuesta } = exigirSesion();
  if (respuesta) return respuesta;
  if (!esAdmin(sesion) && sesion.rol !== 'JEFE') return error('Sin permiso.', 403);

  try {
    const sb = getSupabase();
    const alcance = await alcanceEmpleados(sesion);
    const hoy = hoyISO();
    const periodo = periodoActual();
    const inicioMes = `${periodo}-01`;

    const acotar = (q, col) => (alcance ? q.in(col, alcance) : q);

    const [equipo, extrasPend, vacPend, ausenciasMes, pagosMes] = await Promise.all([
      acotar(sb.from('vw_resumen_empleado').select('*').order('apellidos'), 'id'),
      acotar(sb.from('horas_extra').select('*').eq('estado', 'PENDIENTE').order('fecha'), 'empleado_id'),
      acotar(sb.from('vacaciones').select('*').eq('estado', 'PENDIENTE').order('fecha_desde'), 'empleado_id'),
      acotar(sb.from('ausencias').select('*').gte('fecha_desde', inicioMes).order('fecha_desde', { ascending: false }), 'empleado_id'),
      acotar(sb.from('pagos').select('monto_bruto, descuentos, monto_neto').gte('fecha_pago', inicioMes), 'empleado_id'),
    ]);

    for (const r of [equipo, extrasPend, vacPend, ausenciasMes, pagosMes]) {
      if (r.error) throw r.error;
    }

    const filas = equipo.data || [];
    const activos = filas.filter((e) => e.estado !== 'INACTIVO');

    return Response.json({
      ok: true,
      periodo,
      hoy,
      equipo: filas,
      pendientes: {
        extras: extrasPend.data || [],
        vacaciones: vacPend.data || [],
      },
      ausenciasMes: ausenciasMes.data || [],
      totales: {
        activos: activos.length,
        deVacacionesHoy: activos.filter((e) => e.de_vacaciones_hoy).length,
        extrasPendientes: (extrasPend.data || []).length,
        vacacionesPendientes: (vacPend.data || []).length,
        faltasMes: (ausenciasMes.data || [])
          .filter((a) => a.tipo === 'FALTA')
          .reduce((s, a) => s + Number(a.dias || 0), 0),
        pagadoMes: (pagosMes.data || []).reduce((s, p) => s + Number(p.monto_neto || 0), 0),
        deudaAnticipos: activos.reduce((s, e) => s + Number(e.anticipo_saldo || 0), 0),
      },
    });
  } catch (e) {
    console.error('[dashboard]', e);
    return error(e.message, 500);
  }
}
