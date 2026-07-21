// lib/supabase.js
// Cliente Supabase SOLO servidor (service_role, schema `rrhh`).
//
// El schema rrhh tiene RLS activo SIN politicas: con la llave publica no se
// lee ni una fila. Todo el acceso pasa por aqui, y quien decide que ve cada
// persona es lib/guard.js. La service_role ignora RLS, por eso nunca sale
// del servidor.

import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

if (typeof window !== 'undefined') {
  throw new Error('lib/supabase.js es server-only: nunca lo importes en un componente de cliente.');
}

// env() y no process.env: la clave viaja como cabecera HTTP y un BOM invisible
// la rompe con un error que no dice nada. Ver lib/env.js.
const SUPABASE_URL = env('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = env('SUPABASE_SERVICE_ROLE_KEY');

let _client = null;

export function getSupabase() {
  if (_client) return _client;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'Supabase no configurado: falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY (ver .env.example).'
    );
  }

  _client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    db: { schema: 'rrhh' },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return _client;
}

/** Deja rastro en rrhh.bitacora. Nunca revienta la operacion principal. */
export async function registrarBitacora({ tabla, registroId, accion, usuario, antes, despues }) {
  try {
    await getSupabase().from('bitacora').insert({
      tabla,
      registro_id: registroId ? String(registroId) : null,
      accion,
      usuario: usuario || null,
      antes: antes || null,
      despues: despues || null,
    });
  } catch (e) {
    console.error('[bitacora] no se pudo registrar:', e.message);
  }
}
