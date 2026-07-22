'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Aviso, Campo, Entrada, Selector } from '@/components/ui';
import { hoyISO } from '@/lib/fmt';

const AREAS = ['PRODUCCION', 'BODEGA', 'VENTAS', 'ADMINISTRACION', 'LOGISTICA', 'DISENO', 'OTRA'];
const CONTRATOS = ['INDEFINIDO', 'PLAZO_FIJO', 'EVENTUAL', 'PRUEBA', 'SERVICIOS', 'APRENDIZ'];
const ROLES = [
  { valor: 'EMPLEADO', texto: 'Empleado — solo ve lo suyo' },
  { valor: 'JEFE', texto: 'Jefe de área — aprueba a su equipo' },
  { valor: 'RRHH', texto: 'RRHH — acceso completo' },
  { valor: 'ADMIN', texto: 'Administrador — acceso completo' },
];
const ESTADOS = ['ACTIVO', 'INACTIVO', 'SUSPENDIDO'];

const VACIO = {
  cedula: '', nombres: '', apellidos: '', cargo: '', area: 'PRODUCCION',
  fecha_ingreso: hoyISO(), tipo_contrato: 'INDEFINIDO', sueldo_base: '',
  telefono: '', email: '', banco: '', tipo_cuenta: '', nro_cuenta: '',
  rol: 'EMPLEADO', estado: 'ACTIVO', vacaciones_ajuste: 0, jefe_id: '',
  fecha_salida: '', motivo_salida: '', notas: '',
  nomina_desde: `${hoyISO().slice(0, 7)}-01`,
};

export default function FormEmpleado({ empleado, jefes = [], onListo, onCancelar }) {
  const editando = Boolean(empleado?.id);
  const [f, setF] = useState(() => ({ ...VACIO, ...(empleado || {}) }));
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const set = (k) => (e) => setF((prev) => ({ ...prev, [k]: e.target.value }));

  async function guardar(e) {
    e.preventDefault();
    setError('');

    if (pin && !/^\d{6}$/.test(pin)) return setError('El PIN debe ser de 6 dígitos.');
    if (!editando && !pin) return setError('Asigna un PIN de 6 dígitos para que pueda entrar.');

    const datos = {
      ...f,
      sueldo_base: f.sueldo_base === '' ? 0 : Number(f.sueldo_base),
      vacaciones_ajuste: f.vacaciones_ajuste === '' ? 0 : Number(f.vacaciones_ajuste),
      jefe_id: f.jefe_id || null,
      fecha_salida: f.fecha_salida || null,
      // el input tipo month da 'YYYY-MM'; la columna es date
      nomina_desde: f.nomina_desde ? `${String(f.nomina_desde).slice(0, 7)}-01` : null,
    };
    if (pin) datos.pin = pin;

    setGuardando(true);
    try {
      const guardado = editando
        ? await api.editar('empleados', empleado.id, datos)
        : await api.crear('empleados', datos);
      onListo?.(guardado);
    } catch (err) {
      setError(
        err.message.includes('duplicate') || err.message.includes('unique')
          ? 'Ya existe alguien con esa cédula.'
          : err.message
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="space-y-5">
      <section className="grid sm:grid-cols-2 gap-3">
        <Entrada etiqueta="Nombres" required value={f.nombres} onChange={set('nombres')} />
        <Entrada etiqueta="Apellidos" required value={f.apellidos} onChange={set('apellidos')} />
        <Entrada
          etiqueta="Cédula" required inputMode="numeric" value={f.cedula}
          onChange={(e) => setF({ ...f, cedula: e.target.value.replace(/\D/g, '') })}
        />
        <Entrada etiqueta="Teléfono" value={f.telefono || ''} onChange={set('telefono')} />
      </section>

      <section className="grid sm:grid-cols-2 gap-3">
        <Entrada etiqueta="Cargo" value={f.cargo || ''} onChange={set('cargo')} placeholder="Costurera, bodeguero…" />
        <Selector etiqueta="Área" opciones={AREAS} value={f.area || ''} onChange={set('area')} />
        <Entrada etiqueta="Fecha de ingreso" type="date" required value={(f.fecha_ingreso || '').slice(0, 10)} onChange={set('fecha_ingreso')} />
        <Selector etiqueta="Tipo de contrato" opciones={CONTRATOS} value={f.tipo_contrato} onChange={set('tipo_contrato')} />
        <Entrada
          etiqueta="Sueldo base" type="number" step="0.01" min="0"
          value={f.sueldo_base ?? ''} onChange={set('sueldo_base')}
        />
        <Selector
          etiqueta="Jefe directo"
          opciones={[{ valor: '', texto: '— sin jefe asignado —' },
            ...jefes.filter((j) => j.id !== empleado?.id)
                    .map((j) => ({ valor: j.id, texto: `${j.nombres} ${j.apellidos}` }))]}
          value={f.jefe_id || ''} onChange={set('jefe_id')}
        />
      </section>

      <section className="grid sm:grid-cols-3 gap-3">
        <Entrada etiqueta="Banco" value={f.banco || ''} onChange={set('banco')} />
        <Entrada etiqueta="Tipo de cuenta" value={f.tipo_cuenta || ''} onChange={set('tipo_cuenta')} placeholder="Ahorros" />
        <Entrada etiqueta="Nro de cuenta" value={f.nro_cuenta || ''} onChange={set('nro_cuenta')} />
      </section>

      <section className="grid sm:grid-cols-3 gap-3 pt-1 border-t border-slate-100">
        <Selector etiqueta="Rol en el sistema" opciones={ROLES} value={f.rol} onChange={set('rol')} />
        <Selector etiqueta="Estado" opciones={ESTADOS} value={f.estado} onChange={set('estado')} />
        <Entrada
          etiqueta={editando ? 'Cambiar PIN' : 'PIN de acceso'}
          hint={editando ? 'Déjalo vacío para no cambiarlo' : '6 dígitos'}
          type="text" inputMode="numeric" maxLength={6} value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
        />
      </section>

      <section className="grid sm:grid-cols-2 gap-3">
        <Entrada
          etiqueta="Ajuste de vacaciones (días)"
          hint="Saldo con el que arranca en el sistema. Positivo = días a favor que trae de antes; negativo = días que ya gozó y no están cargados aquí."
          type="number" step="0.5" value={f.vacaciones_ajuste ?? 0} onChange={set('vacaciones_ajuste')}
        />
        <Campo
          etiqueta="La nómina cuenta desde"
          hint="Primer mes en que el sistema empieza a sumar el sueldo adeudado. Ponlo más atrás solo si le arrastras meses pasados a propósito."
        >
          <input
            type="month" className="campo"
            value={(f.nomina_desde || '').slice(0, 7)}
            onChange={(e) => setF({ ...f, nomina_desde: e.target.value })}
          />
        </Campo>
      </section>

      {f.estado === 'INACTIVO' && (
        <section className="grid sm:grid-cols-2 gap-3">
          <Entrada etiqueta="Fecha de salida" type="date" value={(f.fecha_salida || '').slice(0, 10)} onChange={set('fecha_salida')} />
          <Entrada etiqueta="Motivo de salida" value={f.motivo_salida || ''} onChange={set('motivo_salida')} />
        </section>
      )}

      <Aviso>{error}</Aviso>

      <div className="flex gap-2 justify-end pt-2">
        <button type="button" onClick={onCancelar} className="btn-suave">Cancelar</button>
        <button className="btn-primario" disabled={guardando}>
          {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Agregar al equipo'}
        </button>
      </div>
    </form>
  );
}
