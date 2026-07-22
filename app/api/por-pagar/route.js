// GET /api/por-pagar?periodo=YYYY-MM
//
// Cuanto le debo a cada persona, ACUMULADO hasta el mes consultado.
//
// El modelo de INDFACTORY: cada mes acumula un valor fijo (el sueldo base)
// que se paga en pedazos. Lo que quede sin pagar de un mes se arrastra al
// siguiente.
//
//   sueldo acumulado   = sueldo_base × (meses desde `nomina_desde` hasta el mes)
//   − pagos de sueldo   = todo lo pagado de sueldo en ese rango de meses
//   = falta del sueldo  (arrastra los meses incompletos)
//   + extras por pagar  = horas extra aprobadas − pagos de horas extra (hasta el mes)
//   − anticipo           = lo que el empleado debe y se le descuenta (hasta el mes)
//   = TOTAL por pagar
//
// El ancla `nomina_desde` evita inventar deuda de meses anteriores a que
// existiera el sistema. Todo se mide "como al cierre del mes consultado":
// pagos, extras y anticipos posteriores a ese mes no cuentan.

import { getSupabase } from '@/lib/supabase';
import { exigirAdmin, error, alcanceEmpleados } from '@/lib/guard';
import { periodoActual } from '@/lib/fmt';

export const dynamic = 'force-dynamic';

const CONCEPTOS_SUELDO = ['SUELDO', 'QUINCENA'];

/** Meses inclusivos entre dos periodos 'YYYY-MM'. 0 si el fin es anterior. */
function mesesInclusive(desde, hasta) {
  const [ay, am] = desde.split('-').map(Number);
  const [by, bm] = hasta.split('-').map(Number);
  const n = (by - ay) * 12 + (bm - am) + 1;
  return Math.max(0, n);
}

