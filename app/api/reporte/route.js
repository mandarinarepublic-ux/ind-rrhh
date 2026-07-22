// GET /api/reporte
//
// Reporte acumulado de TODA la historia registrada, en dos cortes:
//   1) por empleado  -> devengado, pagado y pendiente de cada persona
//   2) mes a mes      -> nomina teorica vs pagado, con saldo que se acumula
//
// "Devengado" = lo que se le fue debiendo: sueldo_base por cada mes desde su
// `nomina_desde` + horas extra aprobadas. "Pagado" = lo abonado a esa deuda
// (sueldo + horas extra, en bruto). "Otros pagos" = bonos, decimos, etc., que
// no forman parte de la deuda de sueldo pero igual salieron de caja.

import { getSupabase } from '@/lib/supabase';
import { exigirAdmin, error, alcanceEmpleados } from '@/lib/guard';
import { periodoActual } from '@/lib/fmt';

export const dynamic = 'force-dynamic';

const CONCEPTOS_SUELDO = ['SUELDO', 'QUINCENA'];

const mesesInclusive = (desde, hasta) => {
  const [ay, am] = desde.split('-').map(Number);
  const [by, bm] = hasta.split('-').map(Number);
  return Math.max(0, (by - ay) * 12 + (bm - am) + 1);
};

/** Lista de meses 'YYYY-MM' entre dos periodos, inclusive. */
function rangoMeses(desde, hasta) {
  const out = [];
  let [y, m] = desde.split('-').map(Number);
  const [by, bm] = hasta.split('-').map(Number);
  let guarda = 0;
  while ((y < by || (y === by && m <= bm)) && guarda++ < 600) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    if (++m > 12) { m = 1; y++; }
  }
  return out;
}

