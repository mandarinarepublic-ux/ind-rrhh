// /api/data/<recurso>  ·  CRUD unico para todos los registros de RRHH.
//
//   GET     lista, ya filtrada por lo que la sesion puede ver
//   POST    crea
//   PATCH   actualiza  (id en el body)
//   DELETE  borra      (?id=...)
//
// Dos defensas, siempre:
//   1) ALCANCE  - un empleado solo toca filas suyas (lib/guard.js)
//   2) CAMPOS   - lista blanca por recurso; lo que no esta aqui se descarta.
//                 Por eso un empleado no puede colarse un `rol: ADMIN` ni un
//                 `sueldo_base` aunque lo mande en el JSON.

import bcrypt from 'bcryptjs';
import { getSupabase, registrarBitacora } from '@/lib/supabase';
import {
  exigirSesion, esAdmin, esJefe, error, alcanceEmpleados, puedeVer,
} from '@/lib/guard';

export const dynamic = 'force-dynamic';

const RECURSOS = {
  empleados: {
    tabla: 'empleados',
    columnaScope: 'id',
    orden: { col: 'apellidos', asc: true },
    campos: [
      'codigo', 'cedula', 'nombres', 'apellidos', 'fecha_nac', 'telefono', 'email',
      'direccion', 'foto_url', 'cargo', 'area', 'jefe_id', 'fecha_ingreso',
      'fecha_salida', 'tipo_contrato', 'sueldo_base', 'jornada', 'banco',
      'tipo_cuenta', 'nro_cuenta', 'rol', 'estado', 'motivo_salida', 'notas',
      'vacaciones_ajuste', 'nomina_desde',
    ],
  },
  ausencias: {
    tabla: 'ausencias',
    columnaScope: 'empleado_id',
    firmaCreador: 'registrado_por',
    orden: { col: 'fecha_desde', asc: false },
    campos: [
      'empleado_id', 'fecha_desde', 'fecha_hasta', 'dias', 'tipo',
      'justificada', 'con_sueldo', 'motivo', 'adjunto_url',
    ],
  },
  horas_extra: {
    tabla: 'horas_extra',
    columnaScope: 'empleado_id',
    firmaCreador: 'registrado_por',
    orden: { col: 'fecha', asc: false },
    campos: [
      'empleado_id', 'fecha', 'horas', 'recargo', 'valor_hora', 'valor_total',
      'motivo', 'estado', 'pago_id',
    ],
  },
  vacaciones: {
    tabla: 'vacaciones',
    columnaScope: 'empleado_id',
    orden: { col: 'fecha_desde', asc: false },
    campos: ['empleado_id', 'fecha_desde', 'fecha_hasta', 'dias', 'estado', 'observacion'],
  },
  pagos: {
    tabla: 'pagos',
    columnaScope: 'empleado_id',
    firmaCreador: 'registrado_por',
    orden: { col: 'fecha_pago', asc: false },
    campos: [
      'empleado_id', 'periodo', 'fecha_pago', 'concepto', 'monto_bruto',
      'descuentos', 'detalle_desc', 'metodo', 'referencia', 'comprobante_url',
      'observacion',
    ],
  },
  anticipos: {
    tabla: 'anticipos',
    columnaScope: 'empleado_id',
    firmaCreador: 'registrado_por',
    orden: { col: 'fecha', asc: false },
    campos: ['empleado_id', 'fecha', 'monto', 'cuotas', 'motivo', 'estado'],
  },
  anticipo_abonos: {
    tabla: 'anticipo_abonos',
    columnaScope: null,          // se filtra por anticipo_id; solo admin
    soloAdmin: true,
    orden: { col: 'fecha', asc: false },
    campos: ['anticipo_id', 'fecha', 'monto', 'pago_id', 'nota'],
  },
  documentos: {
    tabla: 'documentos',
    columnaScope: 'empleado_id',
    firmaCreador: 'subido_por',
    orden: { col: 'fecha', asc: false },
    campos: ['empleado_id', 'tipo', 'nombre', 'url', 'fecha'],
  },
  vw_vacaciones_saldo: { tabla: 'vw_vacaciones_saldo', columnaScope: 'empleado_id', soloLectura: true },
  vw_anticipos_saldo:  { tabla: 'vw_anticipos_saldo',  columnaScope: 'empleado_id', soloLectura: true },
  vw_resumen_empleado: { tabla: 'vw_resumen_empleado',  columnaScope: 'id',          soloLectura: true },
};

/** Deja pasar solo los campos declarados, ya normalizados. */
function limpiar(cfg, body) {
  const salida = {};
  for (const campo of cfg.campos || []) {
    if (body[campo] === undefined) continue;
    const v = body[campo];
    salida[campo] = v === '' ? null : v;
  }
  return salida;
}

/**
 * Un pago SIEMPRE pertenece a un mes. Si no lo dicen, se toma el mes de la
 * fecha de pago. Asi la vista mensual nunca deja pagos sueltos fuera.
 */
