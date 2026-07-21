// lib/api.js  ·  cliente HTTP del navegador hacia nuestras propias rutas.
// Centraliza el manejo de errores para que las pantallas no repitan try/catch.

async function pedir(url, opciones = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opciones,
  });

  let json = null;
  try {
    json = await res.json();
  } catch {
    // respuesta sin cuerpo
  }

  if (!res.ok || json?.ok === false) {
    throw new Error(json?.error || `Error ${res.status}`);
  }
  return json;
}

export const api = {
  listar: (recurso, filtros = {}) => {
    const qs = new URLSearchParams(
      Object.entries(filtros).filter(([, v]) => v !== undefined && v !== null && v !== '')
    ).toString();
    return pedir(`/api/data/${recurso}${qs ? `?${qs}` : ''}`).then((r) => r.datos);
  },

  crear: (recurso, datos) =>
    pedir(`/api/data/${recurso}`, { method: 'POST', body: JSON.stringify(datos) }).then((r) => r.dato),

  editar: (recurso, id, datos) =>
    pedir(`/api/data/${recurso}`, { method: 'PATCH', body: JSON.stringify({ id, ...datos }) }).then((r) => r.dato),

  borrar: (recurso, id) =>
    pedir(`/api/data/${recurso}?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),

  dashboard: () => pedir('/api/dashboard'),
  porPagar: (periodo) => pedir(`/api/por-pagar${periodo ? `?periodo=${periodo}` : ''}`),
  mi: () => pedir('/api/mi'),

  login: (cedula, pin) =>
    pedir('/api/auth/login', { method: 'POST', body: JSON.stringify({ cedula, pin }) }),

  setup: (datos) => pedir('/api/setup', { method: 'POST', body: JSON.stringify(datos) }),

  logout: () => pedir('/api/auth/logout', { method: 'POST' }),
};
