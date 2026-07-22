'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Avatar, Cargando, Chip, Metrica, Aviso, Vacio } from '@/components/ui';
import { money, dias, fecha, periodo } from '@/lib/fmt';

export default function Resumen() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.dashboard().then(setDatos).catch((e) => setError(e.message));
  }, []);

  if (error) return <Aviso>{error}</Aviso>;
  if (!datos) return <Cargando />;

  const { totales, equipo, pendientes } = datos;
  const activos = equipo.filter((e) => e.estado !== 'INACTIVO');
  const hoyFuera = activos.filter((e) => e.de_vacaciones_hoy);
  const porAprobar = totales.extrasPendientes + totales.vacacionesPendientes + (totales.ausenciasPendientes || 0);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Resumen</h1>
          <p className="text-sm text-slate-500 capitalize">{periodo(datos.periodo)}</p>
        </div>
        <Link href="/panel/empleados" className="btn-primario">+ Registrar movimiento</Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metrica titulo="En nomina" valor={totales.activos} detalle="personas activas" />
        <Metrica
          titulo="Por aprobar"
          valor={porAprobar}
          detalle={`${totales.vacacionesPendientes} vac · ${totales.extrasPendientes} extras · ${totales.ausenciasPendientes || 0} ausencias`}
          tono={porAprobar ? 'ambar' : 'slate'}
        />
        <Metrica titulo="Pagado este mes" valor={money(totales.pagadoMes)} tono="verde" />
        <Metrica
          titulo="Anticipos por cobrar"
          valor={money(totales.deudaAnticipos)}
          tono={totales.deudaAnticipos > 0 ? 'rojo' : 'slate'}
        />
      </div>

      {porAprobar > 0 && (
        <div className="tarjeta p-4 border-amber-200 bg-amber-50/60">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="font-semibold text-amber-900">
                Tienes {porAprobar} solicitud{porAprobar === 1 ? '' : 'es'} esperando respuesta
              </p>
              <p className="text-sm text-amber-800/80">
                {pendientes.vacaciones.length} de vacaciones, {pendientes.extras.length} de horas extra
                {pendientes.ausencias?.length ? ` y ${pendientes.ausencias.length} de ausencias` : ''}.
              </p>
            </div>
            <Link href="/panel/aprobaciones" className="btn-primario">Revisar</Link>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <section className="tarjeta p-4">
          <h2 className="font-semibold text-slate-700 mb-3">Fuera hoy</h2>
          {hoyFuera.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">Equipo completo 🎉</p>
          ) : (
            <ul className="space-y-2">
              {hoyFuera.map((e) => (
                <li key={e.id} className="flex items-center gap-2">
                  <Avatar empleado={e} size={32} />
                  <span className="text-sm text-slate-700">{e.nombres} {e.apellidos}</span>
                  <Chip tono="VACACIONES">vacaciones</Chip>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="tarjeta p-4">
          <h2 className="font-semibold text-slate-700 mb-1">Faltas del mes</h2>
          <p className="text-3xl font-bold text-rose-600">{dias(totales.faltasMes)}</p>
          <p className="text-xs text-slate-400 mb-3">días perdidos en total</p>
          {datos.ausenciasMes.filter((a) => a.tipo === 'FALTA').slice(0, 4).map((a) => {
            const emp = equipo.find((e) => e.id === a.empleado_id);
            return (
              <div key={a.id} className="flex justify-between text-sm py-1 border-t border-slate-100">
                <span className="text-slate-600 truncate">{emp?.nombres} {emp?.apellidos}</span>
                <span className="text-slate-400 shrink-0 ml-2">{fecha(a.fecha_desde)}</span>
              </div>
            );
          })}
        </section>

        <section className="tarjeta p-4">
          <h2 className="font-semibold text-slate-700 mb-3">Vacaciones acumuladas</h2>
          <ul className="space-y-1.5">
            {[...activos]
              .sort((a, b) => Number(b.vac_saldo || 0) - Number(a.vac_saldo || 0))
              .slice(0, 5)
              .map((e) => (
                <li key={e.id} className="flex justify-between text-sm">
                  <span className="text-slate-600 truncate">{e.nombres} {e.apellidos}</span>
                  <span className="font-semibold text-slate-700 shrink-0 ml-2">
                    {dias(e.vac_saldo)} d
                  </span>
                </li>
              ))}
          </ul>
          <p className="text-xs text-slate-400 mt-3">
            Saldos altos = riesgo de pago acumulado. Conviene irlos programando.
          </p>
        </section>
      </div>

      <section className="tarjeta overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-700">Equipo</h2>
          <Link href="/panel/empleados" className="text-sm text-ind-600 hover:underline">
            Ver todo
          </Link>
        </div>

        {activos.length === 0 ? (
          <Vacio
            icono="👥"
            titulo="Todavía no hay nadie cargado"
            detalle="Empieza registrando a las personas del equipo."
            accion={<Link href="/panel/empleados" className="btn-primario">Agregar empleados</Link>}
          />
        ) : (
          <div className="scroll-x">
            <table className="w-full min-w-[640px]">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Persona</th>
                  <th className="th">Área</th>
                  <th className="th text-right">Vacaciones</th>
                  <th className="th text-right">Extras mes</th>
                  <th className="th text-right">Faltas mes</th>
                  <th className="th text-right">Último pago</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activos.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="td">
                      <Link href={`/panel/empleados/${e.id}`} className="flex items-center gap-2 group">
                        <Avatar empleado={e} size={34} />
                        <span>
                          <span className="block font-medium text-slate-700 group-hover:text-ind-600">
                            {e.nombres} {e.apellidos}
                          </span>
                          <span className="block text-xs text-slate-400">{e.cargo || '—'}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="td text-slate-500">{e.area || '—'}</td>
                    <td className="td text-right font-medium">{dias(e.vac_saldo)} d</td>
                    <td className="td text-right">
                      {dias(e.extras_horas_mes)} h
                      {Number(e.extras_pendientes) > 0 && (
                        <span className="ml-1 text-amber-600 text-xs">
                          (+{dias(e.extras_pendientes)} por aprobar)
                        </span>
                      )}
                    </td>
                    <td className="td text-right">
                      {Number(e.faltas_mes) > 0
                        ? <span className="text-rose-600 font-medium">{dias(e.faltas_mes)}</span>
                        : <span className="text-slate-300">0</span>}
                    </td>
                    <td className="td text-right text-slate-500">{fecha(e.ultimo_pago)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
