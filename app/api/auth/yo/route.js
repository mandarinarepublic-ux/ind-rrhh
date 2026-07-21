// GET /api/auth/yo  ->  quien soy segun la cookie
import { exigirSesion } from '@/lib/guard';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { sesion, respuesta } = exigirSesion();
  if (respuesta) return respuesta;
  return Response.json({ ok: true, sesion });
}
