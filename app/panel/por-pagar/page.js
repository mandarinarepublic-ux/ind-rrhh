'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Avatar, Aviso, Cargando, Metrica, Vacio } from '@/components/ui';
import { money, periodo, periodoActual } from '@/lib/fmt';

export default function PorPagar() {
  const [mes, setMes] = useState(periodoActual());
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setDatos(null);
    api.porPagar(mes).then(setDatos).catch((e) => setError(e.message));
  }, [mes]);

  if (error) return <Aviso>{error}</Aviso>;

  function exportarCSV() {
    const filas = [
      ['Empleado', 'Cargo', 'Meses', 'Sueldo acumulado', 'No trabajado', 'Pagado', 'Falta sueldo', 'Extras por pagar', 'Anticipo', 'TOTAL POR PAGAR'],
      ...datos.filas.map((f) => [
        `${f.empleado.nombres} ${f.empleado.apellidos}`, f.empleado.cargo || '', f.meses,
        f.sueldo_acumulado, f.descuento_faltas, f.pagado_sueldo, f.falta_sueldo,
        f.extras_por_pagar, f.anticipo_saldo, f.total_por_pagar,
      ]),
    ];
    const csv = '﻿' + filas.map((f) => f.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `por-pagar-${mes}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Por pagar</h1>
          <p className="text-sm text-slate-500">
            Lo que le debes a cada persona por <span className="capitalize font-medium">{periodo(mes)}</span>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input type="month" className="campo !w-auto" value={mes} onChange={(e) => setMes(e.target.value)} />
          <button onClick={exportarCSV} className="btn-suave" disabled={!datos?.filas?.length}>⬇ Excel</button>
        </div>
      </div>

      {!datos ? (
        <Cargando />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Metrica titulo="Total por pagar" valor={money(datos.totales.total)} tono="rojo" detalle="ahora mismo" />
            <Metrica titulo="Sueldos pendientes" valor={money(datos.totales.sueldos)} />
            <Metrica titulo="Horas extra" valor={money(datos.totales.extras)} tono={datos.totales.extras ? 'ambar' : 'slate'} />
            <Metrica titulo="Anticipos a favor" valor={money(datos.totales.anticipos)} tono="verde" detalle="se descuentan" />
          </div>

          <div className="tarjeta p-4 bg-ind-50/50 border-ind-100 text-sm text-slate-600">
            <b className="text-slate-700">Cómo se calcula:</b> el sueldo se acumula mes a mes y
            <b> lo que quede sin pagar se arrastra</b>. El total es <b>sueldo acumulado − lo ya pagado</b>,
            más <b>horas extra aprobadas sin pagar</b>, menos <b>anticipos</b>. Cada persona acumula
            desde su mes de inicio de nómina (editable en su ficha), nunca desde antes.
          </div>

          {datos.filas.length === 0 ? (
            <div className="tarjeta"><Vacio icono="🧮" titulo="No hay nadie activo en nómina" /></div>
          ) : (
            <div className="tarjeta overflow-hidden">
              <div className="scroll-x">
                <table className="w-full min-w-[820px]">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="th">Persona</th>
                      <th className="th text-right">Sueldo acumulado</th>
                      <th className="th text-right">No trabajado</th>
                      <th className="th text-right">Pagado</th>
                      <th className="th text-right">Falta sueldo</th>
                      <th className="th text-right">Extras</th>
                      <th className="th text-right">Anticipo</th>
                      <th className="th text-right">Por pagar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {datos.filas.map((f) => (
                      <tr key={f.empleado.id} className="hover:bg-slate-50">
                        <td className="td">
                          <Link href={`/panel/empleados/${f.empleado.id}`} className="flex items-center gap-2 group">
                            <Avatar empleado={f.empleado} size={32} />
                            <span>
                              <span className="block font-medium text-slate-700 group-hover:text-ind-600">
                                {f.empleado.nombres} {f.empleado.apellidos}
                              </span>
                              <span className="block text-xs text-slate-400">{f.empleado.cargo || '—'}</span>
                            </span>
                          </Link>
                        </td>
                        <td className="td text-right text-slate-500">
                          {money(f.sueldo_acumulado)}
                          {f.meses > 1 && (
                            <span className="block text-xs text-slate-400">
                              {f.meses} meses × {money(f.sueldo_base)}
                            </span>
                          )}
                        </td>
                        <td className="td text-right">
                          {f.descuento_faltas > 0
                            ? <span className="text-rose-600">−{money(f.descuento_faltas)}</span>
                            : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="td text-right text-slate-500">{money(f.pagado_sueldo)}</td>
                        <td className="td text-right">
                          {f.falta_sueldo < 0
                            ? <span className="text-emerald-600 text-xs">pagado de más {money(-f.falta_sueldo)}</span>
                            : money(f.falta_sueldo)}
                        </td>
                        <td className="td text-right">
                          {f.extras_por_pagar > 0
                            ? <span className="text-amber-600">{money(f.extras_por_pagar)}</span>
                            : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="td text-right">
                          {f.anticipo_saldo > 0
                            ? <span className="text-emerald-600">−{money(f.anticipo_saldo)}</span>
                            : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="td text-right font-bold">
                          {f.total_por_pagar < 0
                            ? <span className="text-emerald-600 whitespace-nowrap" title="Neto, esta persona te debe a ti">te debe {money(-f.total_por_pagar)}</span>
                            : <span className="text-slate-800">{money(f.total_por_pagar)}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-bold">
                    <tr>
                      <td className="td">Total nómina</td>
                      <td className="td" colSpan={6}></td>
                      <td className="td text-right text-rose-700">{money(datos.totales.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