/** Ultimo dia del mes 'YYYY-MM' como 'YYYY-MM-DD'. */
function finDeMes(periodo) {
  const [y, m] = periodo.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

export async function GET(req) {
  const { sesion, respuesta } = exigirAdmin();
  if (respuesta) return respuesta;

  try {
    const sb = getSupabase();
    const periodo = new URL(req.url).searchParams.get('periodo') || periodoActual();
    const finMes = finDeMes(periodo);

    const alcance = await alcanceEmpleados(sesion);
    const acotar = (q, col) => (alcance ? q.in(col, alcance) : q);

    const [empleadosR, pagosSueldoR, pagosExtraR, extrasR, anticiposR, abonosR, faltasR] = await Promise.all([
      acotar(
        sb.from('empleados')
          .select('id, nombres, apellidos, cargo, area, sueldo_base, foto_url, nomina_desde')
          .neq('estado', 'INACTIVO').order('apellidos'),
        'id'
      ),
      // pagos de sueldo hasta el mes consultado (el filtro por ancla va en JS)
      acotar(
        sb.from('pagos').select('empleado_id, monto_bruto, periodo')
          .in('concepto', CONCEPTOS_SUELDO).lte('periodo', periodo),
        'empleado_id'
      ),
      // pagos de horas extra hasta el mes consultado
      acotar(
        sb.from('pagos').select('empleado_id, monto_bruto')
          .eq('concepto', 'HORAS_EXTRA').lte('periodo', periodo),
        'empleado_id'
      ),
      // horas extra aprobadas hasta el cierre del mes
      acotar(
        sb.from('horas_extra').select('empleado_id, valor_total')
          .in('estado', ['APROBADA', 'PAGADA']).lte('fecha', finMes),
        'empleado_id'
      ),
      acotar(
        sb.from('anticipos').select('id, empleado_id, monto')
          .neq('estado', 'ANULADO').lte('fecha', finMes),
        'empleado_id'
      ),
      sb.from('anticipo_abonos').select('anticipo_id, monto').lte('fecha', finMes),
      // descuentos por dias no trabajados, hasta el cierre del mes
      acotar(
        sb.from('ausencias').select('empleado_id, fecha_desde, descuento')
          .gt('descuento', 0).lte('fecha_desde', finMes),
        'empleado_id'
      ),
    ]);

    for (const r of [empleadosR, pagosSueldoR, pagosExtraR, extrasR, anticiposR, abonosR, faltasR]) {
      if (r.error) throw r.error;
    }

    const sumaPor = (filas, clave, campo) => {
      const m = {};
      for (const f of filas || []) m[f[clave]] = (m[f[clave]] || 0) + Number(f[campo] || 0);
      return m;
    };

    // Pagos de sueldo por empleado, solo los que caen desde su ancla en adelante.
    const sueldoPagado = {};
    for (const p of pagosSueldoR.data || []) {
      sueldoPagado[p.empleado_id] = sueldoPagado[p.empleado_id] || { total: 0, filas: [] };
      sueldoPagado[p.empleado_id].filas.push(p);
    }

    // Descuentos por faltas, agrupados por empleado (el filtro por ancla va en JS).
    const faltasPorEmp = {};
    for (const a of faltasR.data || []) {
      (faltasPorEmp[a.empleado_id] ||= []).push(a);
    }

    const extraPagado = sumaPor(pagosExtraR.data, 'empleado_id', 'monto_bruto');
    const extraGanado = sumaPor(extrasR.data, 'empleado_id', 'valor_total');

    // Saldo de anticipos al cierre del mes = emitido − abonado (ambos hasta esa
    // fecha), por empleado. Los abonos vienen por anticipo_id, asi que primero
    // se mapea cada anticipo a su dueno.
    const duenoDeAnticipo = {};
    const anticipoEmitido = {};
    for (const a of anticiposR.data || []) {
      duenoDeAnticipo[a.id] = a.empleado_id;
      anticipoEmitido[a.empleado_id] = (anticipoEmitido[a.empleado_id] || 0) + Number(a.monto || 0);
    }
    const anticipoAbonado = {};
    for (const ab of abonosR.data || []) {
      const emp = duenoDeAnticipo[ab.anticipo_id];
      if (!emp) continue; // abono de un anticipo fuera de rango o anulado
      anticipoAbonado[emp] = (anticipoAbonado[emp] || 0) + Number(ab.monto || 0);
    }

    const r2 = (n) => Math.round(n * 100) / 100;

    const filas = (empleadosR.data || []).map((e) => {
      const base = Number(e.sueldo_base || 0);
      const anclaMes = String(e.nomina_desde).slice(0, 7);
      const meses = mesesInclusive(anclaMes, periodo);

      const sueldoAcumulado = r2(base * meses);

      const pagosEmp = sueldoPagado[e.id]?.filas || [];
      const pagadoSueldo = r2(
        pagosEmp.filter((p) => p.periodo >= anclaMes).reduce((s, p) => s + Number(p.monto_bruto || 0), 0)
      );

      // Dias no trabajados: descuentos de faltas desde el ancla hasta el mes.
      const faltasEmp = faltasPorEmp[e.id] || [];
      const descuentoFaltas = r2(
        faltasEmp
          .filter((a) => String(a.fecha_desde).slice(0, 7) >= anclaMes)
          .reduce((s, a) => s + Number(a.descuento || 0), 0)
      );

      // Lo que se le debe de sueldo baja por lo pagado Y por lo no trabajado.
      const faltaSueldo = r2(sueldoAcumulado - descuentoFaltas - pagadoSueldo);
      const extrasPorPagar = r2(Math.max(0, (extraGanado[e.id] || 0) - (extraPagado[e.id] || 0)));
      const anticipoSaldo = r2(Math.max(0, (anticipoEmitido[e.id] || 0) - (anticipoAbonado[e.id] || 0)));

      const total = r2(Math.max(0, faltaSueldo) + extrasPorPagar - anticipoSaldo);

      return {
        empleado: {
          id: e.id, nombres: e.nombres, apellidos: e.apellidos,
          cargo: e.cargo, area: e.area, foto_url: e.foto_url,
        },
        meses,
        nomina_desde: anclaMes,
        sueldo_base: base,
        sueldo_acumulado: sueldoAcumulado,
        descuento_faltas: descuentoFaltas,
        pagado_sueldo: pagadoSueldo,
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
        acc.descuentos += f.descuento_faltas;
        acc.total += Math.max(0, f.total_por_pagar);
        return acc;
      },
      { sueldos: 0, extras: 0, anticipos: 0, descuentos: 0, total: 0 }
    );
    for (const k in totales) totales[k] = r2(totales[k]);

    return Response.json({ ok: true, periodo, filas, totales });
  } catch (e) {
    console.error('[por-pagar]', e);
    return error(e.message, 500);
  }
}
