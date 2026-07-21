'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Avatar, Aviso, Cargando, Vacio } from '@/components/ui';
import { fecha, dias, money } from '@/lib/fmt';

export default function Aprobaciones() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [procesando, setProcesando] = useState(null);

  async function cargar() {
    try {
      setDatos(await api.dashboard());
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { cargar(); }, []);

  async function resolver(recurso, registro, estado) {
    setProcesando(registro.id);
    try {
      await api.editar(recurso, registro.id, { estado });
      await cargar();
    } catch (e) {
      alert(e.message);
    } finally {
      setProcesando(null);
    }
  }

  if (error) return <Aviso>{error}</Aviso>;
  if (!datos) return <Cargando />;

  const quien = (id) => datos.equipo.find((e) => e.id === id);
  const { vacaciones, extras } = datos.pendientes;
  const nada = vacaciones.length === 0 && extras.length === 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Aprobaciones</h1>
        <p className="text-sm text-slate-500">Solicitudes esperando tu respuesta</p>
      </div>

      {nada && (
        <div className="tarjeta">
          <Vacio icono="✅" titulo="Nada pendiente" detalle="Todas las solicitudes estan resueltas." />
        </div>
      )}

      {vacaciones.length > 0 && (
        <section className="tarjeta overflow-hidden">
          <h2 className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-700">
            🏖️ Vacaciones ({vacaciones.length})
          </h2>
          <ul className="divide-y divide-slate-100">
            {vacaciones.map((v) => {
              const emp = quien(v.empleado_id);
              const saldo = Number(emp?.vac_saldo || 0);
              const alcanza = saldo >= Number(v.dias);
              return (
                <li key={v.id} className="p-4 flex flex-wrap items-center gap-4">
                  <Avatar empleado={emp} size={42} />
                  <div className="flex-1 min-w-[200px]">
                    <p className="font-medium text-slate-800">
                      {emp?.nombres} {emp?.apellidos}
                    </p>
                    <p className="text-sm text-slate-500">
                      {fecha(v.fecha_desde)} → {fecha(v.fecha_hasta)} · <b>{dias(v.dias)} dias</b>
                    </p>
                    <p className={`text-xs mt-0.5 ${alcanza ? 'text-slate-400' : 'text-rose-600 font-medium'}`}>
                      {alcanza
                        ? `Le quedan ${dias(saldo)} dias de saldo`
                        : `⚠️ Solo tiene ${dias(saldo)} dias de saldo`}
                    </p>
                    {v.observacion && (
                      <p className="text-sm text-slate-500 italic mt-1">“{v.observacion}”</p>
                    )}
                  </div>
                  <Botones
                    cargando={procesando === v.id}
                    onAprobar={() => resolver('vacaciones', v, 'APROBADA')}
                    onRechazar={() => resolver('vacaciones', v, 'RECHAZADA')}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {extras.length > 0 && (
        <section className="tarjeta overflow-hidden">
          <h2 className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-700">
            ⏱️ Horas extra ({extras.length})
          </h2>
          <ul className="divide-y divide-slate-100">
            {extras.map((h) => {
              const emp = quien(h.empleado_id);
              return (
                <li key={h.id} className="p-4 flex flex-wrap items-center gap-4">
                  <Avatar empleado={emp} size={42} />
                  <div className="flex-1 min-w-[200px]">
                    <p className="font-medium text-slate-800">
                      {emp?.nombres} {emp?.apellidos}
                    </p>
                    <p className="text-sm text-slate-500">
                      {fecha(h.fecha)} · <b>{dias(h.horas)} h</b> con recargo del {h.recargo}%
                      {h.valor_total ? ` · ${money(h.valor_total)}` : ''}
                    </p>
                    {h.motivo && <p className="text-sm text-slate-500 italic mt-1">“{h.motivo}”</p>}
                  </div>
                  <Botones
                    cargando={procesando === h.id}
                    onAprobar={() => resolver('horas_extra', h, 'APROBADA')}
                    onRechazar={() => resolver('horas_extra', h, 'RECHAZADA')}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function Botones({ cargando, onAprobar, onRechazar }) {
  return (
    <div className="flex gap-2">
      <button onClick={onRechazar} disabled={cargando} className="btn-peligro">Rechazar</button>
      <button onClick={onAprobar} disabled={cargando} className="btn-ok">
        {cargando ? '…' : 'Aprobar'}
      </button>
    </div>
  );
}
