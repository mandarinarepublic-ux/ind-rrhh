'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import FormEmpleado from '@/components/FormEmpleado';
import { Avatar, Aviso, Cargando, Chip, Modal, Vacio } from '@/components/ui';
import { fecha, money } from '@/lib/fmt';

export default function Empleados() {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState('');
  const [busca, setBusca] = useState('');
  const [verInactivos, setVerInactivos] = useState(false);
  const [editando, setEditando] = useState(null); // objeto empleado | 'nuevo' | null

  async function cargar() {
    try {
      setLista(await api.listar('empleados'));
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { cargar(); }, []);

  const filtrada = useMemo(() => {
    if (!lista) return [];
    const t = busca.trim().toLowerCase();
    return lista.filter((e) => {
      if (!verInactivos && e.estado === 'INACTIVO') return false;
      if (!t) return true;
      return `${e.nombres} ${e.apellidos} ${e.cedula} ${e.cargo || ''} ${e.area || ''}`
        .toLowerCase()
        .includes(t);
    });
  }, [lista, busca, verInactivos]);

  const jefes = useMemo(
    () => (lista || []).filter((e) => ['JEFE', 'ADMIN', 'RRHH'].includes(e.rol)),
    [lista]
  );

  if (error) return <Aviso>{error}</Aviso>;
  if (!lista) return <Cargando />;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Equipo</h1>
          <p className="text-sm text-slate-500">
            {filtrada.length} de {lista.length} personas
          </p>
        </div>
        <button onClick={() => setEditando('nuevo')} className="btn-primario">
          + Nueva persona
        </button>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <input
          className="campo max-w-xs"
          placeholder="Buscar por nombre, cedula, cargo…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={verInactivos}
            onChange={(e) => setVerInactivos(e.target.checked)}
            className="rounded border-slate-300"
          />
          Mostrar inactivos
        </label>
      </div>

      {filtrada.length === 0 ? (
        <div className="tarjeta">
          <Vacio
            icono="👥"
            titulo={busca ? 'Sin resultados' : 'Todavia no hay nadie'}
            detalle={busca ? 'Prueba con otro texto.' : 'Agrega a la primera persona del equipo.'}
          />
        </div>
      ) : (
        <div className="tarjeta overflow-hidden">
          <div className="scroll-x">
            <table className="w-full min-w-[720px]">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Persona</th>
                  <th className="th">Cedula</th>
                  <th className="th">Area / cargo</th>
                  <th className="th">Ingreso</th>
                  <th className="th text-right">Sueldo</th>
                  <th className="th">Estado</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtrada.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="td">
                      <Link href={`/panel/empleados/${e.id}`} className="flex items-center gap-2 group">
                        <Avatar empleado={e} size={36} />
                        <span>
                          <span className="block font-medium text-slate-700 group-hover:text-ind-600">
                            {e.nombres} {e.apellidos}
                          </span>
                          {e.rol !== 'EMPLEADO' && (
                            <span className="text-xs text-ind-600 font-medium">{e.rol}</span>
                          )}
                        </span>
                      </Link>
                    </td>
                    <td className="td text-slate-500">{e.cedula}</td>
                    <td className="td">
                      <span className="block text-slate-700">{e.cargo || '—'}</span>
                      <span className="block text-xs text-slate-400">{e.area || ''}</span>
                    </td>
                    <td className="td text-slate-500">{fecha(e.fecha_ingreso)}</td>
                    <td className="td text-right">{money(e.sueldo_base)}</td>
                    <td className="td"><Chip>{e.estado}</Chip></td>
                    <td className="td text-right">
                      <button
                        onClick={() => setEditando(e)}
                        className="text-sm text-slate-400 hover:text-ind-600"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        abierto={Boolean(editando)}
        titulo={editando === 'nuevo' ? 'Nueva persona' : `Editar · ${editando?.nombres || ''} ${editando?.apellidos || ''}`}
        onCerrar={() => setEditando(null)}
        ancho="max-w-3xl"
      >
        <FormEmpleado
          empleado={editando === 'nuevo' ? null : editando}
          jefes={jefes}
          onCancelar={() => setEditando(null)}
          onListo={() => { setEditando(null); cargar(); }}
        />
      </Modal>
    </div>
  );
}
