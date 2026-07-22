'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Avatar, Aviso, Cargando, Vacio } from '@/components/ui';
import { fecha, fechaHora, dias, money } from '@/lib/fmt';

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

  async function resolver(recurso, registro, estado, extra = {}) {
    setProcesando(registro.id);
    try {
      await api.editar(recurso, registro.id, { estado, ...extra });
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
            {extras.map((h) => (
              <FilaExtra
                key={h.id}
                extra={h}
                emp={quien(h.empleado_id)}
                cargando={procesando === h.id}
                onAprobar={(datos) => resolver('horas_extra', h, 'APROBADA', datos)}
                onRechazar={() => resolver('horas_extra', h, 'RECHAZADA')}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// Al aprobar horas extra, el jefe/admin fija el recargo y el valor a pagar
// (el empleado solo declaro las horas). Se pre-llena una sugerencia calculada
// con el sueldo, pero es totalmente editable: tu decides el monto.
function FilaExtra({ extra: h, emp, cargando, onAprobar, onRechazar }) {
  const valorHora = Number(emp?.sueldo_base || 0) / 240;
  const [recargo, setRecargo] = useState(50);
  const sugerido = (Number(h.horas) * valorHora * (1 + recargo / 100)).toFixed(2);
  const [valor, setValor] = useState('');

  // El valor sugerido sigue al recargo mientras el usuario no lo haya tecleado.
  const valorEfectivo = valor === '' ? sugerido : valor;

  return (
    <li className="p-4">
      <div className="flex flex-wrap items-start gap-4">
        <Avatar empleado={emp} size={42} />
        <div className="flex-1 min-w-[200px]">
          <p className="font-medium text-slate-800">{emp?.nombres} {emp?.apellidos}</p>
          <p className="text-sm text-slate-500">
            {fecha(h.fecha)} · declaró <b>{dias(h.horas)} h</b> extra
          </p>
          {h.motivo && <p className="text-sm text-slate-500 italic mt-1">“{h.motivo}”</p>}
          <p className="text-xs text-slate-400 mt-1">Solicitada el {fechaHora(h.creado_en)}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3 bg-slate-50 rounded-xl p-3">
        <div>
          <label className="etiqueta">Recargo</label>
          <select className="campo !w-auto" value={recargo} onChange={(e) => setRecargo(Number(e.target.value))}>
            <option value={25}>25%</option>
            <option value={50}>50%</option>
            <option value={100}>100%</option>
          </select>
        </div>
        <div>
          <label className="etiqueta">Valor a pagar</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
            <input
              type="number" step="0.01" className="campo !w-36 pl-6"
              value={valorEfectivo}
              onChange={(e) => setValor(e.target.value)}
            />
          </div>
        </div>
        {emp?.sueldo_base > 0 && (
          <p className="text-xs text-slate-400 pb-2.5">
            Sugerido: {money(sugerido)} (sueldo ÷ 240)
          </p>
        )}
        <div className="flex gap-2 ml-auto pb-0.5">
          <button onClick={onRechazar} disabled={cargando} className="btn-peligro">Rechazar</button>
          <button
            onClick={() => onAprobar({ recargo, valor_total: Number(valorEfectivo) || 0, valor_hora: Number(valorHora.toFixed(4)) })}
            disabled={cargando}
            className="btn-ok"
          >
            {cargando ? '…' : 'Aprobar'}
          </button>
        </div>
      </div>
    </li>
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
