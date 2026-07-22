'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Avatar, Aviso, Cargando, Metrica, Vacio } from '@/components/ui';
import { money, periodo } from '@/lib/fmt';

export default function Reporte() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [vista, setVista] = useState('empleado'); // 'empleado' | 'mes'

  useEffect(() => {
    api.reporte().then(setDatos).catch((e) => setError(e.message));
  }, []);

  if (error) return <Aviso>{error}</Aviso>;
  if (!datos) return <Cargando />;

  const { porEmpleado, porMes, totales } = datos;

  function exportarCSV() {
    let filas;
    if (vista === 'empleado') {
      filas = [
        ['Empleado', 'Cargo', 'Meses', 'Devengado', 'Pagado', 'Otros pagos', 'Anticipo', 'Pendiente'],
        ...porEmpleado.map((f) => [
          `${f.empleado.nombres} ${f.empleado.apellidos}`, f.empleado.cargo || '', f.meses,
          f.devengado, f.pagado, f.otros_pagos, f.anticipo, f.pendiente,
        ]),
      ];
    } else {
      filas = [
        ['Mes', 'Nómina del mes', 'Pagado', 'Saldo del mes', 'Saldo acumulado'],
        ...porMes.map((m) => [m.periodo, m.devengado, m.pagado, m.saldo_mes, m.saldo_acumulado]),
      ];
    }
    const csv = '﻿' + filas.map((f) => f.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-${vista}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Reporte acumulado</h1>
          <p className="text-sm text-slate-500">Toda la historia registrada, hasta <span className="capitalize">{periodo(datos.mesActual)}</span></p>
        </div>
        <button onClick={exportarCSV} className="btn-suave">⬇ Excel</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metrica titulo="Devengado total" valor={money(totales.devengado)} detalle="lo que se ha ganado" />
        <Metrica titulo="Pagado total" valor={money(totales.pagado)} tono="verde" />
        <Metrica titulo="Pendiente" valor={money(totales.pendiente)} tono={totales.pendiente > 0 ? 'rojo' : 'slate'} />
        <Metrica titulo="Otros pagos" valor={money(totales.otros_pagos)} detalle="bonos, décimos…" />
      </div>

      <div className="flex gap-2">
        {[['empleado', '👥 Por empleado'], ['mes', '📅 Mes a mes']].map(([id, txt]) => (
          <button
            key={id}
            onClick={() => setVista(id)}
            className={`px-3.5 py-2 rounded-xl text-sm font-medium transition ${
              vista === id ? 'bg-ind-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {txt}
          </button>
        ))}
      </div>

      {vista === 'empleado' ? (
        porEmpleado.length === 0 ? (
          <div className="tarjeta"><Vacio icono="📈" titulo="Todavía no hay datos" /></div>
        ) : (
          <div className="tarjeta overflow-hidden">
            <div className="scroll-x">
              <table className="w-full min-w-[780px]">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="th">Persona</th>
                    <th className="th text-right">Devengado</th>
                    <th className="th text-right">Pagado</th>
                    <th className="th text-right">Otros</th>
                    <th className="th text-right">Anticipo</th>
                    <th className="th text-right">Pendiente</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {porEmpleado.map((f) => (
                    <tr key={f.empleado.id} className="hover:bg-slate-50">
                      <td className="td">
                        <Link href={`/panel/empleados/${f.empleado.id}`} className="flex items-center gap-2 group">
                          <Avatar empleado={f.empleado} size={32} />
                          <span>
                            <span className="block font-medium text-slate-700 group-hover:text-ind-600">
                              {f.empleado.nombres} {f.empleado.apellidos}
                              {f.empleado.estado === 'INACTIVO' && <span className="text-xs text-slate-400"> (inactivo)</span>}
                            </span>
                            <span className="block text-xs text-slate-400">{f.meses} meses de nómina</span>
                          </span>
                        </Link>
                      </td>
                      <td className="td text-right text-slate-500">{money(f.devengado)}</td>
                      <td className="td text-right text-emerald-600">{money(f.pagado)}</td>
                      <td className="td text-right text-slate-400">{f.otros_pagos ? money(f.otros_pagos) : '—'}</td>
                      <td className="td text-right">{f.anticipo ? <span className="text-emerald-600">−{money(f.anticipo)}</span> : <span className="text-slate-300">—</span>}</td>
                      <td className="td text-right font-bold">
                        {f.pendiente < 0
                          ? <span className="text-emerald-600 whitespace-nowrap">te debe {money(-f.pendiente)}</span>
                          : <span className={f.pendiente > 0 ? 'text-rose-700' : 'text-slate-400'}>{money(f.pendiente)}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 font-bold">
                  <tr>
                    <td className="td">Totales</td>
                    <td className="td text-right">{money(totales.devengado)}</td>
                    <td className="td text-right text-emerald-700">{money(totales.pagado)}</td>
                    <td className="td text-right text-slate-500">{money(totales.otros_pagos)}</td>
                    <td className="td"></td>
                    <td className="td text-right text-rose-700">{money(totales.pendiente)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )
      ) : (
        <div className="tarjeta overflow-hidden">
          <div className="scroll-x">
            <table className="w-full min-w-[640px]">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Mes</th>
                  <th className="th text-right">Nómina del mes</th>
                  <th className="th text-right">Pagado</th>
                  <th className="th text-right">Saldo del mes</th>
                  <th className="th text-right">Deuda acumulada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {porMes.map((m) => (
                  <tr key={m.periodo} className="hover:bg-slate-50">
                    <td className="td capitalize font-medium text-slate-700">{periodo(m.periodo)}</td>
                    <td className="td text-right text-slate-500">{money(m.devengado)}</td>
                    <td className="td text-right text-emerald-600">{money(m.pagado)}</td>
                    <td className="td text-right">
                      {m.saldo_mes > 0
                        ? <span className="text-amber-600">{money(m.saldo_mes)}</span>
                        : <span className="text-slate-400">{money(m.saldo_mes)}</span>}
                    </td>
                    <td className="td text-right font-bold text-slate-800">{money(m.saldo_acumulado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-3 text-xs text-slate-400 border-t border-slate-100">
            La <b>deuda acumulada</b> es lo que se va arrastrando: si un mes pagas menos que la nómina,
            la diferencia se suma al total. Solo cuenta el sueldo y las horas extra; los bonos y décimos
            van aparte.
          </p>
        </div>
      )}
    </div>
  );
}