function completarPeriodo(recurso, datos) {
  if (recurso !== 'pagos') return;
  if (datos.periodo || !datos.fecha_pago) return;
  datos.periodo = String(datos.fecha_pago).slice(0, 7); // YYYY-MM
}

// --- excepciones al "solo admin escribe" -------------------------------
// Un empleado puede PEDIR sus vacaciones y cancelar la solicitud mientras
// siga pendiente. Un jefe puede aprobar/rechazar a su equipo.
function empleadoPuedeCrear(recurso, sesion, datos) {
  return recurso === 'vacaciones' && datos.empleado_id === sesion.id;
}

function jefePuedeAprobar(recurso, campos) {
  const claves = Object.keys(campos);
  return (
    ['vacaciones', 'horas_extra'].includes(recurso) &&
    claves.length > 0 &&
    claves.every((k) => k === 'estado' || k === 'observacion' || k === 'motivo')
  );
}

// =======================================================================
// GET
// =======================================================================
export async function GET(req, { params }) {
  const { sesion, respuesta } = exigirSesion();
  if (respuesta) return respuesta;

  const cfg = RECURSOS[params.recurso];
  if (!cfg) return error('Recurso desconocido.', 404);

  try {
    const url = new URL(req.url);
    const sb = getSupabase();
    let q = sb.from(cfg.tabla).select('*');

    // 1) alcance por sesion
    const alcance = await alcanceEmpleados(sesion);
    if (alcance && cfg.columnaScope) {
      q = q.in(cfg.columnaScope, alcance);
    } else if (alcance && !cfg.columnaScope) {
      return error('No tienes permiso para esta consulta.', 403);
    }

    // 2) filtros opcionales
    const empleadoId = url.searchParams.get('empleado_id');
    if (empleadoId && cfg.columnaScope) {
      if (!(await puedeVer(sesion, empleadoId))) return error('Sin permiso.', 403);
      q = q.eq(cfg.columnaScope, empleadoId);
    }

    for (const [param, col] of [['estado', 'estado'], ['tipo', 'tipo'], ['periodo', 'periodo'], ['anticipo_id', 'anticipo_id']]) {
      const v = url.searchParams.get(param);
      if (v) q = q.eq(col, v);
    }

    const desde = url.searchParams.get('desde');
    const hasta = url.searchParams.get('hasta');
    const colFecha = cfg.orden?.col;
    if (colFecha && desde) q = q.gte(colFecha, desde);
    if (colFecha && hasta) q = q.lte(colFecha, hasta);

    if (cfg.orden) q = q.order(cfg.orden.col, { ascending: cfg.orden.asc });

    const limite = Math.min(Number(url.searchParams.get('limit') || 500), 2000);
    q = q.limit(limite);

    const { data, error: err } = await q;
    if (err) throw err;

    // El PIN nunca sale del servidor, ni siquiera hasheado.
    const filas = (data || []).map(({ pin_hash, ...resto }) => resto);

    return Response.json({ ok: true, datos: filas });
  } catch (e) {
    console.error(`[GET ${params.recurso}]`, e);
    return error(e.message, 500);
  }
}

// =======================================================================
// POST
// =======================================================================
export async function POST(req, { params }) {
  const { sesion, respuesta } = exigirSesion();
  if (respuesta) return respuesta;

  const cfg = RECURSOS[params.recurso];
  if (!cfg || cfg.soloLectura) return error('Recurso no editable.', 404);

  try {
    const body = await req.json();
    const datos = limpiar(cfg, body);

    if (!esAdmin(sesion) && !empleadoPuedeCrear(params.recurso, sesion, datos)) {
      return error('No tienes permiso para crear este registro.', 403);
    }

    // Un empleado que pide vacaciones no elige el estado.
    if (!esAdmin(sesion) && params.recurso === 'vacaciones') {
      datos.estado = 'PENDIENTE';
    }

    if (params.recurso === 'empleados' && body.pin) {
      if (!/^\d{6}$/.test(String(body.pin))) return error('El PIN debe ser de 6 digitos.');
      datos.pin_hash = await bcrypt.hash(String(body.pin), 10);
    }

    completarPeriodo(params.recurso, datos);
    if (cfg.firmaCreador) datos[cfg.firmaCreador] = sesion.nombre;

    const { data, error: err } = await getSupabase()
      .from(cfg.tabla)
      .insert(datos)
      .select('*')
      .single();

    if (err) throw err;

    await registrarBitacora({
      tabla: cfg.tabla, registroId: data.id, accion: 'CREAR',
      usuario: sesion.nombre, despues: datos,
    });

    const { pin_hash, ...limpio } = data;
    return Response.json({ ok: true, dato: limpio });
  } catch (e) {
    console.error(`[POST ${params.recurso}]`, e);
    return error(e.message, 500);
  }
}

