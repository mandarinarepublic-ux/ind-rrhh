'use client';

// Subir y ver un adjunto (comprobante de transferencia, certificado medico…).
// El archivo vive en un bucket privado: para verlo se pide una URL firmada que
// dura 5 minutos, nunca un enlace permanente.

import { useState } from 'react';

export default function Adjunto({ empleadoId, carpeta = 'general', valor, onCambio, etiqueta = 'Comprobante' }) {
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');
  const [abriendo, setAbriendo] = useState(false);

  async function subir(e) {
    const archivo = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir el mismo archivo
    if (!archivo) return;

    if (!empleadoId) return setError('Primero elige a la persona.');

    setError('');
    setSubiendo(true);
    try {
      const cuerpo = new FormData();
      cuerpo.append('archivo', archivo);
      cuerpo.append('empleado_id', empleadoId);
      cuerpo.append('carpeta', carpeta);

      const res = await fetch('/api/archivos', { method: 'POST', body: cuerpo });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'No se pudo subir.');

      onCambio(json.ruta);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubiendo(false);
    }
  }

  async function ver() {
    setAbriendo(true);
    try {
      const res = await fetch(`/api/archivos?ruta=${encodeURIComponent(valor)}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      window.open(json.url, '_blank', 'noopener');
    } catch (err) {
      setError(err.message);
    } finally {
      setAbriendo(false);
    }
  }

  const nombre = valor ? valor.split('/').pop().replace(/^\d+-/, '') : '';

  return (
    <div>
      <label className="etiqueta">{etiqueta}</label>

      {valor ? (
        <div className="flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2.5">
          <span className="text-lg">📎</span>
          <button
            type="button"
            onClick={ver}
            disabled={abriendo}
            className="flex-1 text-left text-sm text-ind-600 hover:underline truncate"
          >
            {abriendo ? 'Abriendo…' : nombre}
          </button>
          <button
            type="button"
            onClick={() => onCambio(null)}
            className="text-slate-400 hover:text-rose-600 px-1"
            title="Quitar"
          >
            ✕
          </button>
        </div>
      ) : (
        <label
          className={`flex items-center justify-center gap-2 rounded-xl border-2 border-dashed
                      border-slate-300 px-3 py-4 text-sm cursor-pointer transition
                      hover:border-ind-400 hover:bg-ind-50/40
                      ${subiendo ? 'opacity-60 pointer-events-none' : ''}`}
        >
          <input
            type="file"
            className="hidden"
            accept="image/*,application/pdf"
            onChange={subir}
            disabled={subiendo}
          />
          <span className="text-lg">{subiendo ? '⏳' : '📷'}</span>
          <span className="text-slate-600">
            {subiendo ? 'Subiendo…' : 'Tomar foto o elegir archivo'}
          </span>
        </label>
      )}

      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
