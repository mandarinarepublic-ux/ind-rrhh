// Adjuntos de RRHH: comprobantes de transferencia, certificados medicos, etc.
//
//   POST /api/archivos          sube un archivo (multipart) y devuelve su ruta
//   GET  /api/archivos?ruta=..  devuelve una URL firmada de 5 minutos
//
// El bucket es PRIVADO. Nada se sirve por URL publica: cada vez que alguien
// quiere ver un comprobante, el servidor comprueba que pueda ver a esa persona
// y recien ahi firma un enlace temporal.

import { getSupabase } from '@/lib/supabase';
import { exigirSesion, exigirAdmin, error, puedeVer } from '@/lib/guard';

export const dynamic = 'force-dynamic';

const BUCKET = 'rrhh-adjuntos';
const MAX_BYTES = 10 * 1024 * 1024;
const TIPOS_OK = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];

/** Deja el nombre en algo seguro para una ruta de storage. */
function nombreSeguro(nombre) {
  return String(nombre || 'archivo')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // quita tildes
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(-60);
}

export async function POST(req) {
  const { sesion, respuesta } = exigirAdmin();
  if (respuesta) return respuesta;

  try {
    const form = await req.formData();
    const archivo = form.get('archivo');
    const empleadoId = form.get('empleado_id');
    const carpeta = form.get('carpeta') || 'general';

    if (!archivo || typeof archivo === 'string') return error('No llegó ningún archivo.');
    if (!empleadoId) return error('Falta indicar de quién es el archivo.');
    if (archivo.size > MAX_BYTES) return error('El archivo pesa más de 10 MB.');
    if (!TIPOS_OK.includes(archivo.type)) {
      return error('Solo se aceptan fotos (JPG, PNG, WEBP, HEIC) o PDF.');
    }

    const ruta = `${empleadoId}/${carpeta}/${Date.now()}-${nombreSeguro(archivo.name)}`;

    const { error: err } = await getSupabase().storage
      .from(BUCKET)
      .upload(ruta, await archivo.arrayBuffer(), {
        contentType: archivo.type,
        upsert: false,
      });

    if (err) throw err;

    return Response.json({ ok: true, ruta, nombre: archivo.name, tipo: archivo.type });
  } catch (e) {
    console.error('[archivos POST]', e);
    return error(e.message, 500);
  }
}

export async function GET(req) {
  const { sesion, respuesta } = exigirSesion();
  if (respuesta) return respuesta;

  try {
    const ruta = new URL(req.url).searchParams.get('ruta');
    if (!ruta) return error('Falta la ruta del archivo.');

    // La ruta empieza con el id del empleado: de ahi sale el permiso.
    const duenoId = ruta.split('/')[0];
    if (!(await puedeVer(sesion, duenoId))) return error('Sin permiso para ver este archivo.', 403);

    const { data, error: err } = await getSupabase().storage
      .from(BUCKET)
      .createSignedUrl(ruta, 300); // 5 minutos

    if (err) throw err;
    return Response.json({ ok: true, url: data.signedUrl });
  } catch (e) {
    console.error('[archivos GET]', e);
    return error(e.message, 500);
  }
}

export async function DELETE(req) {
  const { respuesta } = exigirAdmin();
  if (respuesta) return respuesta;

  try {
    const ruta = new URL(req.url).searchParams.get('ruta');
    if (!ruta) return error('Falta la ruta del archivo.');

    const { error: err } = await getSupabase().storage.from(BUCKET).remove([ruta]);
    if (err) throw err;

    return Response.json({ ok: true });
  } catch (e) {
    return error(e.message, 500);
  }
}
