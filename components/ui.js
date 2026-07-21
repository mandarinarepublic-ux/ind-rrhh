'use client';

// Piezas visuales compartidas por todas las pantallas.

import { useEffect } from 'react';

// ---------------------------------------------------------------- colores
const COLORES = {
  PENDIENTE:  'bg-amber-100 text-amber-800',
  APROBADA:   'bg-emerald-100 text-emerald-800',
  RECHAZADA:  'bg-rose-100 text-rose-700',
  CANCELADA:  'bg-slate-100 text-slate-600',
  GOZADA:     'bg-ind-100 text-ind-800',
  PAGADA:     'bg-ind-100 text-ind-800',
  ACTIVO:     'bg-emerald-100 text-emerald-800',
  INACTIVO:   'bg-slate-200 text-slate-600',
  VACACIONES: 'bg-sky-100 text-sky-800',
  SUSPENDIDO: 'bg-rose-100 text-rose-700',
  VIGENTE:    'bg-amber-100 text-amber-800',
  PAGADO:     'bg-emerald-100 text-emerald-800',
  ANULADO:    'bg-slate-100 text-slate-500',
  FALTA:      'bg-rose-100 text-rose-700',
  ATRASO:     'bg-orange-100 text-orange-800',
  PERMISO:    'bg-sky-100 text-sky-800',
  ENFERMEDAD: 'bg-violet-100 text-violet-800',
};

export function Chip({ children, tono }) {
  const clase = COLORES[tono ?? children] || 'bg-slate-100 text-slate-700';
  return <span className={`chip ${clase}`}>{children}</span>;
}

// ---------------------------------------------------------------- avatar
export function Avatar({ empleado, size = 40 }) {
  const ini = ((empleado?.nombres?.[0] || '') + (empleado?.apellidos?.[0] || '')).toUpperCase() || '?';

  if (empleado?.foto_url) {
    return (
      <img
        src={empleado.foto_url}
        alt=""
        className="rounded-full object-cover bg-slate-200 shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full bg-ind-100 text-ind-700 grid place-items-center font-semibold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {ini}
    </div>
  );
}

// ---------------------------------------------------------------- modal
export function Modal({ abierto, titulo, onCerrar, children, ancho = 'max-w-2xl' }) {
  useEffect(() => {
    if (!abierto) return;
    const esc = (e) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', esc);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', esc);
      document.body.style.overflow = '';
    };
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onCerrar} />
      <div
        className={`relative w-full ${ancho} bg-white rounded-t-2xl sm:rounded-2xl shadow-xl
                    max-h-[92vh] sm:max-h-[88vh] flex flex-col`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
          <h2 className="font-semibold text-slate-800">{titulo}</h2>
          <button
            onClick={onCerrar}
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none px-2"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- campos
export function Campo({ etiqueta, hint, children, className = '' }) {
  return (
    <div className={className}>
      <label className="etiqueta">{etiqueta}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Entrada({ etiqueta, hint, className = '', ...props }) {
  return (
    <Campo etiqueta={etiqueta} hint={hint} className={className}>
      <input className="campo" {...props} />
    </Campo>
  );
}

export function Selector({ etiqueta, hint, opciones = [], className = '', ...props }) {
  return (
    <Campo etiqueta={etiqueta} hint={hint} className={className}>
      <select className="campo" {...props}>
        {opciones.map((o) => {
          const valor = typeof o === 'string' ? o : o.valor;
          const texto = typeof o === 'string' ? o : o.texto;
          return (
            <option key={valor} value={valor}>
              {texto}
            </option>
          );
        })}
      </select>
    </Campo>
  );
}

// ---------------------------------------------------------------- estados
export function Cargando({ texto = 'Cargando…' }) {
  return (
    <div className="py-16 text-center text-slate-400 text-sm">
      <div className="inline-block w-6 h-6 border-2 border-slate-300 border-t-ind-500 rounded-full animate-spin mb-3" />
      <p>{texto}</p>
    </div>
  );
}

export function Vacio({ icono = '📭', titulo, detalle, accion }) {
  return (
    <div className="py-14 text-center">
      <div className="text-4xl mb-2">{icono}</div>
      <p className="font-medium text-slate-600">{titulo}</p>
      {detalle && <p className="text-sm text-slate-400 mt-1">{detalle}</p>}
      {accion && <div className="mt-4">{accion}</div>}
    </div>
  );
}

export function Aviso({ tipo = 'error', children }) {
  if (!children) return null;
  const estilos = {
    error: 'bg-rose-50 text-rose-700 border-rose-200',
    ok: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    info: 'bg-ind-50 text-ind-800 border-ind-200',
  };
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${estilos[tipo]}`}>{children}</div>
  );
}

// ---------------------------------------------------------------- metrica
export function Metrica({ titulo, valor, detalle, tono = 'slate', onClick }) {
  const tonos = {
    slate: 'text-slate-800',
    ind: 'text-ind-600',
    verde: 'text-emerald-600',
    ambar: 'text-amber-600',
    rojo: 'text-rose-600',
  };
  const Caja = onClick ? 'button' : 'div';
  return (
    <Caja
      onClick={onClick}
      className={`tarjeta p-4 text-left w-full ${onClick ? 'hover:border-ind-300 transition' : ''}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className={`text-2xl font-bold mt-1 ${tonos[tono]}`}>{valor}</p>
      {detalle && <p className="text-xs text-slate-400 mt-0.5">{detalle}</p>}
    </Caja>
  );
}
