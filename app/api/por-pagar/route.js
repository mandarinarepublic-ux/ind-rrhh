// GET /api/por-pagar?periodo=YYYY-MM
//
// Cuanto le debo a cada persona en un mes. El modelo de INDFACTORY:
// cada mes acumula un valor fijo (el sueldo base) que se paga en pedazos
// (semanal, diario, como pida el empleado). La deuda es lo que falta.
//
//   falta del sueldo   = sueldo_base − pagos de sueldo aplicados a ese mes
//   + extras por pagar = horas extra aprobadas − pagos de horas extra
//   − anticipo          = lo que el empleado debe y se le descuenta
//   = TOTAL por pagar
//
// Notas de diseno:
// - El sueldo se netea con monto_BRUTO: el sueldo_base es cifra bruta, y un
//   pago de $470 con $44 de IESS igual cubre el sueldo del mes.
// - Las horas extra se netean con los pagos concepto HORAS_EXTRA en vez de
//   depender de marcar cada extra como PAGADA: asi el numero se corrige solo
//   cuando registras el pago, sin tocar registro por registro.
// - Todo se mide desde que existe el sistema; no se inventan deudas viejas
//   anteriores a la primera carga (mismo criterio que vacaciones_ajuste).

import { getSupabase } from '@/lib/supabase';
import { exigirAdmin, error, esAdmin, alcanceEmpleados } from '@/lib/guard';
import { periodoActual } from '@/lib/fmt';

export const dynamic = 'force-dynamic';

const CONCEPTOS_SUELDO = ['SUELDO', 'QUINCENA'];

export async function GET(req) {
  const { sesion, respuesta } = exigirAdmin();
  if (respuesta) return respuesta;

  try {
    const sb = getSupabase();
    const periodo = new URL(req.url).searchParams.get('periodo') || periodoActual();

    const alcance = await alcanceEmpleados(sesion); // null = admin ve todo
    const acotar = (q, col) => (alcance ? q.in(col, alcance) : q);

    const [empleadosR, pagosMesR, pagosExtraR, extrasR, anticiposR] = await Promise.all([
      acotar(
        sb.from('empleados')
          .select('id, nombres, apellidos, cargo, area, sueldo_base, foto_url')
          .neq('estado', 'INACTIVO')
          .order('apellidos'),
        'id'
      ),
      // pagos de SUELDO/QUINCENA del mes consultado
      acotar(
        sb.from('pagos').select('empleado_id, monto_bruto')
          .in('concepto', CONCEPTOS_SUELDO).eq('periodo', periodo),
        'empleado_id'
      ),
      // pagos de HORAS_EXTRA (todo el historial: las extras son deuda corrida)
      acotar(
        sb.from('pagos').select('empleado_id, monto_bruto').eq('concepto', 'HORAS_EXTRA'),
        'empleado_id'
      ),
      // horas extra que ya te comprometiste a pagar
      acotar(
        sb.from('horas_extra').select('empleado_id, valor_total')
          .in('estado', ['APROBADA', 'PAGADA']),
        'empleado_id'
      ),
      acotar(sb.from('vw_anticipos_saldo').select('empleado_id, saldo'), 'empleado_id'),
    ]);

    for (const r of [empleadosR, pagosMesR, pagosExtraR, extrasR, anticiposR]) {
      if (r.error) throw r.error;
    }

    // Sumas por empleado
    const suma = (filas, campo) => {
      const m = {};
      for (const f of filas || []) m[f.empleado_id] = (m[f.empleado_id] || 0) + Number(f[campo] || 0);
      return m;
    };

    const sueldoPagado = suma(pagosMesR.data, 'monto_bruto');
    const extraPagado = suma(pagosExtraR.data, 'monto_bruto');
    const extraGanado = suma(extrasR.data, 'valor_total');
    const anticipo = suma(anticiposR.data, 'saldo');

    const r2 = (n) => Math.round(n * 100) / 100;

    const filas = (empleadosR.data || []).map((e) => {
      const base = Number(e.sueldo_base || 0);
      const pagadoSueldo = sueldoPagado[e.id] || 0;
      const faltaSueldo = r2(base - pagadoSueldo);              // puede ser negativo = pagado de mas
      const extrasPorPagar = r2(Math.max(0, (extraGanado[e.id] || 0) - (extraPagado[e.id] || 0)));
      const anticipoSaldo = r2(anticipo[e.id] || 0);

      // Puede ser negativo: significa que, netos los anticipos, la persona
      // te debe a ti en vez de tu a ella.
      const total = r2(Math.max(0, faltaSueldo) + extrasPorPagar - anticipoSaldo);

      return {
        empleado: {
          id: e.id, nombres: e.nombres, apellidos: e.apellidos,
          cargo: e.cargo, area: e.area, foto_url: e.foto_url,
        },
        sueldo_base: base,
        pagado_sueldo: r2(pagadoSueldo),
        falta_sueldo: faltaSueldo,
        extras_por_pagar: extrasPorPagar,
        anticipo_saldo: anticipoSaldo,
        total_por_pagar: total,
      };
    });

    const totales = filas.reduce(
      (acc, f) => {
        acc.sueldos += Math.max(0, f.falta_sueldo);
        acc.extras += f.extras_por_pagar;
        acc.anticipos += f.anticipo_saldo;
        // El total es la plata que de verdad tienes que desembolsar: solo
        // suma deudas positivas. Que alguien te deba no baja lo que le pagas
        // a los demas.
        acc.total += Math.max(0, f.total_por_pagar);
        return acc;
      },
      { sueldos: 0, extras: 0, anticipos: 0, total: 0 }
    );
    for (const k in totales) totales[k] = r2(totales[k]);

    return Response.json({ ok: true, periodo, filas, totales });
  } catch (e) {
    console.error('[por-pagar]', e);
    return error(e.message, 500);
  }
}