// =======================================================================
// PATCH
// =======================================================================
export async function PATCH(req, { params }) {
  const { sesion, respuesta } = exigirSesion();
  if (respuesta) return respuesta;

  const cfg = RECURSOS[params.recurso];
  if (!cfg || cfg.soloLectura) return error('Recurso no editable.', 404);

  try {
    const body = await req.json();
    const id = body.id;
    if (!id) return error('Falta el id.');

    const sb = getSupabase();
    const { data: antes, error: errAntes } = await sb
      .from(cfg.tabla).select('*').eq('id', id).maybeSingle();
    if (errAntes) throw errAntes;
    if (!antes) return error('Registro no encontrado.', 404);

    const datos = limpiar(cfg, body);

    // Si al editar se borra el mes, se vuelve a deducir de la fecha de pago.
    if (params.recurso === 'pagos' && datos.periodo === null) {
      datos.periodo = String(datos.fecha_pago || antes.fecha_pago || '').slice(0, 7) || null;
    }

    if (!esAdmin(sesion)) {
      const dueno = cfg.columnaScope ? antes[cfg.columnaScope] : null;
      const esSuyo = dueno === sesion.id;
      const enSuEquipo = await puedeVer(sesion, dueno);

      const jefeAprobando = esJefe(sesion) && enSuEquipo && jefePuedeAprobar(params.recurso, datos);
      const empleadoEditandoSuSolicitud =
        params.recurso === 'vacaciones' && esSuyo && antes.estado === 'PENDIENTE';
      // Cualquiera puede cambiar SU PIN, y nada mas que eso.
      const cambiandoSuPin =
        params.recurso === 'empleados' && esSuyo && body.pin && Object.keys(datos).length === 0;

      if (!jefeAprobando && !empleadoEditandoSuSolicitud && !cambiandoSuPin) {
        return error('No tienes permiso para modificar este registro.', 403);
      }
      // Un empleado no cambia el estado de su propia solicitud.
      if (empleadoEditandoSuSolicitud && !jefeAprobando) delete datos.estado;
    }

    if (params.recurso === 'empleados' && body.pin) {
      if (!esAdmin(sesion) && antes.id !== sesion.id) return error('Sin permiso.', 403);
      if (!/^\d{6}$/.test(String(body.pin))) return error('El PIN debe ser de 6 digitos.');
      datos.pin_hash = await bcrypt.hash(String(body.pin), 10);
    }

    // Quien aprueba queda firmado.
    if (['vacaciones', 'horas_extra'].includes(params.recurso) && datos.estado &&
        datos.estado !== antes.estado) {
      datos.aprobado_por = sesion.nombre;
      datos.aprobado_en = new Date().toISOString();
    }

    if (Object.keys(datos).length === 0) return error('Nada que actualizar.');

    const { data, error: err } = await sb
      .from(cfg.tabla).update(datos).eq('id', id).select('*').single();
    if (err) throw err;

    const { pin_hash: _a, ...antesLimpio } = antes;
    await registrarBitacora({
      tabla: cfg.tabla, registroId: id, accion: 'EDITAR',
      usuario: sesion.nombre, antes: antesLimpio, despues: datos,
    });

    const { pin_hash: _b, ...limpio } = data;
    return Response.json({ ok: true, dato: limpio });
  } catch (e) {
    console.error(`[PATCH ${params.recurso}]`, e);
    return error(e.message, 500);
  }
}

// =======================================================================
// DELETE
// =======================================================================
export async function DELETE(req, { params }) {
  const { sesion, respuesta } = exigirSesion();
  if (respuesta) return respuesta;

  const cfg = RECURSOS[params.recurso];
  if (!cfg || cfg.soloLectura) return error('Recurso no editable.', 404);

  try {
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return error('Falta el id.');

    const sb = getSupabase();
    const { data: antes } = await sb.from(cfg.tabla).select('*').eq('id', id).maybeSingle();
    if (!antes) return error('Registro no encontrado.', 404);

    if (!esAdmin(sesion)) {
      const esSuSolicitudPendiente =
        params.recurso === 'vacaciones' &&
        antes.empleado_id === sesion.id &&
        antes.estado === 'PENDIENTE';
      if (!esSuSolicitudPendiente) return error('No tienes permiso para borrar.', 403);
    }

    // Nunca borramos personas: se desactivan para no perder su historia.
    if (params.recurso === 'empleados') {
      return error('Los empleados no se borran: cambia su estado a INACTIVO.', 400);
    }

    const { error: err } = await sb.from(cfg.tabla).delete().eq('id', id);
    if (err) throw err;

    await registrarBitacora({
      tabla: cfg.tabla, registroId: id, accion: 'BORRAR',
      usuario: sesion.nombre, antes,
    });

    return Response.json({ ok: true });
  } catch (e) {
    console.error(`[DELETE ${params.recurso}]`, e);
    return error(e.message, 500);
  }
}
