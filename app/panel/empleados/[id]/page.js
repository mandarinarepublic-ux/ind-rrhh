'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Avatar, Aviso, Cargando, Chip, Modal, Vacio } from '@/components/ui';
import Adjunto from '@/components/Adjunto';
import FormEmpleado from '@/components/FormEmpleado';
import { fecha, money, dias, diasEntre, hoyISO, periodo, periodoActual } from '@/lib/fmt';

const PESTANAS = [
  { id: 'ausencias',   texto: 'Faltas y permisos', icono: '🚫' },
  { id: 'horas_extra', texto: 'Horas extra',       icono: '⏱️' },
  { id: 'vacaciones',  texto: 'Vacaciones',        icono: '🏖️' },
  { id: 'pagos',       texto: 'Pagos',             icono: '💵' },
  { id: 'anticipos',   texto: 'Anticipos',         icono: '🤝' },
];

export default function Expediente() {
  const { id } = useParams();

  const [empleado, setEmpleado] = useState(null);
  const [saldo, setSaldo] = useState(null);
  const [pestana, setPestana] = useState('ausencias');
  const [registros, setRegistros] = useState(null);
  const [editando, setEditando] = useState(null); // registro | 'nuevo' | null
  const [editandoFicha, setEditandoFicha] = useState(false);
  const [jefes, setJefes] = useState([]);
  const [error, setError] = useState('');

  const cargarFicha = useCallback(async () => {
    try {
      const [emp, sal] = await Promise.all([
        api.listar('empleados', { empleado_id: id }),
        api.listar('vw_vacaciones_saldo', { empleado_id: id }),
      ]);
      setEmpleado(emp[0] || null);
      setSaldo(sal[0] || null);
    } catch (e) {
      setError(e.message);
    }
  }, [id]);

  // La lista de posibles jefes se necesita solo al abrir la edicion.
  async function abrirEdicion() {
    try {
      const todos = await api.listar('empleados');
      setJefes(todos.filter((e) => ['JEFE', 'ADMIN', 'RRHH'].includes(e.rol)));
    } catch {
      setJefes([]);
    }
    setEditandoFicha(true);
  }

  const cargarPestana = useCallback(async () => {
    setRegistros(null);
    try {
      setRegistros(await api.listar(pestana, { empleado_id: id }));
    } catch (e) {
      setError(e.message);
    }
  }, [pestana, id]);

  useEffect(() => { cargarFicha(); }, [cargarFicha]);
  useEffect(() => { cargarPestana(); }, [cargarPestana]);

  async function borrar(registro) {
    if (!confirm('¿Borrar este registro? No se puede deshacer.')) return;
    try {
      await api.borrar(pestana, registro.id);
      cargarPestana();
      cargarFicha();
    } catch (e) {
      alert(e.message);
    }
  }

  if (error) return <Aviso>{error}</Aviso>;
  if (!empleado) return <Cargando />;

  return (
    <div className="space-y-5">
      <Link href="/panel/empleados" className="text-sm text-slate-500 hover:text-ind-600">
        ← Volver al equipo
      </Link>

      {/* ---------- cabecera ---------- */}
      <div className="tarjeta p-5">
        <div className="flex items-start gap-4 flex-wrap">
          <Avatar empleado={empleado} size={64} />
          <div className="flex-1 min-w-[200px]">
            <h1 className="text-xl font-bold text-slate-800">
              {empleado.nombres} {empleado.apellidos}
            </h1>
            <p className="text-slate-500">
              {empleado.cargo || 'Sin cargo'} · {empleado.area || 'Sin area'}
            </p>
            <div className="flex gap-2 mt-2 flex-wrap">
              <Chip>{empleado.estado}</Chip>
              {empleado.rol !== 'EMPLEADO' && <Chip tono="GOZADA">{empleado.rol}</Chip>}
              <Chip tono="CANCELADA">{empleado.tipo_contrato}</Chip>
            </div>
          </div>

          <button onClick={abrirEdicion} className="btn-suave shrink-0">
            ✏️ Editar datos
          </button>

          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm w-full lg:w-auto">
            <Dato titulo="Cedula" valor={empleado.cedula} />
            <Dato titulo="Ingreso" valor={fecha(empleado.fecha_ingreso)} />
            <Dato titulo="Sueldo" valor={money(empleado.sueldo_base)} />
            <Dato
              titulo="Vacaciones"
              valor={`${dias(saldo?.saldo)} d`}
              resaltar={Number(saldo?.saldo) > 30}
            />
          </dl>
        </div>
      </div>

      <Modal
        abierto={editandoFicha}
        titulo={`Editar · ${empleado.nombres} ${empleado.apellidos}`}
        onCerrar={() => setEditandoFicha(false)}
        ancho="max-w-3xl"
      >
        <FormEmpleado
          empleado={empleado}
          jefes={jefes}
          onCancelar={() => setEditandoFicha(false)}
          onListo={() => { setEditandoFicha(false); cargarFicha(); }}
        />
      </Modal>

      {/* ---------- pestanas ---------- */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPestana(p.id)}
            className={`px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition ${
              pestana === p.id
                ? 'bg-ind-600 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span className="mr-1.5">{p.icono}</span>
            {p.texto}
          </button>
        ))}
      </div>

      <div className="tarjeta overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-700">
            {PESTANAS.find((p) => p.id === pestana)?.texto}
          </h2>
          <button onClick={() => setEditando('nuevo')} className="btn-primario !py-2 !px-3 text-sm">
            + Registrar
          </button>
        </div>

        {registros === null ? (
          <Cargando />
        ) : registros.length === 0 ? (
          <Vacio icono="📄" titulo="Sin registros todavia" />
        ) : (
          <Listado
            pestana={pestana}
            registros={registros}
            onEditar={setEditando}
            onBorrar={borrar}
          />
        )}
      </div>

      <Modal
        abierto={Boolean(editando)}
        titulo={`${editando === 'nuevo' ? 'Registrar' : 'Editar'} · ${PESTANAS.find((p) => p.id === pestana)?.texto}`}
        onCerrar={() => setEditando(null)}
      >
        <FormRegistro
          pestana={pestana}
          empleado={empleado}
          registro={editando === 'nuevo' ? null : editando}
          onCancelar={() => setEditando(null)}
          onListo={() => { setEditando(null); cargarPestana(); cargarFicha(); }}
        />
      </Modal>
    </div>
  );
}

function Dato({ titulo, valor, resaltar }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{titulo}</dt>
      <dd className={`font-semibold ${resaltar ? 'text-amber-600' : 'text-slate-700'}`}>{valor}</dd>
    </div>
  );
}

// =====================================================================
// Listados por pestana
// =====================================================================
function Listado({ pestana, registros, onEditar, onBorrar }) {
  // Toda la fila abre la edicion; el boton de borrar no debe propagarse.
  const Fila = ({ registro, children }) => (
    <tr
      onClick={() => onEditar(registro)}
      className="hover:bg-ind-50/50 border-t border-slate-100 cursor-pointer"
      title="Clic para editar"
    >
      {children}
    </tr>
  );

  const columnas = {
    ausencias: ['Fecha', 'Tipo', 'Dias', 'Justificada', 'Motivo', ''],
    horas_extra: ['Fecha', 'Horas', 'Recargo', 'Valor', 'Estado', ''],
    vacaciones: ['Desde', 'Hasta', 'Dias', 'Estado', 'Observacion', ''],
    pagos: ['Fecha', 'Concepto', 'Mes', 'Bruto', 'Desc.', 'Neto', ''],
    anticipos: ['Fecha', 'Monto', 'Cuotas', 'Motivo', 'Estado', ''],
  }[pestana];

  return (
    <div className="scroll-x">
      <table className="w-full min-w-[640px]">
        <thead className="bg-slate-50">
          <tr>{columnas.map((c, i) => <th key={i} className="th">{c}</th>)}</tr>
        </thead>
        <tbody>
          {registros.map((r) => {
            const borrarBtn = (
              <td className="td text-right">
                <button
                  onClick={(e) => { e.stopPropagation(); onBorrar(r); }}
                  className="text-slate-300 hover:text-rose-600"
                  title="Borrar"
                >
                  ✕
                </button>
              </td>
            );

            if (pestana === 'ausencias') return (
              <Fila key={r.id} registro={r}>
                <td className="td">{fecha(r.fecha_desde)}
                  {r.fecha_hasta !== r.fecha_desde && <span className="text-slate-400"> → {fecha(r.fecha_hasta)}</span>}
                </td>
                <td className="td"><Chip>{r.tipo}</Chip></td>
                <td className="td">{dias(r.dias)}</td>
                <td className="td">{r.justificada ? '✅ si' : '❌ no'}</td>
                <td className="td text-slate-500 max-w-[220px] truncate">
                  {r.adjunto_url && <span title="Tiene adjunto">📎 </span>}
                  {r.motivo || '—'}
                </td>
                {borrarBtn}
              </Fila>
            );

            if (pestana === 'horas_extra') return (
              <Fila key={r.id} registro={r}>
                <td className="td">{fecha(r.fecha)}</td>
                <td className="td font-medium">{dias(r.horas)} h</td>
                <td className="td">+{r.recargo}%</td>
                <td className="td">{r.valor_total ? money(r.valor_total) : '—'}</td>
                <td className="td"><Chip>{r.estado}</Chip></td>
                {borrarBtn}
              </Fila>
            );

            if (pestana === 'vacaciones') return (
              <Fila key={r.id} registro={r}>
                <td className="td">{fecha(r.fecha_desde)}</td>
                <td className="td">{fecha(r.fecha_hasta)}</td>
                <td className="td font-medium">{dias(r.dias)}</td>
                <td className="td"><Chip>{r.estado}</Chip></td>
                <td className="td text-slate-500 max-w-[220px] truncate">{r.observacion || '—'}</td>
                {borrarBtn}
              </Fila>
            );

            if (pestana === 'pagos') return (
              <Fila key={r.id} registro={r}>
                <td className="td whitespace-nowrap">
                  {r.comprobante_url && <span title="Tiene comprobante">📎 </span>}
                  {fecha(r.fecha_pago)}
                </td>
                <td className="td"><Chip tono="CANCELADA">{r.concepto.replace(/_/g, ' ')}</Chip></td>
                <td className="td text-slate-500 capitalize">{periodo(r.periodo)}</td>
                <td className="td">{money(r.monto_bruto)}</td>
                <td className="td text-rose-600">{Number(r.descuentos) ? `−${money(r.descuentos)}` : '—'}</td>
                <td className="td font-semibold">{money(r.monto_neto)}</td>
                {borrarBtn}
              </Fila>
            );

            return (
              <Fila key={r.id} registro={r}>
                <td className="td">{fecha(r.fecha)}</td>
                <td className="td font-medium">{money(r.monto)}</td>
                <td className="td">{r.cuotas}</td>
                <td className="td text-slate-500 max-w-[220px] truncate">{r.motivo || '—'}</td>
                <td className="td"><Chip>{r.estado}</Chip></td>
                {borrarBtn}
              </Fila>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// =====================================================================
// Formulario de alta, uno por pestana
// =====================================================================
function FormRegistro({ pestana, empleado, registro, onListo, onCancelar }) {
  const hoy = hoyISO();
  const editando = Boolean(registro?.id);

  const iniciales = {
    ausencias:   { fecha_desde: hoy, fecha_hasta: hoy, tipo: 'FALTA', justificada: false, con_sueldo: false, motivo: '', adjunto_url: null },
    horas_extra: { fecha: hoy, horas: '', recargo: 50, motivo: '', estado: 'APROBADA' },
    vacaciones:  { fecha_desde: hoy, fecha_hasta: hoy, estado: 'APROBADA', observacion: '' },
    pagos:       { fecha_pago: hoy, periodo: periodoActual(), concepto: 'SUELDO', monto_bruto: '', descuentos: '', detalle_desc: '', metodo: 'TRANSFERENCIA', referencia: '', comprobante_url: null },
    anticipos:   { fecha: hoy, monto: '', cuotas: 1, motivo: '' },
  }[pestana];

  // Al editar se parte del registro real; las fechas vienen con hora y hay que recortarlas.
  const [f, setF] = useState(() => {
    if (!editando) return iniciales;
    const base = { ...iniciales, ...registro };
    for (const k of ['fecha', 'fecha_desde', 'fecha_hasta', 'fecha_pago']) {
      if (base[k]) base[k] = String(base[k]).slice(0, 10);
    }
    for (const k of ['monto_bruto', 'descuentos', 'monto', 'horas']) {
      if (base[k] !== undefined && base[k] !== null) base[k] = String(base[k]);
    }
    return base;
  });
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const set = (k) => (e) =>
    setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  // Sueldo mensual -> valor de la hora (jornada legal de 240 h al mes).
  const valorHora = Number(empleado.sueldo_base || 0) / 240;

  async function guardar(e) {
    e.preventDefault();
    setError('');
    setGuardando(true);

    try {
      const datos = { ...f, empleado_id: empleado.id };

      if (pestana === 'ausencias' || pestana === 'vacaciones') {
        datos.dias = diasEntre(f.fecha_desde, f.fecha_hasta);
        if (!datos.dias) throw new Error('El rango de fechas no es valido.');
      }

      if (pestana === 'horas_extra') {
        datos.horas = Number(f.horas);
        if (!datos.horas) throw new Error('Indica cuantas horas.');
        datos.valor_hora = Number(valorHora.toFixed(4));
        datos.valor_total = Number((datos.horas * valorHora * (1 + Number(f.recargo) / 100)).toFixed(2));
      }

      if (pestana === 'pagos') {
        datos.monto_bruto = Number(f.monto_bruto || 0);
        datos.descuentos = Number(f.descuentos || 0);
        if (!datos.monto_bruto) throw new Error('Indica el monto.');
      }

      if (pestana === 'anticipos') {
        datos.monto = Number(f.monto || 0);
        datos.cuotas = Number(f.cuotas || 1);
        if (!datos.monto) throw new Error('Indica el monto.');
      }

      if (editando) {
        // Campos que pone el sistema, no el formulario.
        for (const k of ['id', 'creado_en', 'actualizado_en', 'monto_neto', 'registrado_por', 'aprobado_por', 'aprobado_en']) {
          delete datos[k];
        }
        await api.editar(pestana, registro.id, datos);
      } else {
        await api.crear(pestana, datos);
      }
      onListo();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  const total = pestana === 'horas_extra' && f.horas
    ? Number(f.horas) * valorHora * (1 + Number(f.recargo) / 100)
    : 0;

  return (
    <form onSubmit={guardar} className="space-y-4">
      {pestana === 'ausencias' && (
        <>
          <div className="grid sm:grid-cols-3 gap-3">
            <L t="Desde"><input type="date" className="campo" required value={f.fecha_desde} onChange={set('fecha_desde')} /></L>
            <L t="Hasta"><input type="date" className="campo" required value={f.fecha_hasta} onChange={set('fecha_hasta')} /></L>
            <L t="Tipo">
              <select className="campo" value={f.tipo} onChange={set('tipo')}>
                {['FALTA', 'ATRASO', 'PERMISO', 'ENFERMEDAD', 'CALAMIDAD', 'MATERNIDAD', 'PATERNIDAD', 'SUSPENSION', 'OTRO']
                  .map((t) => <option key={t}>{t}</option>)}
              </select>
            </L>
          </div>
          <p className="text-sm text-slate-500">
            Son <b>{diasEntre(f.fecha_desde, f.fecha_hasta)}</b> dia(s).
          </p>
          <div className="flex gap-5">
            <Check checked={f.justificada} onChange={set('justificada')}>Justificada</Check>
            <Check checked={f.con_sueldo} onChange={set('con_sueldo')}>Se le paga igual</Check>
          </div>
          <L t="Motivo"><textarea className="campo" rows={2} value={f.motivo} onChange={set('motivo')} /></L>
          <Adjunto
            empleadoId={empleado.id}
            carpeta="ausencias"
            etiqueta="Certificado o respaldo (opcional)"
            valor={f.adjunto_url}
            onCambio={(ruta) => setF({ ...f, adjunto_url: ruta })}
          />
        </>
      )}

      {pestana === 'horas_extra' && (
        <>
          <div className="grid sm:grid-cols-3 gap-3">
            <L t="Fecha"><input type="date" className="campo" required value={f.fecha} onChange={set('fecha')} /></L>
            <L t="Horas"><input type="number" step="0.5" min="0.5" className="campo" required value={f.horas} onChange={set('horas')} /></L>
            <L t="Recargo">
              <select className="campo" value={f.recargo} onChange={set('recargo')}>
                <option value={25}>25% — hasta las 24h</option>
                <option value={50}>50% — nocturna</option>
                <option value={100}>100% — fin de semana o feriado</option>
              </select>
            </L>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 text-sm">
            <p className="text-slate-500">
              Hora base: <b>{money(valorHora)}</b> (sueldo ÷ 240 h)
            </p>
            <p className="text-slate-800 font-semibold mt-0.5">A pagar: {money(total)}</p>
            {!empleado.sueldo_base && (
              <p className="text-amber-600 mt-1">
                Este empleado no tiene sueldo cargado, por eso el valor sale en cero.
              </p>
            )}
          </div>
          <L t="Motivo"><input className="campo" value={f.motivo} onChange={set('motivo')} placeholder="Cierre de pedido, inventario…" /></L>
        </>
      )}

      {pestana === 'vacaciones' && (
        <>
          <div className="grid sm:grid-cols-3 gap-3">
            <L t="Desde"><input type="date" className="campo" required value={f.fecha_desde} onChange={set('fecha_desde')} /></L>
            <L t="Hasta"><input type="date" className="campo" required value={f.fecha_hasta} onChange={set('fecha_hasta')} /></L>
            <L t="Estado">
              <select className="campo" value={f.estado} onChange={set('estado')}>
                {['APROBADA', 'PENDIENTE', 'GOZADA'].map((t) => <option key={t}>{t}</option>)}
              </select>
            </L>
          </div>
          <p className="text-sm text-slate-500">
            Son <b>{diasEntre(f.fecha_desde, f.fecha_hasta)}</b> dia(s), que se descuentan del saldo.
          </p>
          <L t="Observacion"><input className="campo" value={f.observacion} onChange={set('observacion')} /></L>
        </>
      )}

      {pestana === 'pagos' && (
        <>
          <div className="grid sm:grid-cols-3 gap-3">
            <L t="Fecha de pago"><input type="date" className="campo" required value={f.fecha_pago} onChange={set('fecha_pago')} /></L>
            <L t="Mes al que corresponde">
              <input type="month" className="campo" value={f.periodo || ''} onChange={set('periodo')} />
            </L>
            <L t="Concepto">
              <select className="campo" value={f.concepto} onChange={set('concepto')}>
                {['SUELDO', 'QUINCENA', 'HORAS_EXTRA', 'DECIMO_TERCERO', 'DECIMO_CUARTO', 'FONDOS_RESERVA',
                  'VACACIONES', 'BONO', 'COMISION', 'LIQUIDACION', 'ANTICIPO', 'OTRO']
                  .map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </L>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <L t="Monto bruto"><input type="number" step="0.01" className="campo" required value={f.monto_bruto} onChange={set('monto_bruto')} /></L>
            <L t="Descuentos"><input type="number" step="0.01" className="campo" value={f.descuentos} onChange={set('descuentos')} /></L>
            <L t="Metodo">
              <select className="campo" value={f.metodo} onChange={set('metodo')}>
                {['TRANSFERENCIA', 'EFECTIVO', 'CHEQUE', 'OTRO'].map((t) => <option key={t}>{t}</option>)}
              </select>
            </L>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-sm text-slate-500">Neto a recibir</p>
            <p className="text-xl font-bold text-slate-800">
              {money(Number(f.monto_bruto || 0) - Number(f.descuentos || 0))}
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <L t="Detalle del descuento"><input className="campo" value={f.detalle_desc} onChange={set('detalle_desc')} placeholder="IESS, anticipo, multa…" /></L>
            <L t="Referencia"><input className="campo" value={f.referencia} onChange={set('referencia')} placeholder="Nro de transferencia" /></L>
          </div>
          <Adjunto
            empleadoId={empleado.id}
            carpeta="comprobantes"
            etiqueta="Comprobante de la transferencia"
            valor={f.comprobante_url}
            onCambio={(ruta) => setF({ ...f, comprobante_url: ruta })}
          />
        </>
      )}

      {pestana === 'anticipos' && (
        <>
          <div className="grid sm:grid-cols-3 gap-3">
            <L t="Fecha"><input type="date" className="campo" required value={f.fecha} onChange={set('fecha')} /></L>
            <L t="Monto"><input type="number" step="0.01" className="campo" required value={f.monto} onChange={set('monto')} /></L>
            <L t="Cuotas"><input type="number" min="1" className="campo" value={f.cuotas} onChange={set('cuotas')} /></L>
          </div>
          <L t="Motivo"><input className="campo" value={f.motivo} onChange={set('motivo')} /></L>
        </>
      )}

      <Aviso>{error}</Aviso>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancelar} className="btn-suave">Cancelar</button>
        <button className="btn-primario" disabled={guardando}>
          {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}

const L = ({ t, children }) => (
  <div>
    <label className="etiqueta">{t}</label>
    {children}
  </div>
);

const Check = ({ checked, onChange, children }) => (
  <label className="flex items-center gap-2 text-sm text-slate-700">
    <input type="checkbox" checked={checked} onChange={onChange} className="rounded border-slate-300" />
    {children}
  </label>
);