export async function GET(req) {
  const { sesion, respuesta } = exigirAdmin();
  if (respuesta) return respuesta;

  try {
    const sb = getSupabase();
    const mesActual = periodoActual();

    const alcance = await alcanceEmpleados(sesion);
    const acotar = (q, col) => (alcance ? q.in(col, alcance) : q);

    const [empleadosR, pagosR, extrasR, anticiposR, faltasR] = await Promise.all([
      acotar(
        sb.from('empleados')
          .select('id, nombres, apellidos, cargo, area, foto_url, sueldo_base, nomina_desde, estado, fecha_salida')
          .order('apellidos'),
        'id'
      ),
      acotar(sb.from('pagos').select('empleado_id, concepto, periodo, monto_bruto, monto_neto'), 'empleado_id'),
      acotar(sb.from('horas_extra').select('empleado_id, valor_total').in('estado', ['APROBADA', 'PAGADA']), 'empleado_id'),
      acotar(sb.from('vw_anticipos_saldo').select('empleado_id, saldo'), 'empleado_id'),
      acotar(sb.from('ausencias').select('empleado_id, fecha_desde, descuento').gt('descuento', 0), 'empleado_id'),
    ]);

    for (const r of [empleadosR, pagosR, extrasR, anticiposR, faltasR]) {
      if (r.error) throw r.error;
    }

    const empleados = empleadosR.data || [];
    const pagos = pagosR.data || [];

    const sumaPor = (filas, campo) => {
      const m = {};
      for (const f of filas) m[f.empleado_id] = (m[f.empleado_id] || 0) + Number(f[campo] || 0);
      return m;
    };

    const extraGanado = sumaPor(extrasR.data || [], 'valor_total');
    const anticipoSaldo = sumaPor(anticiposR.data || [], 'saldo');
    const descuentoFaltas = sumaPor(faltasR.data || [], 'descuento');

    // Pagos agrupados por empleado y clase.
    const pagoEmp = {};
    for (const p of pagos) {
      const e = (pagoEmp[p.empleado_id] ||= { sueldo: 0, extra: 0, otros: 0 });
      if (CONCEPTOS_SUELDO.includes(p.concepto)) e.sueldo += Number(p.monto_bruto || 0);
      else if (p.concepto === 'HORAS_EXTRA') e.extra += Number(p.monto_bruto || 0);
      else e.otros += Number(p.monto_neto || 0);
    }

    const r2 = (n) => Math.round(n * 100) / 100;

    // ---------- 1) por empleado ----------
    const porEmpleado = empleados.map((e) => {
      const base = Number(e.sueldo_base || 0);
      const ancla = String(e.nomina_desde).slice(0, 7);
      const meses = mesesInclusive(ancla, mesActual);

      // Lo devengado de sueldo baja por los dias no trabajados.
      const descuento = r2(descuentoFaltas[e.id] || 0);
      const sueldoDevengado = r2(base * meses - descuento);
      const extras = r2(extraGanado[e.id] || 0);
      const devengado = r2(sueldoDevengado + extras);

      const pg = pagoEmp[e.id] || { sueldo: 0, extra: 0, otros: 0 };
      const pagadoObligacion = r2(pg.sueldo + pg.extra);
      const otrosPagos = r2(pg.otros);
      const anticipo = r2(anticipoSaldo[e.id] || 0);

      const faltaSueldo = Math.max(0, sueldoDevengado - pg.sueldo);
      const extrasPorPagar = Math.max(0, extras - pg.extra);
      const pendiente = r2(faltaSueldo + extrasPorPagar - anticipo);

      return {
        empleado: { id: e.id, nombres: e.nombres, apellidos: e.apellidos, cargo: e.cargo, area: e.area, foto_url: e.foto_url, estado: e.estado },
        meses,
        descuento,
        devengado,
        pagado: pagadoObligacion,
        otros_pagos: otrosPagos,
        anticipo,
        pendiente,
      };
    });

    // ---------- 2) mes a mes (toda la empresa) ----------
    // Desde el ancla mas antigua hasta el mes actual.
    const anclas = empleados.map((e) => String(e.nomina_desde).slice(0, 7)).filter(Boolean);
    const desde = anclas.length ? anclas.sort()[0] : mesActual;
    const meses = rangoMeses(desde, mesActual);

    // pagos de sueldo+extra por periodo (bruto)
    const pagadoPorMes = {};
    for (const p of pagos) {
      if (!CONCEPTOS_SUELDO.includes(p.concepto) && p.concepto !== 'HORAS_EXTRA') continue;
      if (!p.periodo) continue;
      pagadoPorMes[p.periodo] = (pagadoPorMes[p.periodo] || 0) + Number(p.monto_bruto || 0);
    }

    // descuentos por dias no trabajados, por mes de la falta
    const descuentoPorMes = {};
    for (const a of faltasR.data || []) {
      const mes = String(a.fecha_desde).slice(0, 7);
      descuentoPorMes[mes] = (descuentoPorMes[mes] || 0) + Number(a.descuento || 0);
    }

    let saldoAcum = 0;
    const porMes = meses.map((mes) => {
      // nomina teorica del mes: quien ya arranco y no ha salido antes del mes,
      // menos lo no trabajado ese mes
      const bruto = empleados.reduce((s, e) => {
        const ancla = String(e.nomina_desde).slice(0, 7);
        if (ancla > mes) return s;
        const salida = e.fecha_salida ? String(e.fecha_salida).slice(0, 7) : null;
        if (salida && salida < mes) return s;
        return s + Number(e.sueldo_base || 0);
      }, 0);
      const devengado = r2(bruto - (descuentoPorMes[mes] || 0));
      const pagado = pagadoPorMes[mes] || 0;
      const saldoMes = r2(devengado - pagado);
      saldoAcum = r2(saldoAcum + saldoMes);
      return { periodo: mes, devengado, pagado: r2(pagado), saldo_mes: saldoMes, saldo_acumulado: saldoAcum };
    });

    // ---------- totales ----------
    const totales = porEmpleado.reduce(
      (a, f) => {
        a.devengado += f.devengado;
        a.pagado += f.pagado;
        a.otros_pagos += f.otros_pagos;
        a.pendiente += Math.max(0, f.pendiente);
        return a;
      },
      { devengado: 0, pagado: 0, otros_pagos: 0, pendiente: 0 }
    );
    for (const k in totales) totales[k] = r2(totales[k]);

    return Response.json({ ok: true, mesActual, porEmpleado, porMes, totales });
  } catch (e) {
    console.error('[reporte]', e);
    return error(e.message, 500);
  }
}
