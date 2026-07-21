// lib/env.js
// Lee variables de entorno tolerando basura invisible.
//
// Por que existe: al cargar las variables en Vercel desde PowerShell, el valor
// llego con un BOM (U+FEFF) pegado al inicio. Supabase lo usa como cabecera
// HTTP y reventaba con "Cannot convert argument to a ByteString". El sintoma
// no dice nada del origen y cuesta horas encontrarlo, asi que lo limpiamos
// aqui de una vez para todas.

/** Devuelve la variable sin BOM, comillas sueltas ni espacios. */
export function env(nombre, porDefecto = undefined) {
  const bruto = process.env[nombre];
  if (bruto === undefined || bruto === null) return porDefecto;

  const limpio = String(bruto)
    .replace(/^﻿+/, '')   // BOM al inicio
    .replace(/﻿/g, '')    // BOM en cualquier lado
    .trim()
    .replace(/^["'](.*)["']$/s, '$1')  // comillas que sobrevivieron al copiar
    .trim();

  return limpio === '' ? porDefecto : limpio;
}
