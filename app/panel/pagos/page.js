'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { Avatar, Aviso, Cargando, Chip, Metrica, Modal, Vacio } from '@/components/ui';
import Adjunto from '@/components/Adjunto';
import { fecha, money, periodo, periodoActual, hoyISO } from '@/lib/fmt';

const CONCEPTOS = [
  'SUELDO', 'QUINCENA', 'HORAS_EXTRA', 'DECIMO_TERCERO', 'DECIMO_CUARTO',
  'FONDOS_RESERVA', 'VACACIONES', 'BONO', 'COMISION', 'LIQUIDACION', 'ANTICIPO', 'OTRO',
];

export default function Pagos() {
  const [mes, setMes] = useState(periodoActual());
  const [pagos, setPagos] = useState(null);
  const [equipo, setEquipo] = useState([]);
  const [error, setError] = useState('');
  const [editando, setEditando] = useState(null); // pago | 'nuevo' | null

  async function cargar() {
    setPagos(null);
    try {
      // Se filtra por el MES AL QUE CORRESPONDE el pago, no por la fecha en que
      // se hizo: un sueldo de julio pagado el 3 de agosto sigue siendo de julio.
      const [p, e] = await Promise.all([
        api.listar('pagos', { periodo: mes }),
        api.listar('empleados'),
      ]);
      setPagos(p);
      setEquipo(e);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [mes]);

  const totales = useMemo(() => {
    const l = pagos || [];
    return {
      bruto: l.reduce((s, p) => s + Number(p.monto_bruto || 0), 0),
      desc: l.reduce((s, p) => s + Number(p.descuentos || 0), 0),
      neto: l.reduce((s, p) => s + Number(p.monto_neto || 0), 0),
      personas: new Set(l.map((p) => p.empleado_id)).size,
    };
  }, [pagos]);

  const quien = (id) => equipo.find((e) => e.id === id);

  function exportarCSV() {
    const filas = [
      ['Fecha', 'Cedula', 'Empleado', 'Concepto', 'Periodo', 'Bruto', 'Descuentos', 'Neto', 'Metodo', 'Referencia'],
      ...(pagos || []).map((p) => {
        const e = quien(p.empleado_id);
        return [
          p.fecha_pago, e?.cedula || '', `${e?.nombres || ''} ${e?.apellidos || ''}`.trim(),
          p.concepto, p.periodo || '', p.monto_bruto, p.descuentos, p.monto_neto,
          p.metodo || '', p.referencia || '',
        ];
      }),
    ];

    // Separador ';' y BOM: asi Excel en espanol lo abre bien de una.
    const csv = '﻿' + filas.map((f) => f.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `pagos-${mes}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (error) return <Aviso>{error}</Aviso>;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Pagos</h1>
          <p className="text-sm text-slate-500">
            Pagos correspondientes a <span className="capitalize font-medium">{periodo(mes)}</span>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input type="month" className="campo !w-auto" value={mes} onChange={(e) => setMes(e.target.value)} />
          <button onClick={exportarCSV} className="btn-suave" disabled={!pagos?.length}>⬇ Excel</button>
          <button onClick={() => setEditando('nuevo')} className="btn-primario">+ Registrar pago</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metrica titulo="Neto pagado" valor={money(totales.neto)} tono="verde" />
        <Metrica titulo="Bruto" valor={money(totales.bruto)} />
        <Metrica titulo="Descuentos" valor={money(totales.desc)} tono={totales.desc ? 'rojo' : 'slate'} />
        <Metrica titulo="Personas" valor={totales.personas} detalle="con pagos este mes" />
      </div>

      <div className="tarjeta overflow-hidden">
        {pagos === null ? (
          <Cargando />
        ) : pagos.length === 0 ? (
          <Vacio
            icono="💵"
            titulo="Sin pagos en este mes"
            detalle="Registra el primero o cambia de mes."
            accion={<button onClick={() => setNuevo(true)} className="btn-primario">+ Registrar pago</button>}
          />
        ) : (
          <div className="scroll-x">
            <table className="w-full min-w-[760px]">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Fecha</th>
                  <th className="th">Persona</th>
                  <th className="th">Concepto</th>
                  <th className="th text-right">Bruto</th>
                  <th className="th text-right">Desc.</th>
                  <th className="th text-right">Neto</th>
                  <th className="th">Metodo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagos.map((p) => {
                  const e = quien(p.empleado_id);
                  return (
                    <tr
                      key={p.id}
                      onClick={() => setEditando(p)}
                      className="hover:bg-ind-50/50 cursor-pointer"
                      title="Clic para editar"
                    >
                      <td className="td whitespace-nowrap">
                        {p.comprobante_url && <span title="Tiene comprobante">📎 </span>}
                        {fecha(p.fecha_pago)}
                      </td>
                      <td className="td">
                        <div className="flex items-center gap-2">
                          <Avatar empleado={e} size={30} />
                          <span className="text-slate-700">{e?.nombres} {e?.apellidos}</span>
                        </div>
                      </td>
                      <td className="td"><Chip tono="CANCELADA">{p.concepto.replace(/_/g, ' ')}</Chip></td>
                      <td className="td text-right">{money(p.monto_bruto)}</td>
                      <td className="td text-right text-rose-600">
                        {Number(p.descuentos) ? `−${money(p.descuentos)}` : '—'}
                      </td>
                      <td className="td text-right font-semibold">{money(p.monto_neto)}</td>
                      <td className="td text-slate-500 text-xs">{p.metodo}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 font-semibold">
                <tr>
                  <td className="td" colSpan={3}>Total</td>
                  <td className="td text-right">{money(totales.bruto)}</td>
                  <td className="td text-right text-rose-600">−{money(totales.desc)}</td>
                  <td className="td text-right">{money(totales.neto)}</td>
                  <td className="td"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <Modal
        abierto={Boolean(editando)}
        titulo={editando === 'nuevo' ? 'Registrar pago' : 'Editar pago'}
        onCerrar={() => setEditando(null)}
      >
        <FormPago
          equipo={equipo.filter((e) => e.estado !== 'INACTIVO')}
          mes={mes}
          pago={editando === 'nuevo' ? null : editando}
          onCancelar={() => setEditando(null)}
          onBorrado={() => { setEditando(null); cargar(); }}
          onListo={() => { setEditando(null); cargar(); }}
        />
      </Modal>
    </div>
  );
}

function FormPago({ equipo, mes, pago, onListo, onCancelar, onBorrado }) {
  const editando = Boolean(pago?.id);

  const [f, setF] = useState(() => {
    const base = {
      empleado_id: '', fecha_pago: hoyISO(), periodo: mes, concepto: 'SUELDO',
      monto_bruto: '', descuentos: '', detalle_desc: '', metodo: 'TRANSFERENCIA',
      referencia: '', comprobante_url: null,
    };
    if (!editando) return base;
    return {
      ...base,
      ...pago,
      fecha_pago: String(pago.fecha_pago).slice(0, 10),
      monto_bruto: String(pago.monto_bruto ?? ''),
      descuentos: String(pago.descuentos ?? ''),
    };
  });
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  // Al elegir a alguien, precargamos su sueldo para no teclearlo cada vez.
  function elegir(e) {
    const id = e.target.value;
    const emp = equipo.find((x) => x.id === id);
    setF((prev) => ({
      ...prev,
      empleado_id: id,
      monto_bruto: prev.concepto === 'SUELDO' && emp?.sueldo_base ? String(emp.sueldo_base) : prev.monto_bruto,
    }));
  }

  async function guardar(ev) {
    ev.preventDefault();
    setError('');
    if (!f.empleado_id) return setError('Elige a quien le pagas.');

    setGuardando(true);
    try {
      const datos = {
        ...f,
        monto_bruto: Number(f.monto_bruto || 0),
        descuentos: Number(f.descuentos || 0),
      };

      if (editando) {
        for (const k of ['id', 'creado_en', 'actualizado_en', 'monto_neto', 'registrado_por']) {
          delete datos[k];
        }
        await api.editar('pagos', pago.id, datos);
      } else {
        await api.crear('pagos', datos);
      }
      onListo();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function borrar() {
    if (!confirm('¿Borrar este pago? No se puede deshacer.')) return;
    setGuardando(true);
    try {
      await api.borrar('pagos', pago.id);
      onBorrado();
    } catch (err) {
      setError(err.message);
      setGuardando(false);
    }
  }

  const neto = Number(f.monto_bruto || 0) - Number(f.descuentos || 0);

  return (
    <form onSubmit={guardar} className="space-y-4">
      <div>
        <label className="etiqueta">Empleado</label>
        <select className="campo" required value={f.empleado_id} onChange={elegir} disabled={editando}>
          <option value="">— elige a la persona —</option>
          {equipo.map((e) => (
            <option key={e.id} value={e.id}>{e.apellidos} {e.nombres} · {e.cargo || ''}</option>
          ))}
        </select>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <label className="etiqueta">Fecha del pago</label>
          <input type="date" className="campo" required value={f.fecha_pago} onChange={set('fecha_pago')} />
        </div>
        <div>
          <label className="etiqueta">Mes al que corresponde</label>
          <input type="month" className="campo" value={f.periodo || ''} onChange={set('periodo')} />
        </div>
        <div>
          <label className="etiqueta">Concepto</label>
          <select className="campo" value={f.concepto} onChange={set('concepto')}>
            {CONCEPTOS.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <label className="etiqueta">Monto bruto</label>
          <input type="number" step="0.01" className="campo" required value={f.monto_bruto} onChange={set('monto_bruto')} />
        </div>
        <div>
          <label className="etiqueta">Descuentos</label>
          <input type="number" step="0.01" className="campo" value={f.descuentos} onChange={set('descuentos')} />
        </div>
        <div>
          <label className="etiqueta">Metodo</label>
          <select className="campo" value={f.metodo} onChange={set('metodo')}>
            {['TRANSFERENCIA', 'EFECTIVO', 'CHEQUE', 'OTRO'].map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <div className="rounded-xl bg-slate-50 p-3">
        <p className="text-sm text-slate-500">Neto a recibir</p>
        <p className="text-xl font-bold text-slate-800">{money(neto)}</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="etiqueta">Detalle del descuento</label>
          <input className="campo" value={f.detalle_desc} onChange={set('detalle_desc')} placeholder="IESS, anticipo, multa…" />
        </div>
        <div>
          <label className="etiqueta">Referencia</label>
          <input className="campo" value={f.referencia} onChange={set('referencia')} />
        </div>
      </div>

      <Adjunto
        empleadoId={f.empleado_id}
        carpeta="comprobantes"
        etiqueta="Comprobante de la transferencia"
        valor={f.comprobante_url}
        onCambio={(ruta) => setF({ ...f, comprobante_url: ruta })}
      />

      <Aviso>{error}</Aviso>

      <div className="flex justify-between gap-2 pt-2">
        {editando ? (
          <button type="button" onClick={borrar} className="btn-peligro" disabled={guardando}>
            Borrar pago
          </button>
        ) : <span />}

        <div className="flex gap-2">
          <button type="button" onClick={onCancelar} className="btn-suave">Cancelar</button>
          <button className="btn-primario" disabled={guardando}>
            {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Registrar pago'}
          </button>
        </div>
      </div>
    </form>
  );
}
