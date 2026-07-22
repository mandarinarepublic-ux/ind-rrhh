'use client';

// Portal del empleado. Pensado para el celular: pocas cosas, grandes y claras.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Avatar, Aviso, Cargando, Chip, Modal, Vacio } from '@/components/ui';
import { fecha, money, dias, diasEntre, hoyISO, periodo } from '@/lib/fmt';

const VISTAS = [
  { id: 'vacaciones', texto: 'Vacaciones', icono: '🏖️' },
  { id: 'pagos',      texto: 'Mis pagos',  icono: '💵' },
  { id: 'extras',     texto: 'Horas extra', icono: '⏱️' },
  { id: 'faltas',     texto: 'Asistencia', icono: '📅' },
];

export default function MiFicha() {
  const router = useRouter();
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const [vista, setVista] = useState('vacaciones');
  const [pidiendo, setPidiendo] = useState(false);
  const [cambiarPin, setCambiarPin] = useState(false);

  async function cargar() {
    try {
      setD(await api.mi());
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { cargar(); }, []);

  async function salir() {
    await api.logout();
    router.replace('/login');
    router.refresh();
  }

  async function cancelarSolicitud(v) {
    if (!confirm('¿Cancelar esta solicitud?')) return;
    try {
      await api.borrar('vacaciones', v.id);
      cargar();
    } catch (e) {
      alert(e.message);
    }
  }

  if (error) return <div className="p-4"><Aviso>{error}</Aviso></div>;
  if (!d) return <Cargando />;

  const esJefatura = ['ADMIN', 'RRHH', 'JEFE'].includes(d.empleado?.rol);

  return (
    <div className="max-w-lg mx-auto pb-10">
      {/* ---------- cabecera ---------- */}
      <header className="bg-ind-700 text-white px-4 pt-6 pb-14 rounded-b-3xl">
        <div className="flex items-center gap-3">
          <Avatar empleado={d.empleado} size={52} />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-lg leading-tight truncate">
              {d.empleado.nombres} {d.empleado.apellidos}
            </p>
            <p className="text-ind-200 text-sm truncate">
              {d.empleado.cargo || '—'} · {d.empleado.area || ''}
            </p>
          </div>
          <button onClick={salir} className="text-ind-200 hover:text-white text-xl px-2" title="Salir">⏻</button>
        </div>
      </header>

      {/* ---------- saldo de vacaciones ---------- */}
      <div className="px-4 -mt-9">
        <div className="tarjeta p-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Vacaciones disponibles
          </p>
          <p className="text-5xl font-bold text-ind-600 my-1">{dias(d.vacaciones.saldo)}</p>
          <p className="text-sm text-slate-500 mb-4">dias acumulados</p>

          <div className="grid grid-cols-3 gap-2 text-center border-t border-slate-100 pt-3 mb-4">
            <Mini titulo="Ganados" valor={dias(d.vacaciones.ganados)} />
            <Mini titulo="Tomados" valor={dias(d.vacaciones.tomados)} />
            <Mini titulo="En tramite" valor={dias(d.vacaciones.enSolicitud)} />
          </div>

          <button onClick={() => setPidiendo(true)} className="btn-primario w-full">
            Solicitar vacaciones
          </button>
        </div>
      </div>

      {/* ---------- avisos ---------- */}
      {d.anticipos.length > 0 && (
        <div className="px-4 mt-4">
          <div className="tarjeta p-4 bg-amber-50 border-amber-200">
            <p className="text-sm font-semibold text-amber-900">Anticipo pendiente</p>
            <p className="text-2xl font-bold text-amber-700">
              {money(d.anticipos.reduce((s, a) => s + Number(a.saldo || 0), 0))}
            </p>
            <p className="text-xs text-amber-800/70">Se descuenta de tus proximos pagos.</p>
          </div>
        </div>
      )}

      {/* ---------- pestanas ---------- */}
      <nav className="px-4 mt-5 flex gap-2 overflow-x-auto pb-1">
        {VISTAS.map((v) => (
          <button
            key={v.id}
            onClick={() => setVista(v.id)}
            className={`px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap ${
              vista === v.id ? 'bg-ind-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            <span className="mr-1">{v.icono}</span>{v.texto}
          </button>
        ))}
      </nav>

      <div className="px-4 mt-3 space-y-3">
        {vista === 'vacaciones' && (
          d.vacaciones.solicitudes.length === 0
            ? <div className="tarjeta"><Vacio icono="🏖️" titulo="Sin vacaciones registradas" /></div>
            : d.vacaciones.solicitudes.map((v) => (
                <div key={v.id} className="tarjeta p-4 flex items-center gap-3">
                  <div className="flex-1">
                    <p className="font-medium text-slate-800">
                      {fecha(v.fecha_desde)} → {fecha(v.fecha_hasta)}
                    </p>
                    <p className="text-sm text-slate-500">{dias(v.dias)} dias</p>
                    {v.observacion && <p className="text-sm text-slate-400 italic">“{v.observacion}”</p>}
                  </div>
                  <div className="text-right space-y-1">
                    <Chip>{v.estado}</Chip>
                    {v.estado === 'PENDIENTE' && (
                      <button
                        onClick={() => cancelarSolicitud(v)}
                        className="block text-xs text-slate-400 hover:text-rose-600 w-full"
                      >
                        cancelar
                      </button>
                    )}
                  </div>
                </div>
              ))
        )}

        {vista === 'pagos' && (
          d.pagos.length === 0
            ? <div className="tarjeta"><Vacio icono="💵" titulo="Sin pagos registrados" /></div>
            : agruparPorMes(d.pagos).map(([mes, delMes, total]) => (
                <div key={mes} className="space-y-2">
                  <div className="flex items-baseline justify-between px-1 pt-1">
                    <h3 className="text-sm font-bold text-slate-700 capitalize">
                      {mes === 'sin-mes' ? 'Sin mes asignado' : periodo(mes)}
                    </h3>
                    <span className="text-sm font-semibold text-emerald-600">{money(total)}</span>
                  </div>
                  {delMes.map((p) => (
                    <div key={p.id} className="tarjeta p-4">
                      <div className="flex justify-between items-start gap-3">
                        <div>
                          <p className="font-medium text-slate-800">{p.concepto.replace(/_/g, ' ')}</p>
                          <p className="text-sm text-slate-500">Pagado el {fecha(p.fecha_pago)}</p>
                        </div>
                        <p className="text-lg font-bold text-emerald-600 whitespace-nowrap">
                          {money(p.monto_neto)}
                        </p>
                      </div>
                      {Number(p.descuentos) > 0 && (
                        <p className="text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100">
                          Bruto {money(p.monto_bruto)} − descuentos {money(p.descuentos)}
                          {p.detalle_desc ? ` (${p.detalle_desc})` : ''}
                        </p>
                      )}
                      {p.comprobante_url && <VerComprobante ruta={p.comprobante_url} />}
                    </div>
                  ))}
                </div>
              ))
        )}

        {vista === 'extras' && (
          <>
            <div className="tarjeta p-4 text-center">
              <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
                Horas extra del anio
              </p>
              <p className="text-3xl font-bold text-slate-800">
                {dias(d.extras.filter((h) => h.estado !== 'RECHAZADA').reduce((s, h) => s + Number(h.horas), 0))} h
              </p>
            </div>
            {d.extras.length === 0
              ? <div className="tarjeta"><Vacio icono="⏱️" titulo="Sin horas extra" /></div>
              : d.extras.map((h) => (
                  <div key={h.id} className="tarjeta p-4 flex justify-between items-center gap-3">
                    <div>
                      <p className="font-medium text-slate-800">{dias(h.horas)} h · +{h.recargo}%</p>
                      <p className="text-sm text-slate-500">{fecha(h.fecha)}</p>
                      {h.motivo && <p className="text-xs text-slate-400">{h.motivo}</p>}
                    </div>
                    <div className="text-right">
                      {h.valor_total && <p className="font-semibold text-slate-700">{money(h.valor_total)}</p>}
                      <Chip>{h.estado}</Chip>
                    </div>
                  </div>
                ))}
          </>
        )}

        {vista === 'faltas' && (
          d.ausencias.length === 0
            ? <div className="tarjeta"><Vacio icono="🎉" titulo="Asistencia perfecta" detalle="Sin faltas ni permisos este anio." /></div>
            : d.ausencias.map((a) => (
                <div key={a.id} className="tarjeta p-4 flex justify-between items-center gap-3">
                  <div>
                    <p className="font-medium text-slate-800">
                      {fecha(a.fecha_desde)}
                      {a.fecha_hasta !== a.fecha_desde && ` → ${fecha(a.fecha_hasta)}`}
                    </p>
                    <p className="text-sm text-slate-500">
                      {dias(a.dias)} dia(s){a.motivo ? ` · ${a.motivo}` : ''}
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <Chip>{a.tipo}</Chip>
                    {a.justificada && <p className="text-xs text-emerald-600">justificada</p>}
                  </div>
                </div>
              ))
        )}
      </div>

      <div className="px-4 mt-6 flex flex-col gap-2">
        <button onClick={() => setCambiarPin(true)} className="btn-suave w-full">
          Cambiar mi PIN
        </button>
        {esJefatura && (
          <Link href="/panel" className="btn-suave w-full">Ir al panel de administracion</Link>
        )}
      </div>

      <Modal abierto={pidiendo} titulo="Solicitar vacaciones" onCerrar={() => setPidiendo(false)}>
        <FormVacaciones
          empleadoId={d.empleado.id}
          saldo={Number(d.vacaciones.saldo)}
          onCancelar={() => setPidiendo(false)}
          onListo={() => { setPidiendo(false); cargar(); }}
        />
      </Modal>

      <Modal abierto={cambiarPin} titulo="Cambiar mi PIN" onCerrar={() => setCambiarPin(false)} ancho="max-w-sm">
        <FormPin
          empleadoId={d.empleado.id}
          onCancelar={() => setCambiarPin(false)}
          onListo={() => setCambiarPin(false)}
        />
      </Modal>
    </div>
  );
}

/**
 * Agrupa los pagos por el MES AL QUE CORRESPONDEN (periodo), no por la fecha
 * en que se hicieron. Devuelve [ [mes, pagosDelMes, totalNeto], ... ] con los
 * meses mas recientes primero. Los pagos sin periodo caen en 'sin-mes'.
 */
function agruparPorMes(pagos) {
  const mapa = new Map();
  for (const p of pagos) {
    const mes = p.periodo || 'sin-mes';
    if (!mapa.has(mes)) mapa.set(mes, []);
    mapa.get(mes).push(p);
  }
  return [...mapa.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1)) // mes mas nuevo arriba
    .map(([mes, lista]) => [mes, lista, lista.reduce((s, p) => s + Number(p.monto_neto || 0), 0)]);
}

/** Abre el comprobante con un enlace firmado momentaneo. */
function VerComprobante({ ruta }) {
  const [abriendo, setAbriendo] = useState(false);

  async function abrir() {
    setAbriendo(true);
    try {
      const res = await fetch(`/api/archivos?ruta=${encodeURIComponent(ruta)}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      window.open(json.url, '_blank', 'noopener');
    } catch (e) {
      alert(e.message);
    } finally {
      setAbriendo(false);
    }
  }

  return (
    <button
      onClick={abrir}
      disabled={abriendo}
      className="mt-2 text-sm text-ind-600 hover:underline"
    >
      📎 {abriendo ? 'Abriendo…' : 'Ver comprobante'}
    </button>
  );
}

const Mini = ({ titulo, valor }) => (
  <div>
    <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">{titulo}</p>
    <p className="font-semibold text-slate-700">{valor}</p>
  </div>
);

function FormVacaciones({ empleadoId, saldo, onListo, onCancelar }) {
  const [desde, setDesde] = useState(hoyISO());
  const [hasta, setHasta] = useState(hoyISO());
  const [obs, setObs] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const cantidad = diasEntre(desde, hasta);
  const alcanza = cantidad <= saldo;

  async function enviar(e) {
    e.preventDefault();
    setError('');
    if (!cantidad) return setError('Las fechas no son validas.');

    setEnviando(true);
    try {
      await api.crear('vacaciones', {
        empleado_id: empleadoId,
        fecha_desde: desde,
        fecha_hasta: hasta,
        dias: cantidad,
        observacion: obs,
      });
      onListo();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="etiqueta">Desde</label>
          <input type="date" className="campo" required value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div>
          <label className="etiqueta">Hasta</label>
          <input type="date" className="campo" required value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} />
        </div>
      </div>

      <div className={`rounded-xl p-3 text-sm ${alcanza ? 'bg-slate-50 text-slate-600' : 'bg-amber-50 text-amber-800'}`}>
        Estas pidiendo <b>{cantidad} dia(s)</b> y tienes <b>{dias(saldo)}</b> disponibles.
        {!alcanza && ' Puedes enviarla igual, pero Recursos Humanos tendra que revisarla.'}
      </div>

      <div>
        <label className="etiqueta">Motivo (opcional)</label>
        <textarea className="campo" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
      </div>

      <Aviso>{error}</Aviso>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancelar} className="btn-suave">Cancelar</button>
        <button className="btn-primario" disabled={enviando}>
          {enviando ? 'Enviando…' : 'Enviar solicitud'}
        </button>
      </div>
    </form>
  );
}

function FormPin({ empleadoId, onListo, onCancelar }) {
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function guardar(e) {
    e.preventDefault();
    setError('');
    if (pin !== pin2) return setError('Los dos PIN no coinciden.');
    if (!/^\d{6}$/.test(pin)) return setError('El PIN debe ser de 6 digitos.');

    setGuardando(true);
    try {
      await api.editar('empleados', empleadoId, { pin });
      alert('PIN actualizado.');
      onListo();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="space-y-4">
      <div>
        <label className="etiqueta">Nuevo PIN</label>
        <input
          className="campo text-center text-xl tracking-[0.4em]" type="password" inputMode="numeric"
          maxLength={6} required value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
        />
      </div>
      <div>
        <label className="etiqueta">Repitelo</label>
        <input
          className="campo text-center text-xl tracking-[0.4em]" type="password" inputMode="numeric"
          maxLength={6} required value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))}
        />
      </div>

      <Aviso>{error}</Aviso>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancelar} className="btn-suave">Cancelar</button>
        <button className="btn-primario" disabled={guardando}>Guardar</button>
      </div>
    </form>
  );
}
